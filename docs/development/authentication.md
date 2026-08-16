# Authentication

Optional user accounts. A visitor may sign in with GitHub and keep a small number of layouts in the
cloud, reachable from any browser they sign into. Everything else about the editor is unchanged: the
layout still lives in the page, still exports to a file, and still travels as a `#share=` link.

The whole feature is built around one rule — **the editor must work exactly as it did before when
nobody is signed in, and when no Supabase project is configured at all**. When
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset, `isAuthConfigured()` returns false, every
account surface hides, and `@supabase/supabase-js` is never even downloaded. This mirrors how
`config/api.ts` gates the [PCB Generator](./pcb-generator.md) on `VITE_BACKEND_URL`.

There is no application server in front of the database. The browser talks to Supabase's PostgREST
endpoint directly with the user's JWT, so **Row Level Security is the security boundary** — nothing
in the client is load-bearing for it, and the per-user quota is a database trigger rather than a
client-side check.

## Architecture Overview

```
┌─────────────────────────── Browser (kle-ng) ──────────────────────────────┐
│  AccountMenu.vue            ← Header dropdown: theme + sign in / sign out │
│  KeyboardToolbar.vue        ← "My Layouts" button, signed in only         │
│  └── MyLayoutsModal.vue     ← Save / load / rename / delete / Download all│
│      └── LayoutThumbnail.vue ←  Preview canvas drawn from the payload     │
│                                                                           │
│  stores/auth.ts             ← Session mirror, sign-in / sign-out (Pinia)  │
│  stores/layouts.ts          ← CRUD over the `layouts` table (Pinia)       │
│  stores/short-links.ts      ← Creates ?s= links (Pinia); creation only    │
│  utils/supabase-loader.ts   ← Lazy import('@supabase/supabase-js')        │
│  utils/short-links.ts       ← ?s= parsing + raw-fetch resolution          │
│  utils/auth-return-url.ts   ← Keeps #share= across the OAuth round trip   │
│  utils/zip.ts               ← Stored-entry ZIP writer for "Download all"  │
│  config/supabase.ts         ← Env vars, isAuthConfigured(), test user     │
│  config/deployment.ts       ← local / preview / production build identity │
└───────────────┬───────────────────────────────────────┬───────────────────┘
                │ GoTrue  /auth/v1                      │ PostgREST /rest/v1
                │ (PKCE OAuth, session refresh)         │ (JWT as `authenticated`)
                ▼                                       ▼
┌──────────────────────────── Supabase project ─────────────────────────────┐
│  auth.users                     ← identities owned by GoTrue              │
│      │ on delete cascade                                                  │
│      ▼                                                                    │
│  public.layouts                 ← id, user_id, name, payload, timestamps  │
│  ├── RLS: layouts_{select,insert,update,delete}_own                       │
│  ├── trigger layouts_enforce_quota   (BEFORE INSERT → layout_quota() = 5) │
│  └── trigger layouts_set_updated_at  (BEFORE UPDATE)                      │
│  public.layout_quota()          ← RPC; the client reads the limit from it │
│                                                                           │
│  public.short_links             ← id, hash, payload, created_by, timestamp│
│  ├── no policies, no grants — reachable only via the two functions        │
│  ├── public.create_short_link() ← SECURITY DEFINER; authenticated only    │
│  └── public.resolve_short_link()← SECURITY DEFINER; anon may execute      │
└───────────────────────────────────────────────────────────────────────────┘
```

Saved layouts are stored as **lz-string-compressed KLE**, byte-for-byte the same encoding a
`#share=` URL carries (`encodeLayoutToUrl` in `utils/url-sharing.ts`). Nothing about the storage
format is new, which is why a saved row can be rendered as a thumbnail, loaded into the editor, or
exported as ordinary KLE JSON without a bespoke codec.

## Supabase Integration

### Configuration (`src/config/supabase.ts`)

Two environment variables, both required:

| Variable                 | Purpose                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`      | Project URL, e.g. `https://<ref>.supabase.co` or a local stack URL |
| `VITE_SUPABASE_ANON_KEY` | Anon / publishable key                                             |

`readConfig()` returns `null` unless **both** have values, and additionally returns `null` when
`import.meta.env.PROD` is set and the URL starts with `http://` (logging
`Supabase URL must use HTTPS in production — accounts disabled`). The result is memoised in
`cachedConfig`; `resetSupabaseConfigCache()` is the test seam that forgets it.

The anon key is public by design — it identifies the project and grants nothing on its own. It is
committed to `.env.production` for that reason. The **service-role key must never appear in any
client-side file**.

Exports:

- `getSupabaseConfig(): SupabaseConfig | null` — memoised `{ url, anonKey }`.
- `isAuthConfigured(): boolean` — the gate every account surface checks.
- `isLocalSupabase(): boolean` — true when the configured hostname is `localhost`, `127.0.0.1`, or
  `[::1]`.
- `getTestUser(): TestUserCredentials | null` — see [Test-user shortcut](#test-user-shortcut). The
  only way to the credentials; components read `auth.canUseTestUser` rather than calling it.
- `AUTH_STORAGE_KEY = 'kle-ng-auth'` — the localStorage key the session is persisted under.

`AUTH_STORAGE_KEY` is set explicitly rather than left to supabase-js's
`sb-<project-ref>-auth-token` default, precisely so the auth store can probe localStorage for an
existing session **without** loading supabase-js first.

### Lazy loading (`src/utils/supabase-loader.ts`)

`getSupabaseClient()` follows the same shape as `three-loader.ts` / `makerjs-loader.ts`: a singleton
`loadedClient`, a shared in-flight `loadingPromise`, a 30 s timeout (`LOAD_TIMEOUT_MS`), and a
`.finally()` that clears the promise when the load failed so a retry is possible. It throws
`Supabase is not configured` when `getSupabaseConfig()` is null, so callers are expected to gate on
`isAuthConfigured()` first.

The point of the indirection is bundle weight: **an anonymous visitor never downloads supabase-js**.
The auth store only reaches for the client when there is a persisted session, an OAuth callback to
finish, or a deliberate sign-in click.

The client is created with:

```ts
createClient(config.url, config.anonKey, {
  auth: {
    flowType: 'pkce',
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    storageKey: AUTH_STORAGE_KEY,
  },
})
```

`flowType: 'pkce'` is **mandatory here, not a preference**. PKCE returns the session as a `?code=`
query parameter; the implicit flow would return `#access_token=…` in the fragment, which is exactly
where the editor already keeps `#share=` / `#url=` / `#gist=`. The two would collide head-on.

`resetSupabaseClient()` drops the cached client; it exists as a test seam.

### Graceful degradation

| Condition                                | Behaviour                                                             |
| ---------------------------------------- | --------------------------------------------------------------------- |
| Env vars unset                           | `AccountMenu` renders the theme picker only; no supabase-js           |
| Configured, signed out                   | Menu offers "Continue with GitHub"; no **My Layouts** button          |
| Configured, signed in                    | Avatar in the header, **My Layouts** in the toolbar                   |
| `http://` URL in a production build      | Config rejected, accounts disabled, error logged                      |
| `layoutsStore` called while unconfigured | `client()` throws `Accounts are not configured`, surfaced as an error |

## Auth Flow

GitHub is the only provider enabled on the Supabase side and the only one offered in
`AccountMenu.vue`. The `AuthProvider` type is `'github' | 'google'`, so re-adding Google is one menu
entry plus dashboard configuration — the store already accepts it.

```
┌────────────────────────────┐
│ User clicks                │
│ "Continue with GitHub"     │
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│ authStore.signIn('github') │
│ 1. captureReturnUrl()      │  → sessionStorage['kle-ng-auth-return'] = location.href
│ 2. signInWithOAuth({       │
│      redirectTo: origin    │
│        + pathname })       │  ← no fragment: providers match an exact registered URL
└─────────────┬──────────────┘
              │ browser leaves the page
              ▼
   github.com  →  <project>/auth/v1/callback  →  back to the editor with ?code=…
              │
              ▼
┌────────────────────────────┐
│ main.ts (before createApp) │
│ restoreReturnUrl()         │  → puts #share= back, leaves ?code= alone
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐      ┌──────────────────────────────┐
│ App.vue onMounted          │      │ keyboardStore startup        │
│ authStore.initialize()     │      │ initWithSample() reads the   │
│ • getSupabaseClient()      │      │ restored fragment — it       │
│ • getSession() ⇒ PKCE      │      │ knows nothing about auth     │
│   exchange happens here    │      └──────────────────────────────┘
│ • applySession()           │
│ • subscribe()              │
│ • clearAuthParamsFromUrl() │
└────────────────────────────┘
```

### Why `auth-return-url.ts` exists

The editor carries state in the URL **fragment**. A fragment does not survive an OAuth round trip:
providers redirect to an exact registered URL and the fragment is dropped along the way. So the full
location is stashed in `sessionStorage` under `kle-ng-auth-return` before leaving, and reinstated the
moment we come back.

`restoreReturnUrl()` runs from `main.ts` **before `createApp()`**, so the keyboard store observes the
restored fragment during its ordinary startup path and needs no knowledge of auth at all.

| Function                         | Behaviour                                                                   |
| -------------------------------- | --------------------------------------------------------------------------- |
| `captureReturnUrl(href?)`        | Stores `location.href` in sessionStorage; silently no-ops if storage throws |
| `hasAuthCallbackParams(search?)` | True when the query has `code` or `error`                                   |
| `restoreReturnUrl()`             | Reinstates the saved fragment via `history.replaceState`                    |
| `clearAuthParamsFromUrl()`       | Deletes `code`, `state`, `error`, `error_code`, `error_description`         |
| `readAuthCallbackError(search?)` | `error_description` → `error` → `'Sign-in failed'`, or null                 |

The edge cases the tests in `src/utils/__tests__/auth-return-url.spec.ts` pin down:

- A `#share=` fragment is restored **and the `?code=` query survives** — supabase-js still has to
  exchange it.
- `#url=` and `#gist=` are restored the same way.
- On a normal page load (no `code`/`error`) nothing is touched, so history is never disturbed.
- If the callback URL already carries a fragment of its own, the saved one does **not** clobber it.
- The stored value is consumed (`removeItem`) so a later load cannot resurrect a stale fragment.
- Nothing captured, or `sessionStorage` unavailable (privacy modes), must not throw.
- `clearAuthParamsFromUrl()` preserves unrelated query parameters and the fragment, and leaves a
  clean URL untouched.

### Session lifecycle

`initialize()` (called once from `App.vue`'s `onMounted`) is deliberately cheap for the common case:

1. Returns immediately if already initialized or unconfigured.
2. If `readAuthCallbackError()` finds a provider error, clears the params, shows a
   `Sign-in Failed` toast, and returns — **without loading supabase-js**.
3. If there is neither a callback (`hasAuthCallbackParams()`) nor a persisted session
   (`hasPersistedSession()`, a raw `localStorage.getItem(AUTH_STORAGE_KEY)` probe), returns —
   again without loading supabase-js.
4. Otherwise loads the client and calls `supabase.auth.getSession()`. That call awaits the client's
   own initialization, which is what performs the PKCE code exchange when `detectSessionInUrl`
   spots `?code=`.
5. `applySession()` mirrors the session into `user`, `subscribe()` attaches
   `onAuthStateChange`, and `clearAuthParamsFromUrl()` runs in `finally`.

Token refresh is handled by supabase-js (`autoRefreshToken`), and refreshes arrive in the store
through the same `onAuthStateChange` subscription. `getAccessToken()` re-reads the session and
returns `data.session?.access_token ?? null`. Nothing calls it yet — it is deliberately kept for the
share-link service in a later phase (`notes/user-accounts-plan.md`), since everything stored today
goes through PostgREST, which supabase-js authenticates itself. Its doc comment says so, so a
dead-code sweep does not remove it blind.

`signOut()` calls `supabase.auth.signOut()`, clears `user`, and toasts. `App.vue` watches
`authStore.isSignedIn` and calls `layoutsStore.reset()` when it goes false, so a second sign-in on
the same device never opens on the previous user's list.

### Test-user shortcut

`getTestUser()` returns credentials **only** when `import.meta.env.DEV` is true _and_
`isLocalSupabase()` is true. Both halves matter: `DEV` is compiled away in a production build (so the
seeded credentials cannot reach a shipped bundle even if someone built against localhost), and no
hosted project can satisfy the local-host half, production included. The credentials are the ones
`supabase/seed.sql` creates — `dev@test.local` / `password123` — and they are not exported;
`getTestUser()` is the only way to them.

`signInAsTestUser()` uses `signInWithPassword`, which does not navigate away, so it applies the
session and subscribes inline. An `invalid login credentials` failure is rewritten into the one
actionable hint that can apply — run `npm run supabase:reset` to seed the account. There is no
second message for a hosted project, because the gate above means a hosted project never reaches
this code. Any other error is surfaced as-is.

Preview deployments used to get their own shared password account via `VITE_TEST_USER_EMAIL` /
`VITE_TEST_USER_PASSWORD`. It was removed because the preview project has password sign-in disabled,
so it could never work; `src/config/__tests__/supabase.spec.ts` has a test asserting those variables
are ignored if something still injects them.

## State Management

### `stores/auth.ts`

Identity is never managed locally: no passwords, no reset flows, no account records. Supabase owns
the handshake; the store mirrors the resulting session into Vue reactivity.

**State**

- `user: AuthUser | null` — the app's own narrower view of a user, so components never import
  Supabase types and the identity provider stays swappable.
- `busy: boolean` — an auth call is in flight.
- `initialized: boolean` — `initialize()` has run.

```ts
interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string
}
```

`toAuthUser()` picks `name` from the first non-empty of `user_name`, `preferred_username`,
`full_name`, `name` in `user_metadata`, falling back to the email and then the literal `'Account'`;
`avatarUrl` comes from `avatar_url` or `picture` (the Google shape).

**Computed:** `isConfigured`, `isSignedIn`, `testUser`, `canUseTestUser`.

**Actions:** `initialize()`, `signIn(provider)`, `signInAsTestUser()`, `signOut()`,
`getAccessToken()`, `cleanup()` (unsubscribes from `onAuthStateChange`).

`busy` is left **set** on `signIn()`'s success path — the browser is meant to leave the page. That is
why `AccountMenu` disables the individual account entries rather than the dropdown trigger; see
[UI Surfaces](#ui-surfaces).

### `stores/layouts.ts`

CRUD against the `layouts` table. **No query here filters by user id, and none needs to** — RLS scopes
every statement to the signed-in user. Likewise, the quota is enforced by a database trigger;
`isFull` exists only so the UI can disable the save button before the round trip.

**State:** `layouts: SavedLayout[]`, `quota` (starts at `DEFAULT_QUOTA = 5`, replaced by the real
value on first fetch), `loading`, `busy`, `loaded`, `errorMessage`.
**Computed:** `count`, `isFull` (`count >= quota`).

```ts
interface SavedLayout {
  id: string
  name: string
  payload: string // lz-string compressed KLE, same as #share=
  createdAt: string
  updatedAt: string
}
```

Rows come back snake_case and are mapped by `toSavedLayout()`. `MAX_NAME_LENGTH = 120` is exported
for the input `maxlength` and mirrors the `layouts_name_length` check constraint;
`MAX_PAYLOAD_LENGTH = 32768` mirrors `layouts_payload_length` the same way.

**Actions**

| Action                    | Notes                                                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetchAll(force = false)` | Reads the quota with `supabase.rpc('layout_quota')`, then selects ordered by `updated_at desc`. Skips when already `loaded` unless forced.            |
| `save(name, payload)`     | `insert({ name: name.trim(), payload })` — **`user_id` is never sent**; the schema defaults it from the JWT. Fails locally past `MAX_PAYLOAD_LENGTH`. |
| `overwrite(id, payload)`  | Thin wrapper over the private `update()`, with the same payload-length pre-check.                                                                     |
| `rename(id, name)`        | Ditto, trimming the name. `updated_at` is never sent — a trigger maintains it.                                                                        |
| `remove(id)`              | `delete().eq('id', id)`.                                                                                                                              |
| `reset()`                 | Drops cached rows; called from `App.vue` on sign-out.                                                                                                 |

`describeError()` turns PostgREST errors into something a user can act on by matching the constraint
and exception names the database raises:

| Database signal          | Message shown                                                        |
| ------------------------ | -------------------------------------------------------------------- |
| `layout_quota_exceeded`  | "You have reached your saved layout limit. Delete one to make room." |
| `layouts_name_length`    | "Name must be between 1 and 120 characters."                         |
| `layouts_payload_length` | "This layout is too large to save."                                  |

### Interaction with the `keyboard` store

`MyLayoutsModal` is the only bridge; the layouts store itself has no dependency on the editor.

- **Save** builds a `Keyboard` from `keyboardStore.keys` / `keyboardStore.metadata` and encodes it
  with `encodeLayoutToUrl()`.
- **Load** decodes the payload, calls `keyboardStore.loadKeyboard()`, sets
  `keyboardStore.filename = layout.name`, then calls `keyboardStore.updateBaseline()` — loading a
  stored layout is not an unsaved change, so the dirty indicator and the `beforeunload` guard stay
  honest. Load is confirmed first if `keyboardStore.dirty`.
- **Name prefill** comes from `keyboardStore.metadata.name` and nothing else. This branch also
  changed `loadKeyboard()` in `stores/keyboard.ts` to clear `filename`, because a filename describes
  the layout being replaced and cannot survive the replacement. (`updateLayoutFromJson` edits the
  open layout rather than replacing it and deliberately does not come through that path, so editing
  the JSON keeps its filename.)

## Database

The schema lives in `supabase/migrations/20260813120000_layouts.sql`.

### Quota function

```sql
create or replace function public.layout_quota()
returns integer language sql immutable set search_path = ''
as $$ select 5; $$;
```

A single source of truth shared by the trigger and the UI — the frontend reads it over RPC rather
than hardcoding `5`.

### Table

```sql
create table public.layouts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid()
                         references auth.users (id) on delete cascade,
  name       text        not null,
  payload    text        not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint layouts_name_length    check (char_length(name) between 1 and 120),
  constraint layouts_payload_length check (char_length(payload) between 1 and 32768)
);

create index layouts_user_id_updated_at_idx on public.layouts (user_id, updated_at desc);
```

`user_id` defaults from the JWT, so the client never sends (or spoofs) it. `on delete cascade` from
`auth.users` means account deletion clears the table. The index matches the store's
newest-first ordering.

### Triggers

**`layouts_enforce_quota` — `BEFORE INSERT FOR EACH ROW`, running `public.enforce_layout_quota()`.**
`SECURITY DEFINER` with `set search_path = ''` and fully qualified names (the standard hardening),
so the count is authoritative rather than whatever the caller's RLS policies happen to expose. It
raises `layout_quota_exceeded` (P0001, surfaced by PostgREST as HTTP 400 with the message intact)
once the user already holds `layout_quota()` rows.

Its early return is the subtle part:

```sql
if current_user_id is null or new.user_id is distinct from current_user_id then
  return new;
end if;
```

`BEFORE ROW` triggers run _before_ the RLS `WITH CHECK`. A trigger that counted rows for an
unverified `new.user_id` would therefore fire on inserts the policy is about to reject — masking the
ownership error, and leaking whether an arbitrary user id has reached their quota (a forged insert
against a full user would raise `layout_quota_exceeded`, against a non-full user `42501`). Those rows
are left to RLS. A null `auth.uid()` means a trusted role (`service_role`, migrations) and is
intentionally not quota-limited.

**`layouts_set_updated_at` — `BEFORE UPDATE FOR EACH ROW`, running `public.layouts_touch_updated_at()`.**
Sets `new.updated_at := now()` and pins `new.created_at := old.created_at`, so a client can rewrite
neither timestamp.

### Row Level Security

`alter table public.layouts enable row level security;` then four policies, all `to authenticated`:

| Policy               | Command  | Expression                                   |
| -------------------- | -------- | -------------------------------------------- |
| `layouts_select_own` | `select` | `using (user_id = (select auth.uid()))`      |
| `layouts_insert_own` | `insert` | `with check (user_id = (select auth.uid()))` |
| `layouts_update_own` | `update` | `using (…)` **and** `with check (…)`         |
| `layouts_delete_own` | `delete` | `using (user_id = (select auth.uid()))`      |

On update, `USING` selects which rows may be updated and `WITH CHECK` additionally blocks
_reassigning_ a row to another user — both are needed. `auth.uid()` is wrapped in a scalar subquery
so the planner evaluates it once per statement as an InitPlan rather than once per row.

### Grants

```sql
revoke all on public.layouts from anon;
grant select, insert, update, delete on public.layouts to authenticated;

revoke all on function public.layout_quota() from public, anon;
grant execute on function public.layout_quota() to authenticated;

revoke all on public.short_links from anon, authenticated;

revoke all on function public.create_short_link(text) from public, anon;
grant execute on function public.create_short_link(text) to authenticated;

revoke all on function public.resolve_short_link(text) from public;
grant execute on function public.resolve_short_link(text) to anon, authenticated;

revoke all on function public.short_link_rate_limit() from public, anon, authenticated;
revoke all on function public.short_link_id()         from public, anon, authenticated;
```

The two helpers are granted to nobody. `create_short_link` is `SECURITY DEFINER`, so it runs as the
owner and never consults the caller's privileges to call them — a grant would add no capability the
functions need, and would only publish the rate-limit ceiling to every signed-in client. This is why
`supabase/tests/short-links-verification.sql` reads the ceiling as the owner and stashes it with
`set_config` before assuming a role, rather than calling `short_link_rate_limit()` as `authenticated`.

`anon` is revoked **by name** on purpose: Supabase's `ALTER DEFAULT PRIVILEGES` grants `EXECUTE` on
new public-schema functions to `anon` explicitly, and revoking from the `PUBLIC` pseudo-role does not
remove a named grant. Being explicit also keeps the migration correct on newer projects that grant
nothing by default.

### Short links

The schema lives in `supabase/migrations/20260816120000_short_links.sql`. A short link points at a
stored layout: `https://editor.keyboard-tools.xyz/?s=7kQ2mBx9Lp`. Anyone can open one; only a
signed-in user can create one; they never expire.

```sql
create table public.short_links (
  id         text        primary key,     -- 10 random base62 chars, e.g. '7kQ2mBx9Lp'
  hash       bytea       not null unique,  -- sha256(payload), computed server-side
  payload    text        not null,         -- lz-string compressed KLE, as #share=
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint short_links_id_format      check (id ~ '^[0-9A-Za-z]{8,32}$'),
  constraint short_links_payload_length check (char_length(payload) between 1 and 32768)
);
```

Three properties shape it, and all are load-bearing:

**The table is never selectable.** No role holds a privilege on it and there are no RLS policies —
the only way in or out is `create_short_link()` / `resolve_short_link()`, both `SECURITY DEFINER`.
A `select` grant, even one narrowed by a policy, would let anybody page through every layout anyone
has ever shared. A short link is meant to be unguessable, not enumerable, and "unguessable" is worth
nothing next to a `GET /rest/v1/short_links?select=*`.

**One user column, and it is not ownership.** Creating a link requires a session — `auth.uid()` is
checked _inside_ `create_short_link` at call time — and the caller is recorded in `created_by`, but
only on the row they actually insert. It is an operator's audit trail for attributing abuse, not a
claim on the link: no client role can read it, a dedup hit never reassigns it to the second caller,
and there is deliberately no "my short links" list. Deleting an account is `on delete set null`
rather than a cascade, because removing the row would break a URL other people already hold. Dedup
is keyed on the payload alone, so two users shortening a byte-identical layout still land on the
same id — `created_by` records who got there first and nothing more. `user_id` or `owner_id` would
imply an ownership this table does not have, and `short-links-verification.sql` asserts neither
exists.

**Identity and address are separate columns, deliberately.** `hash` is what a layout _is_ — the
dedup key, so two users shortening a byte-identical layout get one row and one link. `id` is only the
short public label. Because lookup goes through `hash`, the id never has to be recomputed from the
payload, and so it can be **random rather than derived**. That buys three things: no base64 alphabet
in the URL (ids are `[0-9A-Za-z]` only), no prefix-collision ladder, and no way for an outsider to
hash a layout they hold and probe whether it has been shared.

Collapsing the two columns is tempting but wrong. With an id-only table the id must stay derived so
it can be looked up, and if a row is ever deleted by hand — a takedown, say — the next call for a
payload that had lost a prefix race would find nothing at its short id and insert a **second** row
for the same layout. `unique(hash)` makes "one row per layout" a database invariant instead of a
property of the function's control flow.

`create_short_link(payload text)` hashes the payload itself (never trusting a client-supplied hash),
returns the existing id when that hash is already stored — a 32-byte index probe that never reads the
payload — and otherwise inserts under a fresh `short_link_id()`. The insert is a bare `INSERT` inside
an exception block and **not** `on conflict do nothing`: under READ COMMITTED the latter returns no
row and no error without waiting for a concurrent inserter, so the loop would write a second row for
the same payload. On `unique_violation` a lookup by hash distinguishes the two causes — another
transaction stored this payload (return their id) versus a 1-in-2^56 id collision (draw again).

Creation is rate limited per user. `short_link_rate_limit()` returns the ceiling (60) as its own
`IMMUTABLE` function so it can be changed without touching `create_short_link`, and the check runs
only once the call is known to need a new row — a dedup hit costs the caller nothing, so re-sharing
a layout somebody has already shortened is free however often it happens. The budget is a
`count(*)` over the caller's rows from the last rolling hour, served by the partial
`(created_by, created_at desc)` index, rather than a stored counter: that makes it a true sliding
window with nothing that can drift from the rows it describes. Two concurrent calls from one user
can both pass and overshoot slightly, which is the deliberate trade against serialising every
creation per user — the point is to stop bulk abuse, not to account exactly. Exceeding it raises
`short_link_rate_limit_exceeded`, which the client renders as "You have created a lot of short
links recently."

`short_link_id()` takes seven of the sixteen random bytes from `gen_random_uuid()` (core since
PostgreSQL 13, so still no pgcrypto) and base62-encodes them to exactly 10 characters.

`resolve_short_link(link_id text)` is `STABLE` and granted to `anon`. It returns `NULL` for an
unknown id rather than raising — a mistyped URL is a normal outcome, not an error.

### Resolution transport

Resolution is a **raw `fetch`** to `<url>/rest/v1/rpc/resolve_short_link` in
`src/utils/short-links.ts`, not a supabase-js call. Opening a short link is the most common action an
_anonymous_ visitor takes, and it sits on the critical path to first paint; loading supabase-js
(~40–50 KB) to send one POST with two headers would be the first thing to break the
"an anonymous visitor never downloads supabase-js" property that the rest of this page describes.
`getSupabaseConfig()` already returns `{ url, anonKey }` with no supabase-js dependency, so nothing
else is needed. **Creation** goes through `supabase.rpc()` as usual — the user is signed in, so the
client is already loaded.

The `?s=` id is read and stripped **synchronously** at the top of `initWithSample()`, before any
await. `signInWithOAuth()` redirects to `origin + pathname` — dropping the query — and
`restoreReturnUrl()` restores only the fragment, so an id left in the address bar would be lost to a
sign-in.

### Where each rule is enforced

| Rule                                      | Enforced by                                               | Client role                              |
| ----------------------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| You only see your own layouts             | RLS `layouts_select_own`                                  | none — no query filters by user id       |
| You cannot write another's row            | RLS `layouts_insert_own` / `layouts_update_own`           | none                                     |
| Max 5 layouts per user                    | `layouts_enforce_quota` trigger                           | `isFull` disables the button, cosmetic   |
| Name 1–120 chars                          | `layouts_name_length` check                               | `maxlength` on the input, cosmetic       |
| Payload ≤ 32768 chars                     | `layouts_payload_length` check                            | `MAX_PAYLOAD_LENGTH` pre-check, cosmetic |
| `updated_at` / `created_at`               | `layouts_set_updated_at` trigger                          | never sent                               |
| `user_id`                                 | column default `auth.uid()`                               | never sent                               |
| Only signed-in users make short links     | `auth.uid()` check in `create_short_link`                 | the caret is hidden, cosmetic            |
| Nobody can list shared layouts            | no table grant, no policy on `short_links`                | none                                     |
| A short link id maps to one layout        | `short_links.hash` unique + server-side sha256            | never sends a hash                       |
| Max 60 new short links per user, per hour | rolling `count(*)` on `created_by` in `create_short_link` | none — surfaced as a toast               |

Note that the quota counts **inserts only**. Saving over an existing name is an update, so re-saving
work in place stays possible at the limit — which is exactly what `MyLayoutsModal` turns the
**Save current** button into when the typed name matches a saved one.

### RLS verification (`supabase/tests/rls-verification.sql`)

The highest-consequence test in the project: with direct-to-PostgREST writes, these policies are the
only thing standing between one user's layouts and another's. Run it after applying the migrations
and again after **any** policy change.

```sh
psql "$DATABASE_URL" -f supabase/tests/rls-verification.sql
# …or paste it into the Supabase SQL editor
```

Everything happens inside a transaction that ends in `rollback`, so it leaves no trace. Success
prints a single `ALL CHECKS PASSED` notice; any failure aborts with an error. It inserts two users
into `auth.users` and impersonates them with `set local request.jwt.claims` + `set local role
authenticated`, proving:

- **User A** — five inserts succeed with `user_id` defaulted from the JWT, A sees exactly those five,
  and the sixth insert raises `layout_quota_exceeded`.
- **User B** — sees zero of A's rows; a blanket `update` and `delete` affect **0 rows** (RLS filters
  them out, so they are no-ops rather than errors); a forged insert carrying A's `user_id` fails with
  `insufficient_privilege` (42501) and _not_ `layout_quota_exceeded`, which is what proves the quota
  trigger's early return is doing its job; and B can still insert its own layout even though A is
  full, so the quota is per user rather than global.
- **Anonymous** — sees no layouts (or is denied outright, both accepted), and cannot execute
  `public.layout_quota()`, which guards the named-grant revoke described above.

The fixture INSERT into `auth.users` is coupled to GoTrue's schema, which drifts between versions; if
it breaks after a Supabase upgrade, add whatever columns it now demands — the rest of the script is
unaffected.

## Environments

Three environments, each with **its own database**. Nothing shares state. See
`supabase/README.md` for the operational detail.

|                               | Database                      | Config comes from             | Sign-in                     |
| ----------------------------- | ----------------------------- | ----------------------------- | --------------------------- |
| **Local**                     | `supabase start` (Docker)     | `.env.local`                  | seeded test user            |
| **Preview** (Vercel)          | `kle-ng-preview` free project | CI secrets, injected at build | `kle-ng-preview` OAuth only |
| **Production** (GitHub Pages) | `kle-ng` free project         | `.env.production`             | `kle-ng` OAuth only         |

Supabase free plans allow two active projects per organisation, so production + preview fits exactly.
Branching would be tidier but requires Pro.

Note the topology: production is **GitHub Pages** (a static build), Vercel hosts **previews only**,
and the PCB backend is a separate service entirely — see [PCB Generator](./pcb-generator.md).

### Local stack

```sh
npm run supabase:start     # boots Postgres + Auth + Studio, applies migrations
npm run supabase:status    # prints URLs and keys again
npm run supabase:reset     # wipes and re-applies migrations from scratch
npm run supabase:stop
```

From `supabase/config.toml`: API on `54321`, Postgres on `54322` (major version 17), Studio on
`54323`, the local mail catcher on `54324`. `[db.migrations]` and `[db.seed]` are both enabled, with
`sql_paths = ["./seed.sql"]`, so migrations _and_ the seed apply automatically on `start` and
`reset`. `site_url` is `http://localhost:5173` and `additional_redirect_urls` covers `5173`
(`npm run dev`) and `4173` (`npm run preview` / the CI e2e build).

`[auth.external.github]` is **`enabled = false`** locally by default, so a fresh clone starts without
credentials. To use real GitHub sign-in locally, register a _second_ GitHub OAuth App with callback
`http://127.0.0.1:54321/auth/v1/callback`, export
`SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`, flip `enabled` to
true, and restart. Otherwise use the seeded email/password account, which is enabled locally
(`[auth.email] enable_signup = true`, `enable_confirmations = false`).

`.env.local` is gitignored, so a fresh clone starts from the committed `.env.local.example`
(`cp .env.local.example .env.local`). It holds `VITE_SUPABASE_URL=http://127.0.0.1:54321` plus the
anon key — the template carries the one a stock local stack issues; replace it if `supabase:start`
prints something else. Until both have values accounts stay disabled — a half-configured checkout
can never silently fall through to production.

### Preview (Vercel)

`.github/workflows/vercel-preview.yml` injects the Supabase variables **unconditionally**, and
deliberately so: `vercel build` runs in production mode and would otherwise read `VITE_SUPABASE_*`
straight out of `.env.production`, pointing every preview at the live database. Process env beats
`.env` files in Vite, so these always win — and on fork PRs, where the secrets are absent, they
resolve to empty, which _disables_ accounts rather than leaking production credentials.

```yaml
VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL_PREVIEW }}
VITE_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY_PREVIEW }}
VITE_DEPLOY_ENV: preview
VITE_GIT_COMMIT_SHA: ${{ github.event_name == 'pull_request_target'
  && github.event.pull_request.head.sha || github.sha }}
```

### `config/deployment.ts`

Which build is running is decided at build time, from variables **only the preview workflow sets**:

```ts
export const deploymentEnv: DeploymentEnv =
  import.meta.env.VITE_DEPLOY_ENV === 'preview'
    ? 'preview'
    : import.meta.env.DEV
      ? 'local'
      : 'production'
```

The GitHub Pages production build leaves both unset, so it resolves to `'production'` and behaves as
it did before these variables existed. Derived exports:

- `isPreviewDeployment` — drives the warning strip under the header in `App.vue`.
- `deploymentLabel` — `null` on production; otherwise the word stamped across the navbar brand (via
  `:data-deployment` and a CSS pseudo-element) and prefixed to `document.title` in `main.ts`.
- `commitSha` / `shortSha` / `commitUrl` — make `AppFooter` link the version to the exact commit on
  preview builds (`v1.2.3 (abc1234)`) instead of the release tag.
- `PRODUCTION_URL` / `GITHUB_REPO_URL`.

This file is about **build identity**, not about which Supabase project is used — that is decided
solely by the injected `VITE_SUPABASE_*` values. Nothing in the auth code branches on
`deploymentEnv`; the test-user shortcut keys off `import.meta.env.DEV` and `isLocalSupabase()`
instead.

### Applying migrations to hosted projects

Only the local stack applies migrations automatically. For **both** hosted projects:

```sh
npx supabase link --project-ref <project-ref>
npx supabase db push
```

`seed.sql` never runs against a hosted project, so no test user exists in preview or production.

## UI Surfaces

### `AccountMenu.vue` — header dropdown

Mounted in `App.vue`'s header `<nav>`, next to `KeyboardToolbar` (it replaced the removed
`ThemeToggle.vue`, absorbing the theme picker). Because it now owns the theme setting, **it renders
whether or not accounts are configured** — otherwise a build without Supabase env vars would have no
way to change the theme at all.

- Trigger: avatar when signed in with an `avatarUrl`, otherwise a person icon. It is deliberately not
  a `.btn` — the avatar is already a circle. The account is identified through `triggerLabel`
  (`title` + `aria-label`, e.g. `Settings — signed in as adamws`) rather than on screen.
- Theme first (Light / Dark / Auto), because it is the only entry every visitor can use.
- `v-if="auth.isConfigured"`: **Sign out** when signed in; otherwise a "Sign in to save layouts"
  header with **Continue with GitHub**, plus **Continue as test user** when `auth.canUseTestUser`.
- `auth.busy` disables the **account entries**, not the trigger — `signIn()` leaves `busy` set on its
  success path, so a bfcache restore after a back-navigation would otherwise come back with theme
  switching permanently unavailable.

### `MyLayoutsModal.vue` — the layout manager

The **My Layouts** button lives in `KeyboardToolbar.vue` behind `v-if="authStore.isSignedIn"`, and
the modal is mounted there too (not in `App.vue`, alongside the other toolbar modals). Opening it
sets `saveName` from the layout metadata, clears any pending state, and calls `store.fetchAll(true)`.

- **Save row** — name input (`maxlength` = `MAX_NAME_LENGTH`) and a button that reads **Save current**
  or **Update** depending on `existingByName` (case-insensitive, whitespace-trimmed match against the
  saved names). `canSave` also gates on `store.loading`, because until the refetch lands the list is
  empty or stale and a name would be matched against it wrongly. Updating asks for confirmation
  **inside the matching row**, so it is obvious which layout is about to change.
- **Rows** — `LayoutThumbnail` + name + `"N keys · updated <date>"`, with **Load** / rename / delete.
  Load asks "Discard unsaved changes?" only when `keyboardStore.dirty`. Confirmation prompts take the
  description's line rather than sitting among the buttons, so row height and column widths hold.
- **Quota warning** — shown only once `store.isFull`, naming `store.quota` (the value read from the
  database, not a hardcoded 5).
- **Escape** backs out of the innermost interaction first: pending confirmation → rename → close.
- Decoded payloads are cached in a `Map` keyed by layout id, invalidated on save/overwrite/delete. A
  payload that will not decode yields `null`, and the row degrades to a placeholder with **Load**
  disabled rather than taking the whole list down.

### `LayoutThumbnail.vue`

Draws the layout from its payload rather than from a stored image, reusing the headless
`LayoutPreviewRenderer` that drives the QMK/VIA import preview. One renderer per instance —
`LayoutPreviewRenderer` owns and reuses a single canvas, so instances cannot be shared between rows.
A `ResizeObserver` re-draws on layout changes and disposal happens in `onBeforeUnmount`.

### Download all (`utils/zip.ts`)

The modal footer offers **Download all**: every saved layout as one ZIP of ordinary `.json` files,
each entry byte-identical to what "Export → Download JSON" produces for that layout, so restoring one
is an ordinary import. A layout whose payload will not decode is skipped and counted in the toast
rather than failing the whole download.

`utils/zip.ts` is a small hand-written ZIP writer — **stored (uncompressed) entries only** — rather
than a dependency, since the archives are a handful of small text files. Not implemented, because
nothing needs it: compression methods other than store, data descriptors, encryption, directory
entries, and ZIP64. That last one bounds the format, so `createZip()` throws a `RangeError` rather
than emitting an archive whose central directory disagrees with its contents (`> 65535` entries, or
any entry / the archive at 4 GiB or more). Entry names are flagged UTF-8 (general-purpose bit 11) so
non-ASCII layout names survive, and timestamps are written in MS-DOS form; passing an explicit
`modified` date makes the output byte-for-byte reproducible.

Name handling in the modal: `toEntryStem()` replaces the characters Windows reserves
(`< > : " / \ | ? *` and C0 controls) and never returns an empty stem; `toEntryName()` suffixes
`(2)`, `(3)`… until names are unique, compared case-insensitively because the target filesystems
generally are. The archive is named `kle-ng-layouts-YYYY-MM-DD.zip`.

## Testing

### Unit tests

| Spec                                                | Covers                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/config/__tests__/supabase.spec.ts`             | Both env vars required, HTTPS enforced in PROD only, local-instance detection, the DEV + local gate on the test user, `VITE_TEST_USER_*` ignored, memoisation                                                                                           |
| `src/stores/__tests__/auth.spec.ts`                 | `initialize()` no-ops when unconfigured and **does not load supabase-js for an anonymous visitor**, session restore, PKCE exchange + URL cleanup, provider errors, run-once, metadata fallbacks, `signIn`/`signInAsTestUser`/`signOut`/`getAccessToken` |
| `src/stores/__tests__/layouts.spec.ts`              | snake_case mapping, quota read over RPC, fetch caching, insert without `user_id`, quota-error translation, scoped update/delete, `isFull`, `reset()`                                                                                                    |
| `src/utils/__tests__/short-links.spec.ts`           | Id validation, `?s=` build/take/clear (preserving `?code=` and the fragment), and the raw-fetch resolver: request shape, 200+`null` for an unknown id, 404 as a missing function, and that supabase-js is never loaded                                  |
| `src/stores/__tests__/short-links.spec.ts`          | RPC call shape, every `describeError()` branch, `busy` lifecycle, re-entrancy, oversized payload short-circuit, unconfigured                                                                                                                            |
| `src/stores/__tests__/keyboard-short-links.spec.ts` | `loadFromShortLink()` success / unknown id / resolver failure / decode guards, and the startup dispatch including `#share=` winning over `?s=`                                                                                                          |
| `src/utils/__tests__/auth-return-url.spec.ts`       | The fragment/callback edge cases listed under [Auth Flow](#auth-flow)                                                                                                                                                                                   |
| `src/utils/__tests__/zip.spec.ts`                   | CRC-32 vectors, central-directory round-trip, store + UTF-8 flags, MS-DOS timestamps, reproducibility, empty archive, entry-count guard                                                                                                                 |
| `src/components/__tests__/AccountMenu.spec.ts`      | Theme entries present even unconfigured and reachable while `busy`, GitHub entry, test-user entry hidden unless available, avatar-only identification with the name only in the accessible label                                                        |
| `src/components/__tests__/MyLayoutsModal.spec.ts`   | Name prefill rules, quota messaging, row actions, save-vs-update behaviour (including waiting for the refetch), and the whole Download-all path                                                                                                         |

`auth.spec.ts` and `layouts.spec.ts` mock `@/config/supabase` and `@/utils/supabase-loader` with
`vi.hoisted()` and hand a fake client to `getSupabaseClient`, so no test ever touches a real project.
`MyLayoutsModal.spec.ts` additionally mocks `@/utils/zip` — the archive bytes are `zip.spec.ts`'s
problem; what matters there is which layouts get packed, under what names, with what contents.

```sh
npm run test:unit
```

### `vitest.setup.ts`

Gained a `matchMedia` stub alongside the existing `ResizeObserver` one. jsdom does not implement
`matchMedia`, and `useTheme()` queries `prefers-color-scheme` as soon as any component using it
mounts — which, now that the theme picker lives inside `AccountMenu`, includes the account tests.

### SQL tests

`supabase/tests/rls-verification.sql` is not wired into `npm test`; run it by hand against a running
stack. With the local stack up, the connection string comes from `npm run supabase:status`:

```sh
npm run supabase:start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/tests/rls-verification.sql
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f supabase/tests/short-links-verification.sql
```

`psql` is the PostgreSQL client binary and is **not** an npm package — `npx psql` installs an
unrelated module of that name and fails. If it is not on your PATH, run it inside the database
container the local stack is already running (`project_id = "kle-ng"` in `supabase/config.toml`
names it), which also guarantees a client matching the server version:

```sh
docker exec -i supabase_db_kle-ng psql -U postgres -d postgres \
  < supabase/tests/short-links-verification.sql
```

Otherwise install it: `apt-get install postgresql-client` (Debian/Ubuntu), `pacman -S postgresql`
(Arch), `brew install libpq` (macOS). For a hosted project, paste the file into the Supabase SQL
editor instead.

Look for `NOTICE: ALL CHECKS PASSED`. Run them against the hosted projects too after pushing a
migration that touches policies or grants.

`short-links-verification.sql` proves the grant surface rather than policy behaviour, since
`short_links` has no policies: neither `anon` nor `authenticated` may select the table, `anon` can
resolve but not create, two users shortening the same payload get one id and one row, the per-user
hourly limit rejects the call after it, and `created_by` is the table's only user column — set to
whoever inserted the row, never reassigned by a later dedup hit, and unreadable by any client role.

Both scripts run entirely inside a transaction that is rolled back, so they leave no rows behind,
and they are safe to run against a stack that already holds real data: every row assertion is
scoped to the test's own freshly-inserted users rather than counting the whole table. Two things are
worth knowing when editing them. Any statement that trips a privilege error aborts the whole
transaction, so a check that reads `short_links` must run as the owner, before the script assumes a
client role — an error there costs you every check that follows, not just its own. And `now()` is
the transaction timestamp, so time cannot be made to pass; the rolling window is exercised by
backdating `created_at`, which is the value the window predicate actually reads.

## Extending & Gotchas

- **Adding a provider.** `AuthProvider` already allows `'google'`, and `toAuthUser()` already reads
  Google's `picture` / `full_name` metadata. Enabling it is one entry in `AccountMenu.vue` plus
  dashboard configuration on both hosted projects (and `[auth.external.google]` in `config.toml` for
  local).
- **Never switch off PKCE.** The implicit flow returns `#access_token=…`, which collides with the
  editor's `#share=` / `#url=` / `#gist=` fragments. This is the reason `auth-return-url.ts` exists in
  the shape it does.
- **Changing the quota** means editing `layout_quota()` and re-pushing the migration to every
  environment. Do not hardcode the number in the client — read it via `rpc('layout_quota')`.
  `DEFAULT_QUOTA` in the store is only a pre-fetch placeholder.
- **Never filter by `user_id` in the client, and never send it.** RLS scopes reads and writes; the
  column defaults from the JWT. Adding a client-side filter would create the impression that the
  client is doing security work it is not.
- **Any policy change requires re-running `rls-verification.sql`.** Also re-run it after a Supabase
  upgrade, since the fixtures write into GoTrue's `auth.users` directly.
- **Adding a new user-facing constraint** means adding a matching branch in `describeError()`, or the
  user will see a raw PostgREST message.
- **`payload` is capped at 32768 characters** of lz-string-compressed KLE. Very large layouts fail
  with "This layout is too large to save." The store checks `MAX_PAYLOAD_LENGTH` before writing so
  the failure is local, but that is only a fast path — `layouts_payload_length` is still the real
  limit, and `describeError()` still translates it. Changing the cap means editing both.
- **`busy` stays true after `signIn()` succeeds** — the page is expected to navigate away. Anything
  new that keys off `auth.busy` must tolerate that, the way `AccountMenu` does.
- **Short links: never grant `select` on `short_links`.** The table has no policies because it has
  no privileges. One `select` grant turns unguessable ids into an enumerable index of every layout
  anyone has ever shared. Read and write only through the two `SECURITY DEFINER` functions.
- **`create_short_link` must not use `on conflict do nothing`.** Under READ COMMITTED it returns no
  row and no error without waiting for a concurrent inserter of the same payload, so the function
  would draw a new id and write a second row for the same hash. The bare `INSERT` inside an exception
  block is load-bearing, as is the lookup-by-hash that tells a payload race apart from an id
  collision.
- **`create_short_link`'s parameter must stay named `payload`** — it is the JSON body key PostgREST
  expects. Renaming it is an API break.
- **`?s=` is consumed synchronously** at the top of `initWithSample()`. Do not "fix" its loss across
  sign-in by adding `s` to `AUTH_PARAMS` or by making `restoreReturnUrl()` restore the query — that
  would resurrect a consumed id and reload the layout over the user's edits after every sign-in.
- **Short link ids must stay random, not derived from the payload.** Deriving them would let anyone
  holding a candidate layout compute its id and probe whether it has been shared. Dedup goes through
  `hash` precisely so the id does not have to be reproducible. A signed-in user can still learn that
  _somebody_ already shared a layout by shortening it and getting an existing id back; that is
  inherent to "same layout, same link" and is accepted.
- **Migrations are not applied to hosted projects by CI.** `npx supabase db push` against preview
  _and_ production is a manual step whenever a migration lands.
- **`.env.local` is gitignored; `.env.local.example` is the committed template.** A fresh clone has
  no Supabase configuration until someone runs `cp .env.local.example .env.local` — which is a safe
  default either way, since accounts simply stay off. Keep the template in step with any new
  `VITE_` variable the local stack needs, and never put a hosted project's URL in it.
- **The seed writes into `auth.users` directly**, which couples it to GoTrue's schema. Several token
  columns must be `''` and not `NULL` — GoTrue scans them into non-nullable Go strings, and a `NULL`
  makes every read of the row fail with "Database error querying schema".

## Related documentation

- [Development Setup](./development-setup.md) — running the editor locally.
- [PCB Generator](./pcb-generator.md) — the other optional, env-gated integration; `config/api.ts`
  is the pattern `config/supabase.ts` follows.
- [Layout Export](./layout-export.md) — the serialization that "Download all" reuses.
- `supabase/README.md` — operational runbook for the three environments.
