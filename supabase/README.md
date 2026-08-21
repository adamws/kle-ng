# Supabase — user accounts and saved layouts

Optional accounts: a user signs in with GitHub and can keep up to **5 layouts**.

None of this is required to run or self-host kle-ng. While `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` are unset the editor never loads supabase-js and behaves exactly as it
does without a backend.

```
config.toml                             local stack configuration
migrations/20260813120000_layouts.sql   the layouts table, 5-per-user quota, RLS
migrations/20260816120000_short_links.sql  content-addressed ?s= share links
seed.sql                                local test user (local only, never production)
tests/rls-verification.sql              two-user RLS + quota verification
tests/short-links-verification.sql      short-link grants + get-or-create verification
```

## Local development (default)

Development runs against a local stack, never the production project. Requires Docker.

```sh
npm run supabase:start     # boots Postgres + Auth + Studio, applies migrations
npm run supabase:status    # prints URLs and keys again
npm run supabase:reset     # wipes and re-applies migrations from scratch
npm run supabase:stop
```

Configuration lives in `.env.local`, which is gitignored and so does not exist in a fresh clone —
create it from the committed template:

```sh
cp .env.local.example .env.local
```

That points the editor at `http://127.0.0.1:54321` with the key a stock local stack issues. If
`supabase:start` prints a different **anon / publishable key**, paste that into
`VITE_SUPABASE_ANON_KEY`. Until both variables have values, accounts stay disabled, so a
half-configured checkout can never silently fall through to production. Studio is at
<http://127.0.0.1:54323>.

Migrations in `migrations/` are applied automatically on `start` and `reset`, so a schema change is
just a new file plus `npm run supabase:reset`.

### Signing in locally

**Test user** (nothing to set up). `seed.sql` creates `dev@test.local` / `password123` on every
`start` and `reset`, and the account menu gains a **"Continue as test user"** item that signs in
as it — one click, no OAuth round trip.

The seeded account is used when `import.meta.env.DEV` is true _and_ the configured URL is a local
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

|                               | Database                      | Config comes from             | Sign-in                     |
| ----------------------------- | ----------------------------- | ----------------------------- | --------------------------- |
| **Local**                     | `supabase start` (Docker)     | `.env.local`                  | seeded test user            |
| **Preview** (Vercel)          | `kle-ng-preview` free project | CI secrets, injected at build | `kle-ng-preview` OAuth only |
| **Production** (GitHub Pages) | `kle-ng` free project         | `.env.production`             | `kle-ng` OAuth only         |

Free plans allow **2 active projects per organisation**, so production + preview fits exactly.
Supabase Branching would be tidier — migrations apply from git automatically — but it requires Pro
($25/mo plus ~$0.013 per branch-hour), which a second free project avoids entirely.

### Hosted project settings

`config.toml` configures the **local stack only**. Every hosted setting below lives in the Supabase
dashboard, where nothing in this repo can review it or notice it drifting — so it is written down
here instead. Check it against both hosted projects when touching auth.

| Setting                                            | Expected                                            |
| -------------------------------------------------- | --------------------------------------------------- |
| Authentication → URL Configuration → Site URL       | the deployment's own origin                          |
| Authentication → URL Configuration → Redirect URLs  | **exact URLs only, no wildcards**                    |
| Authentication → Providers                          | GitHub only; email/password **off**                  |
| Authentication → Attack Protection → Captcha        | **on** (signup is open, so this is the real limiter) |
| Authentication → Sessions → JWT expiry              | 3600, matching `config.toml`                         |
| Authentication → Sessions → Refresh token rotation  | on, reuse interval 10                                |
| Settings → API → Rate limits                        | enabled (the only throttle on `resolve_short_link`)  |

The redirect allowlist is the one to watch. Preview deployments get a fresh per-commit Vercel URL,
which creates standing pressure to paste in something like `https://*.vercel.app` to stop chasing
them. Do not: a wildcard there makes every page on that host a valid OAuth redirect target. Add the
specific preview URLs, or sign in on the stable alias.

### Applying migrations

```sh
npx supabase link --project-ref <project-ref>   # preview or production
npx supabase db push
```

…or paste the migration into that project's SQL editor. Do this for **both** hosted projects when
a migration lands; only the local stack applies them automatically.

`seed.sql` never runs against a hosted project — seeds are local-only, so no test user is created
in preview or production, and neither offers a test-user shortcut.

## Known limitations

**A short link cannot be taken back.** This is a deliberate property — see the design notes below —
but it is worth stating as an operational risk rather than only as a design virtue:

- Anyone can resolve a link anonymously, forever. There is no expiry, no revocation, and no client
  path that deletes one. `ShortLinkConfirmModal` says so before the first write, which is where the
  consent for it comes from.
- `payload` is 32 KiB of unvalidated text. Nothing checks that it decompresses, or that it is a
  layout at all, so the table will hold whatever a signed-in caller posts.
- The ceiling per account is `short_link_rate_limit()` (60) new links per rolling hour, so roughly
  1.9 MiB/hour, with no cap on the total. Deduplicated calls create no row and are not counted.
- Deleting an account **nulls `created_by`** rather than cascading, so the content outlives the
  attribution. Someone who abuses the feature and then deletes their account leaves rows nobody can
  trace.

Taking a link down is therefore a manual operator action, in the SQL editor:

```sql
-- Find it (nothing but the service role can read this table).
select id, created_by, created_at, char_length(payload) from public.short_links where id = '<id>';

-- Remove it.
delete from public.short_links where id = '<id>';
```

Deleting frees that payload's `hash`, so the next person to shorten the same layout mints a **new**
id — the old URL stays dead rather than coming back to life.

To find bulk abuse before it needs a takedown, group by creator over the window — the query is in
the design notes below, under "Creation is rate limited".

## Design notes

**The quota lives in the database.** `layout_quota()` (5) backs a `BEFORE INSERT` trigger. Because
the client writes directly, a client-side check would enforce nothing. The frontend reads the limit
with `supabase.rpc('layout_quota')` rather than hardcoding it.

**The quota trigger skips rows it does not own.** `BEFORE ROW` triggers run _before_ RLS
`WITH CHECK`, so a trigger that counted rows for an unverified `new.user_id` would fire on inserts
the policy is about to reject — masking the ownership error, and leaking whether an arbitrary user
id has reached their quota. The trigger returns early unless `new.user_id` matches `auth.uid()`. A
null `auth.uid()` (service_role, migrations) is deliberately not quota-limited.

**Grants name `anon` explicitly.** Revoking from the `PUBLIC` pseudo-role does not remove the named
grant that Supabase's default privileges hand to `anon`, so both the table and the function revoke
`anon` by name. Newer projects set `auto_expose_new_tables` off and grant nothing by default; the
explicit grants to `authenticated` make the migration correct under either behaviour.

**Account deletion.** `on delete cascade` from `auth.users` clears the `layouts` table. It does
_not_ cascade to `short_links`: that reference is `on delete set null`, so deleting an account drops
the attribution but leaves the links working. Cascading would delete links other people are already
relying on, which "short links never expire" forbids.

**Short links deduplicate on a hash, and address with a random id.** `hash` is `sha256(payload)`
computed in the database and carries a unique index, so two users shortening a byte-identical layout
land on the same row and the same link — deduplication is a property of the schema, not something the
client arranges. The hash is never accepted from the client, which would otherwise let a caller point
an id at content it does not match.

`id` is a separate thing: 10 random base62 characters, not derived from the payload. Keeping the two
apart is what lets the id be short and purely alphanumeric, and it means nobody can hash a layout
they hold to work out whether it has already been shared. It also keeps "one row per layout" a
database invariant — with an id-only table, deleting a row by hand could let one layout acquire two
links.

**The `short_links` table has no privileges.** Neither `anon` nor `authenticated` may touch it, and
it carries no RLS policies — the only way in or out is `create_short_link()` / `resolve_short_link()`,
both `SECURITY DEFINER`. This is the anti-enumeration control: a `select` grant would turn
unguessable ids into a browsable index of every layout anyone has ever shared.

**`created_by` records the first creator, for abuse attribution.** Creating a link requires a
session, and the caller is written to `created_by` on the row they actually insert. Dedup returns the
existing row untouched, so the second person to shorten a layout does not overwrite the column and is
not charged for it. This is attribution for _creation_, not ownership: the link is shared by everyone
who shortened that layout, cannot be revoked by any of them, and never expires. Nothing exposes it —
`short_links` is unreadable to `anon` and `authenticated`, so the column is visible only to the
service role and the SQL editor.

**Creation is rate limited to 60 new links per user per rolling hour** (`short_link_rate_limit()`).
The limit counts rows — `created_by = caller and created_at > now() - 1 hour` — rather than keeping a
separate counter, which makes it a true sliding window and leaves nothing that could drift from the
rows it describes. Deduplicated calls create no row and so are never counted: re-sharing one layout
is always free. Concurrent calls from one user can both pass the check and overshoot slightly; making
it exact would mean serialising every creation per user, and the point is to stop bulk abuse, not to
account exactly.

To find abuse, group by creator over the window:

```sql
select created_by, count(*)
  from public.short_links
 where created_at > now() - interval '24 hours'
 group by created_by
 order by count(*) desc;
```
