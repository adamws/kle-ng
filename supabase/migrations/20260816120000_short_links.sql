-- Short links: deduplicated, immutable, publicly resolvable share ids.
--
-- The browser talks to PostgREST directly, so everything that matters is enforced here.
-- Nothing in the client is load-bearing for security.
--
-- The table is NEVER selectable. `anon` and `authenticated` hold no privilege on it at
-- all and there are no RLS policies for them. The only way in or out is the two
-- SECURITY DEFINER functions below. A `select` grant — even one narrowed by a policy —
-- would let anybody page through every layout anyone has ever shared. A short link is
-- meant to be unguessable, not enumerable, and "unguessable" is worth nothing next to a
-- GET /rest/v1/short_links?select=*.
--
-- Identity and address are deliberately separate columns. `hash` is what a layout *is*
-- (the dedup key, so two users shortening a byte-identical layout get one row and one
-- link); `id` is only the short public label. Because lookup goes through `hash`, the
-- id never has to be recomputed from the payload, which means it can be random rather
-- than derived — no base64 alphabet in the URL, no prefix-collision ladder, and no way
-- for an outsider to hash a layout they hold and probe whether it has been shared.
--
-- `created_by` is the first creator, for abuse attribution: without it, creation is
-- unbounded and untraceable. It is not ownership — dedup never reassigns it, no client
-- can read it, and account deletion nulls it rather than cascading, so links still
-- never expire and nobody can revoke one.
--
-- Links are never updated. The only DML this schema ever performs is a single INSERT,
-- from inside create_short_link.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.short_links (
  -- 10 random base62 characters, e.g. '7kQ2mBx9Lp'. Alphanumeric only: no '-' or '_'
  -- to survive a copy-paste, no padding, nothing that needs percent-encoding.
  id         text        primary key,

  -- sha256(payload), computed here from the payload. Never supplied by the client: a
  -- client-chosen hash would let a caller point an id at content it does not match.
  -- The unique index on this column is what makes creation idempotent, and it is what
  -- keeps one layout to one link even if a row is ever deleted by hand.
  hash       bytea       not null unique,

  -- lz-string compressed KLE JSON — same encoding as share links (encodeLayoutToUrl)
  -- and as public.layouts.payload.
  payload    text        not null,

  -- Whoever inserted this row. Null once that account is deleted; deliberately not a
  -- cascade, which would break URLs other people already hold.
  created_by uuid        references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),

  -- The generator always emits exactly 10; the range leaves room to lengthen ids later
  -- without a second migration for old rows.
  constraint short_links_id_format     check (id ~ '^[0-9A-Za-z]{8,32}$'),
  -- Mirrors layouts_payload_length so a layout that can be saved can also be shared.
  constraint short_links_payload_length check (char_length(payload) between 1 and 32768)
);

-- Serves the rate-limit count in create_short_link, the only query that reads
-- created_by. Partial because rows from deleted accounts are never counted.
create index short_links_created_by_recent
  on public.short_links (created_by, created_at desc)
  where created_by is not null;

comment on table public.short_links is
  'Deduplicated share links. Read and written only through create_short_link() / resolve_short_link(); no role holds a privilege on this table.';
comment on column public.short_links.id is
  'Short public label: 10 random base62 characters. Not derived from the payload.';
comment on column public.short_links.hash is
  'sha256 of payload, computed server-side. The unique index is what makes creation idempotent.';
comment on column public.short_links.payload is
  'lz-string compressed KLE JSON — same encoding as share links (encodeLayoutToUrl).';
comment on column public.short_links.created_by is
  'The user who first created this link, for abuse attribution. Not ownership: dedup never reassigns it, and no client can read it.';

-- ---------------------------------------------------------------------------
-- Id generation
--
-- gen_random_uuid() is core since PostgreSQL 13 (config.toml pins 17), so this needs no
-- extension — matching the rest of this migration, which avoids pgcrypto entirely.
--
-- Seven of the UUID's random bytes give 56 bits, which base62-encodes to 10 characters.
-- Seven rather than eight because a full eight would overflow bigint's signed range.
-- 56 bits is far more than enough here: a collision becomes likely only around 2^28
-- (~268 million) links, and create_short_link retries on one anyway.
-- ---------------------------------------------------------------------------

create or replace function public.short_link_id()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text :=
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  -- Bytes carrying only random bits in a v4 UUID. Byte 6 holds the version nibble and
  -- byte 8 the variant bits, so both are skipped; including either would silently cost
  -- entropy without shortening the id.
  random_bytes constant integer[] := array[0, 1, 2, 3, 4, 5, 7];
  raw    bytea  := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
  value  bigint := 0;
  result text   := '';
  i      integer;
begin
  foreach i in array random_bytes loop
    value := value * 256 + pg_catalog.get_byte(raw, i);
  end loop;

  while value > 0 loop
    result := pg_catalog.substr(alphabet, (value % 62)::integer + 1, 1) || result;
    value := value / 62;
  end loop;

  -- Fixed width, so every link looks the same length however small the draw was.
  -- 56 bits needs at most 10 base62 digits, so this only ever pads. Note that lpad
  -- *truncates* when the input is longer than the width: widening the byte list above
  -- without widening this would silently shorten ids and multiply collisions.
  return pg_catalog.lpad(result, 10, '0');
end;
$$;

comment on function public.short_link_id() is
  'A fresh 10-character base62 short link id: 56 random bits, not derived from any payload.';

-- ---------------------------------------------------------------------------
-- Rate limit
-- ---------------------------------------------------------------------------

create or replace function public.short_link_rate_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 60 $$;

comment on function public.short_link_rate_limit() is
  'Maximum short links one user may create per rolling hour. Deduplicated calls create no row and are not counted.';

-- ---------------------------------------------------------------------------
-- Creation
--
-- SECURITY DEFINER so it can write a table nobody can write, with an empty
-- search_path and fully qualified names (the standard hardening for definer
-- functions). VOLATILE, so PostgREST will only accept it over POST.
--
-- The parameter is named `payload` because that is the JSON body key PostgREST will
-- expect. It is copied into `link_payload` immediately and never referenced again, so
-- no statement below can be ambiguous between the parameter and the column.
-- ---------------------------------------------------------------------------

create or replace function public.create_short_link(payload text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  link_payload constant text := payload;
  caller    uuid;
  digest    bytea;
  candidate text;
  found_id  text;
  attempt   integer;
  recent    integer;
begin
  -- The whole auth model, in one line. P0001; PostgREST surfaces it as HTTP 400 with
  -- the message intact, which the client matches on.
  caller := (select auth.uid());
  if caller is null then
    raise exception 'short_link_auth_required';
  end if;

  -- The CHECK constraint would catch this too, but only after we have hashed and
  -- probed. Named to match the constraint so describeError() needs one branch.
  if link_payload is null or char_length(link_payload) not between 1 and 32768 then
    raise exception 'short_links_payload_length';
  end if;

  -- pg_catalog.sha256 is built in since PostgreSQL 11, so this needs no extension and
  -- behaves identically on the local stack and on hosted projects.
  digest := pg_catalog.sha256(pg_catalog.convert_to(link_payload, 'UTF8'));

  -- Fast path: this exact payload has been shortened before, by anybody. This is the
  -- dedup promise, and it is the common case for the second user onward. It is a
  -- 32-byte index probe — the payload itself is never read or compared. Returning here
  -- creates no row, so it records no creator and costs the caller nothing.
  select s.id into found_id from public.short_links s where s.hash = digest;
  if found_id is not null then
    return found_id;
  end if;

  -- Past this point the call intends to create a row, so check the budget. Counting
  -- rows rather than keeping a counter makes this a true sliding window and leaves
  -- nothing that could drift from the rows it describes. Concurrent calls from one user
  -- can both pass and overshoot slightly; making it exact would mean serialising every
  -- creation per user, and the point is to stop bulk abuse, not to account exactly.
  select count(*) into recent
    from public.short_links s
   where s.created_by = caller
     and s.created_at > pg_catalog.now() - pg_catalog.make_interval(hours => 1);

  if recent >= public.short_link_rate_limit() then
    raise exception 'short_link_rate_limit_exceeded';
  end if;

  for attempt in 1..8 loop
    candidate := public.short_link_id();

    begin
      -- A plain INSERT, deliberately NOT `on conflict do nothing`. Under READ
      -- COMMITTED a concurrent inserter of the same payload has not committed yet, so
      -- ON CONFLICT DO NOTHING would return *no row and no error* without waiting, and
      -- our follow-up lookup would still see nothing — so we would loop and write a
      -- second row for the same payload. A bare INSERT blocks on the unique index
      -- until the other transaction ends. If it committed, we get unique_violation
      -- *after* its row is visible; if it rolled back, our insert simply proceeds.
      insert into public.short_links (id, hash, payload, created_by)
      values (candidate, digest, link_payload, caller);
      return candidate;
    exception
      when unique_violation then
        -- Two constraints can raise this, told apart by looking the payload up again.
        -- The subtransaction has rolled back, so this SELECT runs on a fresh snapshot
        -- and does see the winner's row.
        --
        --   (a) `hash` collided: somebody stored this exact payload while we were
        --       working. Idempotency is preserved — return their id. They wrote the
        --       row, so created_by is theirs.
        select s.id into found_id from public.short_links s where s.hash = digest;
        if found_id is not null then
          return found_id;
        end if;
        --   (b) `id` collided: a 1-in-2^56 draw landed on a taken id. Loop and draw
        --       again. Nothing about the payload changes, so no id is ever "used up".
    end;
  end loop;

  -- Eight consecutive random collisions. Effectively unreachable; raised rather than
  -- looping forever so a pathological state surfaces instead of hanging a request.
  raise exception 'short_link_id_collision';
end;
$$;

comment on function public.create_short_link(text) is
  'Get-or-create a short link. Requires a session; records the first creator and enforces a per-user hourly limit. Idempotent: the same payload always yields the same id.';

-- ---------------------------------------------------------------------------
-- Resolution
--
-- SECURITY DEFINER for the same reason: the table itself is unreachable. STABLE
-- because it only reads, which also means PostgREST will accept it over GET as well
-- as POST — useful later if link resolution is ever put behind a CDN. The client
-- currently POSTs.
--
-- Returns NULL for an unknown id rather than raising: "no such link" is a normal
-- outcome of a mistyped URL, not an error, and a NULL is cheaper to handle than a
-- 400 in a raw-fetch client.
-- ---------------------------------------------------------------------------

create or replace function public.resolve_short_link(link_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.payload from public.short_links s where s.id = link_id;
$$;

comment on function public.resolve_short_link(text) is
  'Payload for a short link id, or null when unknown. Callable anonymously — this is the only read path into short_links.';

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Enabled with no policies at all. Belt and braces: no role holds a table privilege,
-- so nothing can reach the table anyway, but RLS-on means a future accidental grant
-- still denies by default (and keeps Supabase's "public table without RLS" linter
-- quiet). The definer functions are owned by the migration role, which owns the table
-- and so is not subject to non-FORCED RLS — do not add `force row level security`.
-- ---------------------------------------------------------------------------

alter table public.short_links enable row level security;

-- ---------------------------------------------------------------------------
-- Grants — explicit rather than relying on default privileges.
-- ---------------------------------------------------------------------------

-- No table privileges for anybody. This is the anti-enumeration control, and it is also
-- what keeps created_by an operator's audit trail rather than a public record of who
-- shared what.
revoke all on public.short_links from anon, authenticated;

-- `from public` alone is not enough: Supabase's ALTER DEFAULT PRIVILEGES grants
-- EXECUTE on new public-schema functions to anon explicitly, and revoking from the
-- PUBLIC pseudo-role does not remove a named grant. anon must be revoked by name.
revoke all on function public.create_short_link(text)  from public, anon;
grant execute on function public.create_short_link(text) to authenticated;

revoke all on function public.resolve_short_link(text) from public;
grant execute on function public.resolve_short_link(text) to anon, authenticated;

-- Read only from inside create_short_link, which runs as the definer and so does not
-- consult the caller's privileges. Granting it to authenticated would publish the
-- ceiling to every signed-in client without any function needing that grant to work.
revoke all on function public.short_link_rate_limit() from public, anon, authenticated;

-- Only ever called from inside create_short_link, which runs as the definer.
revoke all on function public.short_link_id() from public, anon, authenticated;
