-- Local development seed. Runs automatically after migrations on `supabase start`
-- and `supabase db reset` (see [db.seed] in config.toml).
--
-- Creates a ready-to-use account so local work needs no OAuth round trip:
--
--     dev@test.local / password123
--
-- The editor signs in as this user with the "Continue as test user" item in the
-- account menu, which appears only in a dev build pointed at a local instance
-- (isTestSignInAvailable() in src/config/supabase.ts).
--
-- This file NEVER runs against production: seeds apply to the local stack only.
--
-- Writing into auth.users directly couples this to GoTrue's schema, which does drift
-- between versions. If a Supabase upgrade breaks the insert, the fix is to add whatever
-- columns it now requires — nothing else depends on it.

do $$
declare
  test_user_id constant uuid := '00000000-0000-4000-a000-000000000001';
  test_email   constant text := 'dev@test.local';
begin
  if exists (select 1 from auth.users where id = test_user_id) then
    return;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    -- These MUST be '' and not NULL. GoTrue scans them into non-nullable Go strings,
    -- so a NULL makes every read of the row fail with the thoroughly unhelpful
    -- "Database error querying schema" — including admin user listings. Not all of
    -- them carry a DEFAULT '', so they are set explicitly.
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    test_user_id,
    'authenticated',
    'authenticated',
    test_email,
    -- pgcrypto lives in the extensions schema on Supabase
    extensions.crypt('password123', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    -- Mirrors the shape GitHub returns, so the account menu renders a name
    '{"user_name":"testuser","full_name":"Test User"}'::jsonb,
    '', '', '', '',
    '', '', '', ''
  );

  -- GoTrue will not authenticate a user with no matching identity row.
  insert into auth.identities (
    user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) values (
    test_user_id,
    test_user_id::text,
    'email',
    jsonb_build_object('sub', test_user_id::text, 'email', test_email, 'email_verified', true),
    now(), now(), now()
  );

  raise notice 'Seeded local test user: % / password123', test_email;
end $$;
