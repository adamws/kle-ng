# Supabase — user accounts and saved layouts

Optional accounts: a user signs in with GitHub and can keep up to **5 layouts**.

None of this is required to run or self-host kle-ng. While `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` are unset the editor never loads supabase-js and behaves exactly as it
does without a backend.

```
config.toml                             local stack configuration
migrations/20260813120000_layouts.sql   the layouts table, 5-per-user quota, RLS
seed.sql                                local test user (local only, never production)
tests/rls-verification.sql              two-user RLS + quota verification
```

## Local development (default)

Development runs against a local stack, never the production project. Requires Docker.

```sh
npm run supabase:start     # boots Postgres + Auth + Studio, applies migrations
npm run supabase:status    # prints URLs and keys again
npm run supabase:reset     # wipes and re-applies migrations from scratch
npm run supabase:stop
```

`supabase:start` prints an **anon / publishable key** — paste it into `VITE_SUPABASE_ANON_KEY` in
`.env.local`, which is already pointed at `http://127.0.0.1:54321`. Until that key has a value,
accounts stay disabled, so a half-configured checkout can never silently fall through to
production. Studio is at <http://127.0.0.1:54323>.

Migrations in `migrations/` are applied automatically on `start` and `reset`, so a schema change is
just a new file plus `npm run supabase:reset`.

### Signing in locally

**Test user** (nothing to set up). `seed.sql` creates `dev@test.local` / `password123` on every
`start` and `reset`, and the account menu gains a **"Continue as test user"** item that signs in
as it — one click, no OAuth round trip.

The seeded account is used when `import.meta.env.DEV` is true *and* the configured URL is a local
host — that is the whole condition, and it is the only test account that exists. `DEV` is compiled
away in production builds, so neither it nor its credentials can reach a shipped bundle, even if
someone builds with a localhost URL configured — including `npm run preview`, which is a production
build. No hosted project can satisfy the local-host half either, so no deployment offers the
shortcut.

If the item is present but sign-in fails with a missing-user error, the seed has not run against
this instance — `npm run supabase:reset`.

### Signing in on a preview deployment

**With GitHub, the same as production.** There is no test-user shortcut on previews.

Previews used to carry one, signing into a shared password account on the preview project via
`VITE_TEST_USER_EMAIL` / `VITE_TEST_USER_PASSWORD` compiled in by CI. It was removed: the preview
project has password sign-in disabled, so `signInWithPassword` fails there whether or not the
account exists, and a menu item that cannot work is worse than none. Re-enabling it in the client
alone will not help — the Supabase-side change is to turn on the Email provider for that project.

The repository secrets `SUPABASE_TEST_USER_EMAIL_PREVIEW` / `SUPABASE_TEST_USER_PASSWORD_PREVIEW`
are no longer read by `vercel-preview.yml` and can be deleted, along with the account itself.

## Environments

Three, each with its own database. Nothing shares state.

|                               | Database                      | Config comes from             | Sign-in                            |
|-------------------------------|-------------------------------|-------------------------------|------------------------------------|
| **Local**                     | `supabase start` (Docker)     | `.env.local`                  | seeded test user                   |
| **Preview** (Vercel)          | `kle-ng-preview` free project | CI secrets, injected at build | `kle-ng-preview` OAuth only        |
| **Production** (GitHub Pages) | `kle-ng` free project         | `.env.production`             | `kle-ng` OAuth only                |

Free plans allow **2 active projects per organisation**, so production + preview fits exactly.
Supabase Branching would be tidier — migrations apply from git automatically — but it requires Pro
($25/mo plus ~$0.013 per branch-hour), which a second free project avoids entirely.

### Applying migrations

```sh
npx supabase link --project-ref <project-ref>   # preview or production
npx supabase db push
```

…or paste the migration into that project's SQL editor. Do this for **both** hosted projects when
a migration lands; only the local stack applies them automatically.

`seed.sql` never runs against a hosted project — seeds are local-only, so no test user is created
in preview or production, and neither offers a test-user shortcut.

## Design notes

**The quota lives in the database.** `layout_quota()` (5) backs a `BEFORE INSERT` trigger. Because
the client writes directly, a client-side check would enforce nothing. The frontend reads the limit
with `supabase.rpc('layout_quota')` rather than hardcoding it.

**The quota trigger skips rows it does not own.** `BEFORE ROW` triggers run *before* RLS
`WITH CHECK`, so a trigger that counted rows for an unverified `new.user_id` would fire on inserts
the policy is about to reject — masking the ownership error, and leaking whether an arbitrary user
id has reached their quota. The trigger returns early unless `new.user_id` matches `auth.uid()`. A
null `auth.uid()` (service_role, migrations) is deliberately not quota-limited.

**Grants name `anon` explicitly.** Revoking from the `PUBLIC` pseudo-role does not remove the named
grant that Supabase's default privileges hand to `anon`, so both the table and the function revoke
`anon` by name. Newer projects set `auto_expose_new_tables` off and grant nothing by default; the
explicit grants to `authenticated` make the migration correct under either behaviour.

**Account deletion.** `on delete cascade` from `auth.users` clears the table.
