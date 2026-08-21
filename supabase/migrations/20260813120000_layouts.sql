-- Saved layouts, one row per stored keyboard layout.
--
-- The browser talks to PostgREST directly with the user's JWT, so every rule that
-- matters — ownership and the per-user quota — is enforced here. Nothing in the client
-- is load-bearing for security.

-- ---------------------------------------------------------------------------
-- Quota, as a single source of truth shared by the trigger and the UI.
-- The frontend reads it with supabase.rpc('layout_quota') instead of hardcoding 5.
-- ---------------------------------------------------------------------------

create or replace function public.layout_quota()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 5;
$$;

comment on function public.layout_quota() is
  'Maximum number of layouts a single user may store.';

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.layouts (
  id         uuid        primary key default gen_random_uuid(),
  -- Defaulted from the JWT so the client never sends (or spoofs) a user id.
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  name       text        not null,
  -- lz-string-compressed KLE, the same payload format used by #share= links.
  payload    text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint layouts_name_length    check (char_length(name) between 1 and 120),
  constraint layouts_payload_length check (char_length(payload) between 1 and 32768)
);

comment on table public.layouts is
  'User-saved keyboard layouts. Quota enforced by the layouts_enforce_quota trigger.';
comment on column public.layouts.payload is
  'lz-string compressed KLE JSON — same encoding as share links (encodeLayoutToUrl).';

create index layouts_user_id_updated_at_idx
  on public.layouts (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Quota enforcement
--
-- SECURITY DEFINER so the count is authoritative rather than whatever the caller's
-- RLS policies happen to expose, with an empty search_path and fully qualified names
-- (the standard hardening for definer functions).
--
-- The count and the insert are not atomic, so two concurrent inserts from one user can
-- both read 4 and both commit, leaving 6 rows. Tolerated on the same grounds as the
-- short-link rate limit (see 20260816120000_short_links.sql): closing it means
-- serialising every insert per user, and the quota exists to bound storage, not to be
-- exact. One extra saved layout is not worth a lock.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_layout_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing integer;
  current_user_id uuid := (select auth.uid());
begin
  -- BEFORE ROW triggers run before RLS WITH CHECK, so this fires even for rows the
  -- policy is about to reject. Counting them would mask the ownership error and would
  -- leak whether an arbitrary user id has reached their quota (a forged insert against
  -- a full user raises here, against a non-full user raises 42501). Leave those rows to
  -- RLS. A null uid means a trusted role (service_role, migrations), which is
  -- intentionally not quota-limited.
  if current_user_id is null or new.user_id is distinct from current_user_id then
    return new;
  end if;

  select count(*) into existing
    from public.layouts
   where user_id = new.user_id;

  if existing >= public.layout_quota() then
    -- P0001; PostgREST surfaces this as HTTP 400 with the message intact, which the
    -- client matches on to show a friendly "you have reached your limit" toast.
    raise exception 'layout_quota_exceeded';
  end if;

  return new;
end;
$$;

create trigger layouts_enforce_quota
  before insert on public.layouts
  for each row execute function public.enforce_layout_quota();

-- ---------------------------------------------------------------------------
-- Timestamps
--
-- updated_at is maintained server-side, and created_at is pinned to its original
-- value so a client cannot rewrite either.
-- ---------------------------------------------------------------------------

create or replace function public.layouts_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger layouts_set_updated_at
  before update on public.layouts
  for each row execute function public.layouts_touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
--
-- auth.uid() is wrapped in a scalar subquery so the planner evaluates it once per
-- statement (as an InitPlan) rather than once per row.
-- ---------------------------------------------------------------------------

alter table public.layouts enable row level security;

create policy layouts_select_own on public.layouts
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy layouts_insert_own on public.layouts
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- USING selects the rows that may be updated; WITH CHECK also blocks reassigning a
-- row to another user.
create policy layouts_update_own on public.layouts
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy layouts_delete_own on public.layouts
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Grants — explicit rather than relying on default privileges. Anonymous visitors
-- have no access to this table at all.
-- ---------------------------------------------------------------------------

revoke all on public.layouts from anon;
grant select, insert, update, delete on public.layouts to authenticated;

-- `from public` alone is not enough: Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE
-- on new public-schema functions to anon explicitly, and revoking from the PUBLIC
-- pseudo-role does not remove a named grant. anon must be revoked by name.
revoke all on function public.layout_quota() from public, anon;
grant execute on function public.layout_quota() to authenticated;
