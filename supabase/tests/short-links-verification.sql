-- Short-link creation and resolution verification.
--
-- The short_links table is reachable only through two SECURITY DEFINER functions and
-- holds no privileges for any role, so what is proved here is not RLS policy behaviour
-- but the grant surface, the get-or-create contract, and the per-user rate limit. Run it
-- after applying the migrations and again after any change to either function.
--
-- How to run: paste into the Supabase SQL editor, or
--   psql "$DATABASE_URL" -f supabase/tests/short-links-verification.sql
--
-- Everything happens inside a transaction that is rolled back, so it leaves no trace.
-- Success prints a single "ALL CHECKS PASSED" notice; any failure aborts with an error.
--
-- Not covered: the random-id retry loop in create_short_link. Forcing a collision means
-- landing the same 56-bit draw twice, so exercise that path by temporarily shortening
-- short_link_id(), or leave it to review.

begin;

insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000',
   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   'authenticated', 'authenticated', 'user-a@test.local', '',
   now(), now(), now()),
  ('00000000-0000-0000-0000-000000000000',
   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   'authenticated', 'authenticated', 'user-b@test.local', '',
   now(), now(), now());

-- ===========================================================================
-- USER A — creation
-- ===========================================================================

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

do $$
declare
  id_a text;
begin
  id_a := public.create_short_link('payload-one');

  assert id_a is not null and char_length(id_a) = 10,
    'a fresh link should get a 10-character id';
  assert id_a ~ '^[0-9A-Za-z]{10}$',
    'ids must be alphanumeric so they need no percent-encoding and read cleanly';

  -- The id is a label, not a digest: it must NOT be derivable from the payload, or an
  -- outsider could hash a layout they hold and probe whether it has been shared.
  assert id_a <> substr(encode(sha256(convert_to('payload-one', 'UTF8')), 'hex'), 1, 10),
    'the id must not be derived from the payload';

  -- Idempotent for the same caller: no second row.
  assert public.create_short_link('payload-one') = id_a,
    'the same payload must return the same id';

  -- A different payload gets a different id.
  assert public.create_short_link('payload-two') <> id_a,
    'a different payload must get a different id';
end $$;

-- A creator cannot read the table it just wrote.
do $$
declare
  n integer;
begin
  select count(*) into n from public.short_links;
  raise exception 'FAILED: authenticated can select short_links (enumeration!)';
exception
  when insufficient_privilege then
    null;  -- 42501, as intended
end $$;

-- ===========================================================================
-- USER B — dedup across users, and no ownership anywhere
-- ===========================================================================

reset role;

-- Look A's id up as the owner, before assuming B's role. Reading short_links is exactly
-- what the block above just proved `authenticated` may not do, so doing it after the
-- `set local role` below would raise 42501 and abort the whole transaction — taking
-- every check after this point with it. Ids are random, so B cannot recompute one
-- either; stash it the same way the anon section does.
do $$
begin
  perform set_config(
    'short_links.test_id_a',
    (select s.id from public.short_links s
      where s.hash = sha256(convert_to('payload-one', 'UTF8'))),
    true);
end $$;

set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
set local role authenticated;

do $$
declare
  id_b text;
  -- Dedup is keyed on `hash`, so B lands on the row A created even though neither of
  -- them could have computed its id.
  id_a constant text := current_setting('short_links.test_id_a');
begin
  id_b := public.create_short_link('payload-one');

  assert id_b = id_a,
    'two users shortening the same layout must get the same id';

  -- B can resolve a link A created; there is no ownership to check.
  assert public.resolve_short_link(id_b) = 'payload-one',
    'a link must resolve for a user who did not create it';
end $$;

-- ===========================================================================
-- Row counts and schema shape — checked as the owner, since no client role may select
-- ===========================================================================

reset role;

do $$
declare
  n integer;
begin
  -- Scoped to this run's two users, not the whole table. The script is meant to be
  -- runnable against any stack, including a local one that has been used for real: an
  -- unscoped count(*) fails on every row the developer happened to shorten first. The
  -- two auth.users rows above were freshly inserted, so nothing pre-existing can carry
  -- their ids and the scope is exact. The count is reported so a failure says what it
  -- actually found.
  select count(*) into n
    from public.short_links s
   where s.created_by in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  assert n = 2,
    format('two distinct payloads, four create calls, two rows — found %s', n);

  select count(*) into n
    from public.short_links s
   where s.payload = 'payload-one'
     and s.created_by in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                          'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  assert n = 1,
    format('the second user must not have created a duplicate row — found %s', n);

  -- `created_by` records the first creator, for abuse attribution. It is the only user
  -- column there may be: `user_id` or `owner_id` would imply an ownership this table
  -- deliberately does not have.
  select count(*) into n
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'short_links'
     and column_name in ('user_id', 'owner_id');
  assert n = 0, 'short_links must have no ownership columns';

  assert exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'short_links'
                    and column_name = 'created_by'),
    'short_links must record its first creator';

  -- Attribution follows who actually inserted the row. A and B both called
  -- create_short_link('payload-one'); A got there first, so the row is A's and B's
  -- dedup hit must not have reassigned it.
  assert (select s.created_by from public.short_links s
           where s.hash = sha256(convert_to('payload-one', 'UTF8')))
         = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'dedup must not reassign attribution to the second caller';

  -- Stash the id for the anon section below. Ids are random now, so they cannot be
  -- recomputed there — and anon may not select the table to look one up, which is
  -- exactly the property being tested.
  perform set_config(
    'short_links.test_id',
    (select s.id from public.short_links s
      where s.hash = sha256(convert_to('payload-one', 'UTF8'))),
    true);
end $$;

-- ===========================================================================
-- ANONYMOUS
-- ===========================================================================

set local request.jwt.claims = '';
set local role anon;

-- Anon must not be able to select the table. This is the anti-enumeration control:
-- ids are unguessable, but a select grant would make guessing unnecessary.
do $$
declare
  n integer;
begin
  select count(*) into n from public.short_links;
  raise exception 'FAILED: anon can select short_links (every shared layout is public!)';
exception
  when insufficient_privilege then
    null;  -- 42501, as intended
end $$;

-- Anon CAN resolve. This is the whole point of the feature.
do $$
begin
  assert public.resolve_short_link(current_setting('short_links.test_id')) = 'payload-one',
    'anon must be able to resolve a short link';
  assert public.resolve_short_link('zzzzzzzzzz') is null,
    'an unknown id must resolve to null, not raise';
end $$;

-- Anon must NOT be able to create. Two layers are checked at once: the EXECUTE grant
-- is not there (42501), and even if it were, the auth.uid() gate would fire.
do $$
declare
  ignored text;
begin
  ignored := public.create_short_link('anon-payload');
  raise exception 'FAILED: anon created a short link';
exception
  when insufficient_privilege then
    null;  -- 42501: no EXECUTE grant, as intended
  when others then
    if sqlerrm <> 'short_link_auth_required' then raise; end if;
end $$;

reset role;

-- ===========================================================================
-- RATE LIMIT AND THE ROLLING WINDOW
--
-- The limit counts rows rather than a counter, so everything below is checked by
-- looking at the rows. User A created two links earlier, so A starts at 2.
--
-- now() is the *transaction* timestamp and this file is one transaction, so time cannot
-- be made to pass: the window is exercised by backdating created_at, which is the value
-- the window predicate reads. An exception also rolls its subtransaction back, so each
-- "must be refused" case is its own block and unwinds only itself.
-- ===========================================================================

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

-- Dedup hits return an existing id and write no row, so none is counted.
do $$
declare
  ignored text;
  i       integer;
begin
  for i in 1..20 loop
    ignored := public.create_short_link('payload-one');
  end loop;
end $$;

reset role;

do $$
begin
  assert (select count(*) from public.short_links s
           where s.created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 2,
    'deduplicated calls create no row and must not count towards the limit';
end $$;

-- Read the ceiling as the owner and stash it. `authenticated` holds no EXECUTE on
-- short_link_rate_limit() — create_short_link is a definer and never consults the
-- caller's privileges to read it — so calling it under the role below would raise
-- 42501 and abort the transaction, taking every later check with it.
do $$
begin
  perform set_config('short_links.test_limit', public.short_link_rate_limit()::text, true);
end $$;

-- Fill the window exactly to the limit with distinct payloads. No exception here, so
-- these rows persist.
set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

do $$
declare
  ignored text;
  i       integer;
  limit_n constant integer := current_setting('short_links.test_limit')::integer;
begin
  for i in 1..(limit_n - 2) loop
    ignored := public.create_short_link('rate-limit-payload-' || i::text);
  end loop;
end $$;

do $$
declare
  ignored text;
begin
  ignored := public.create_short_link('rate-limit-payload-over');
  raise exception 'FAILED: the rate limit never fired';
exception
  when others then
    if sqlerrm <> 'short_link_rate_limit_exceeded' then raise; end if;
end $$;

reset role;

do $$
begin
  -- Because the budget *is* the row count, a refused call cannot inflate it: a blocked
  -- user stays blocked until the window moves rather than digging deeper on each retry.
  assert (select count(*) from public.short_links s
           where s.created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
         = public.short_link_rate_limit(),
    'a refused call must not create a row';

  assert not exists (select 1 from public.short_links s
                      where s.created_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
    'a user who only ever deduplicated must not be attributed any row';
end $$;

-- 59 minutes is not an hour: every row still counts, so the refusal stands.
update public.short_links
   set created_at = pg_catalog.now() - pg_catalog.make_interval(mins => 59)
 where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

do $$
declare
  ignored text;
begin
  ignored := public.create_short_link('window-payload-inside');
  raise exception 'FAILED: the window rolled early - 59 minutes is inside the hour';
exception
  when others then
    if sqlerrm <> 'short_link_rate_limit_exceeded' then raise; end if;
end $$;

reset role;

-- Age every row past the hour: the whole budget is free again.
update public.short_links
   set created_at = pg_catalog.now() - pg_catalog.make_interval(mins => 61)
 where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

do $$
begin
  assert public.create_short_link('window-payload-outside') is not null,
    'a link older than the window must stop counting against the limit';
end $$;

reset role;

-- Sliding, not tumbling: only what has aged out is forgiven. Bring everything back
-- inside, then age out enough to leave exactly limit-1 inside — an offset, so it stays
-- correct however many rows A has by now.
update public.short_links
   set created_at = pg_catalog.now() - pg_catalog.make_interval(mins => 30)
 where created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

update public.short_links
   set created_at = pg_catalog.now() - pg_catalog.make_interval(mins => 61)
 where id in (select s.id from public.short_links s
               where s.created_by = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
               order by s.id
               offset public.short_link_rate_limit() - 1);

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

do $$
begin
  assert public.create_short_link('window-payload-slot') is not null,
    'the freed slot must be spendable';
end $$;

do $$
declare
  ignored text;
begin
  ignored := public.create_short_link('window-payload-slot-two');
  raise exception 'FAILED: an aged-out row freed more than its own slot';
exception
  when others then
    if sqlerrm <> 'short_link_rate_limit_exceeded' then raise; end if;
end $$;

reset role;

-- created_by is an operator's audit trail, not public information.
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
set local role authenticated;

do $$
declare
  n integer;
begin
  select count(*) into n from public.short_links where created_by is not null;
  raise exception 'FAILED: authenticated can read created_by';
exception
  when insufficient_privilege then
    null;  -- 42501, as intended
end $$;

reset role;

do $$
begin
  raise notice 'ALL CHECKS PASSED';
end $$;

rollback;
