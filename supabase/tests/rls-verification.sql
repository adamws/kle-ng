-- Two-user RLS and quota verification.
--
-- The plan calls this the highest-consequence test in the project: with RLS, the
-- browser writes to PostgREST directly, so these policies are the only thing standing
-- between one user's layouts and another's. Run it after applying the migrations and
-- again after ANY policy change.
--
-- How to run: paste into the Supabase SQL editor, or
--   psql "$DATABASE_URL" -f supabase/tests/rls-verification.sql
--
-- Everything happens inside a transaction that is rolled back, so it leaves no trace.
-- Success prints a single "ALL CHECKS PASSED" notice; any failure aborts with an error.

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two users.
--
-- auth.users is owned by GoTrue and its required columns drift between versions. If
-- this INSERT fails after a Supabase upgrade, add whatever columns it now demands —
-- the rest of the script is unaffected.
-- ---------------------------------------------------------------------------

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
-- USER A
-- ===========================================================================

set local request.jwt.claims = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';
set local role authenticated;

-- user_id is defaulted from the JWT, so the client never sends it.
do $$
begin
  for i in 1..5 loop
    insert into public.layouts (name, payload) values ('Layout ' || i, 'payload-' || i);
  end loop;

  assert (select count(*) from public.layouts) = 5,
    'A should see exactly the 5 layouts it created';
  assert (select count(*) from public.layouts
           where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 5,
    'rows should be attributed to A';
end $$;

-- The 6th insert must be rejected by the quota trigger.
do $$
begin
  insert into public.layouts (name, payload) values ('Sixth', 'payload-6');
  raise exception 'FAILED: the quota trigger allowed a 6th layout';
exception
  when others then
    if sqlerrm <> 'layout_quota_exceeded' then raise; end if;
end $$;

-- ===========================================================================
-- USER B
-- ===========================================================================

reset role;
set local request.jwt.claims = '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}';
set local role authenticated;

do $$
declare
  affected integer;
begin
  -- Isolation: B sees nothing of A's.
  assert (select count(*) from public.layouts) = 0,
    'B must not see A''s layouts';

  -- B cannot modify what it cannot see. RLS filters the rows out, so these are
  -- no-ops rather than errors — the assertion is that nothing was touched.
  update public.layouts set name = 'hijacked';
  get diagnostics affected = row_count;
  assert affected = 0, 'B must not be able to update A''s layouts';

  delete from public.layouts;
  get diagnostics affected = row_count;
  assert affected = 0, 'B must not be able to delete A''s layouts';
end $$;

-- B cannot forge a row belonging to A.
--
-- This also guards a subtler property. A is at quota by this point, and BEFORE ROW
-- triggers run before RLS WITH CHECK — so a quota trigger that counted rows for an
-- unverified new.user_id would raise 'layout_quota_exceeded' here instead, masking the
-- ownership failure and leaking whether an arbitrary user id is full. The trigger
-- short-circuits for rows it does not own precisely so this stays a 42501.
do $$
begin
  insert into public.layouts (user_id, name, payload)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'forged', 'p');
  raise exception 'FAILED: B inserted a layout owned by A';
exception
  when insufficient_privilege then
    null;  -- 42501: the RLS WITH CHECK rejected it, as intended
end $$;

-- The quota is per user, not global: A being full must not block B.
do $$
begin
  insert into public.layouts (name, payload) values ('B first layout', 'payload-b');
  assert (select count(*) from public.layouts) = 1,
    'B should have exactly its own layout';
end $$;

-- B cannot hand its own row to A.
--
-- The case an ownership test is most likely to miss: USING already lets B touch this
-- row, so what is being checked here is the *new* row, not the old one. Note that
-- deleting layouts_update_own's WITH CHECK would not actually break this — Postgres
-- falls back to the USING expression when a policy has no WITH CHECK, so the explicit
-- clause is belt and braces. What this catches is a policy rewritten to a WITH CHECK
-- that is wider than its USING (`with check (true)` being the classic), which no other
-- assertion in this file would notice. Verified by mutation: with `with check (true)`
-- the update succeeds and this block raises.
do $$
begin
  update public.layouts set user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  raise exception 'FAILED: B reassigned its own layout to A';
exception
  when insufficient_privilege then
    null;  -- 42501: the RLS WITH CHECK rejected it, as intended
end $$;

-- Timestamps are server-side, whatever the client sends.
--
-- PostgREST will forward created_at/updated_at if a client puts them in the body, and
-- authenticated holds a table-wide UPDATE grant, so nothing but layouts_touch_updated_at
-- stops a row being backdated.
do $$
declare
  original_created timestamptz;
  final_created    timestamptz;
  final_updated    timestamptz;
begin
  select created_at into original_created from public.layouts;

  update public.layouts
     set name       = 'renamed',
         created_at = timestamptz '1999-01-01 00:00:00+00',
         updated_at = timestamptz '1999-01-01 00:00:00+00';

  select created_at, updated_at into final_created, final_updated from public.layouts;

  assert final_created = original_created,
    'created_at must be pinned to its original value';
  assert final_updated > timestamptz '1999-01-01 00:00:00+00',
    'updated_at must be maintained server-side, not taken from the client';
end $$;

-- The length constraints hold. The client checks these too, but that check is a fast
-- path for the UI; PostgREST is reachable without it.
do $$
begin
  insert into public.layouts (name, payload) values (repeat('x', 121), 'p');
  raise exception 'FAILED: a 121-character name was accepted';
exception
  when check_violation then
    null;  -- layouts_name_length
end $$;

do $$
begin
  insert into public.layouts (name, payload) values ('', 'p');
  raise exception 'FAILED: an empty name was accepted';
exception
  when check_violation then
    null;  -- layouts_name_length
end $$;

do $$
begin
  insert into public.layouts (name, payload) values ('Too big', repeat('x', 32769));
  raise exception 'FAILED: a 32769-character payload was accepted';
exception
  when check_violation then
    null;  -- layouts_payload_length
end $$;

-- ===========================================================================
-- ANONYMOUS
-- ===========================================================================

reset role;
set local request.jwt.claims = '';
set local role anon;

do $$
declare
  visible integer;
begin
  begin
    select count(*) into visible from public.layouts;
    assert visible = 0, 'anon must not see any layouts';
  exception
    when insufficient_privilege then
      null;  -- an outright permission denial is equally acceptable
  end;
end $$;

-- Anon must not be able to write either. The SELECT check above accepts an empty result
-- *or* a denial, so on its own it would still pass if anon were granted access to a
-- table whose policies happened to hide every row. These are unambiguous: anon holds no
-- privilege on this table, so each one is a flat 42501.
--
-- Three independent layers would have to give way for an anon insert to land: the
-- missing grant, the absence of any anon policy, and user_id's NOT NULL against a
-- default of auth.uid() that is null without a JWT. Only the first produces 42501, so if
-- a future change loosens the grants this block either raises FAILED or aborts the
-- script on the uncaught error — both are failures, which is the point.
do $$
begin
  insert into public.layouts (name, payload) values ('anon', 'p');
  raise exception 'FAILED: anon inserted a layout';
exception
  when insufficient_privilege then
    null;  -- 42501, as intended
end $$;

do $$
begin
  update public.layouts set name = 'hijacked';
  raise exception 'FAILED: anon updated a layout';
exception
  when insufficient_privilege then
    null;  -- 42501, as intended
end $$;

do $$
begin
  delete from public.layouts;
  raise exception 'FAILED: anon deleted a layout';
exception
  when insufficient_privilege then
    null;  -- 42501, as intended
end $$;

-- Anon must not be able to call layout_quota(). Guards the grant fix: revoking from
-- the PUBLIC pseudo-role alone leaves the named grant that Supabase's default
-- privileges hand to anon, so anon has to be revoked explicitly.
do $$
declare
  q integer;
begin
  select public.layout_quota() into q;
  raise exception 'FAILED: anon can call layout_quota()';
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
