# PCB Generator

The PCB Generator turns a VIA-annotated KLE layout into a complete KiCad project — a routed
`.kicad_pcb`, matching schematic sheet(s), footprint libraries, and SVG previews — packaged as a
downloadable ZIP. Unlike the [Plate Generator](./plate-generator.md), which runs entirely in the
browser, PCB generation is a **server-side** job: the client submits the layout and settings to a
backend, polls for progress, and displays the rendered result. The heavy lifting (footprint
placement, routing, KiCad file emission) is done by [kbplacer](https://github.com/adamws/kicad-kbplacer)
and `kicad-cli` running inside worker containers.

The backend lives in a separate repository, [`kle-ng-api`](https://github.com/adamws/kle-ng-api).
This document covers both sides: the browser client (`kle-ng`) and the Go/KiCad backend
(`kle-ng-api`).

## Architecture Overview

```
┌─────────────────────────── Browser (kle-ng) ──────────────────────────────┐
│  PcbGeneratorPanel.vue          ← Entry point, tabbed 2-column layout     │
│  ├── PcbGeneratorSettings.vue    ← [Switches tab] switch/stab/diode/route │
│  ├── PcbLedSettings.vue          ← [LEDs tab] per-key LED chain settings  │
│  ├── PcbJsonView.vue             ← [JSON tab] CodeMirror settings editor  │
│  ├── PcbGeneratorControls.vue    ← Generate button, validation gating     │
│  ├── PcbDownloadButton.vue       ← ZIP download (time-limited)            │
│  ├── PcbGeneratorResults.vue     ← Progress bar / renders / errors        │
│  │   ├── PcbRenderViewer.vue     ←   Tabbed SVG viewer (schematic + PCB)  │
│  │   └── PcbBuildLog.vue         ←   Live build-log terminal (WebSocket)  │
│  ├── PcbWorkerStatus.vue         ← Backend availability indicator         │
│  └── PcbSettingsModal.vue        ← Custom backend URL override            │
│                                                                           │
│  stores/pcbGenerator.ts          ← State, task lifecycle, polling (Pinia) │
│  utils/pcbApi.ts                 ← Fetch wrapper: retries, CORS, errors   │
│  utils/pcb-encoder.ts            ← VIA rotary-encoder → sm="rot_ec11"     │
│  utils/pcb/pcb-settings-serializer.ts  ← PcbSettings ↔ PcbSettingsJson    │
│  utils/pcb/pcb-settings-validator.ts   ← JSON editor / localStorage load  │
│  config/api.ts                   ← Backend URL resolution, endpoints      │
│  types/pcb.ts                    ← Shared type definitions                │
└───────────────────────────────────────────┬───────────────────────────────┘
                                            │ HTTPS (JSON)
                                            ▼
┌──────────────────────── Backend (kle-ng-api) ─────────────────────────────┐
│  cmd/server (Go, gorilla/mux)   ← REST API, CORS, rate limit, Filer proxy │
│      │ enqueue (asynq → Redis)                                            │
│      ▼                                                                    │
│  cmd/worker (Go, asynq consumer)                                          │
│  └── internal/kicad/kicad.go     ← NewPCB(): orchestrates a build         │
│          │ exec                                                           │
│          ├── python3 -m kbplacer ← placement + routing + sch/pcb emit     │
│          └── kicad-cli export svg ← front/back PCB + per-sheet schematic  │
│      │ upload (multipart)                                                 │
│      ▼                                                                    │
│  SeaweedFS Filer (S3)            ← result.zip + SVG renders (1h TTL)      │
└───────────────────────────────────────────────────────────────────────────┘
```

The server never holds build results itself: workers upload artifacts to a SeaweedFS **Filer**, and
the server streams them back to the client on demand via a proxy handler. Task state lives entirely
in **Redis**, managed by [asynq](https://github.com/hibiken/asynq); there is no application database.

## Data Flow

```
┌─────────────────────────────┐
│  User clicks "Generate PCB" │
│  (PcbGeneratorControls)     │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐   ┌──────────────────────────────┐
│  pcbGeneratorStore          │◄──│  keyboardStore               │
│  .startTask()               │   │  getSerializedData(          │
│  1. Rate-limit (5s cooldown)│   │    'kle-internal')           │
│  2. Validate ≤150 keys      │   └──────────────────────────────┘
│  3. Build PcbApiSettings    │
│  4. applyViaEncoderSwitchMount (mark rot_ec11)
└─────────────┬───────────────┘
              │ POST /api/pcb  { layout, settings }
              ▼
┌─────────────────────────────┐
│  server KicadPostNewTask    │
│  • queue-size rate limit    │
│  • enqueue asynq task       │
│  • return { task_id }       │
└─────────────┬───────────────┘
              │ 202 Accepted, task_id
              ▼
┌─────────────────────────────┐        every 1s
│  store startPolling()       │◄───────────────────┐
│  GET /api/pcb/{task_id}     │                    │
└─────────────┬───────────────┘                    │
              │  PENDING / PROGRESS (status only)  │
              └────────────────────────────────────┘
              │  SUCCESS
              ▼
┌─────────────────────────────┐        ┌────────────────────────────┐
│  worker HandleGenerate...   │───────►│  kicad.NewPCB()            │
│  0% → 10% → 50% → 100%      │        │  kbplacer + kicad-cli      │
│  reportProgress() to Redis  │        │  → workDir + ProjectFiles  │
└─────────────┬───────────────┘        └────────────────────────────┘
              │ UploadToStorage() → Filer (zip + SVGs)
              ▼
┌─────────────────────────────┐
│  store fetchRenders()       │
│  • read files manifest      │
│  • GET /render/{name} → blob│
│  • startDownloadTimer (1h)  │
└─────────────┬───────────────┘
              ▼
┌─────────────────────────────┐
│  PcbRenderViewer shows the  │
│  schematic + PCB front/back │
│  PcbDownloadButton → /result│
└─────────────────────────────┘
```

### Why VIA annotation is required

The PCB Generator only accepts **VIA-annotated** layouts (every key carries a `row,col` matrix
coordinate). kbplacer needs the matrix to wire the switch–diode network and the row/column buses;
without it there is nothing to route. `PcbGeneratorControls` disables the **Generate PCB** button
unless `keyboardStore.isViaAnnotated` is true, prompting the user to run
**Tools → Add Switch Matrix Coordinates** (see [matrix-annotation.md](./matrix-annotation.md)). It
also blocks generation when `hasInvalidMatrixDuplicates` is true — keys sharing a matrix position
must carry `option,choice` labels per the VIA spec, otherwise the netlist would short two switches
together.

Unlike the Plate Generator, the client does **not** collapse VIA layout options into a superset
before sending. The full annotated layout (including alternative-layout keys) is serialized and sent
as-is; kbplacer handles the matrix on the backend.

## Client File Reference

### Components

| File                       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PcbGeneratorPanel.vue`    | Root container. Two-column layout: tabbed controls (`ScrollableTabs`: Switches / LEDs / JSON) on the left, the results pane on the right. Renders a **"Backend Not Configured"** warning instead of the UI when `isBackendConfigured()` is false. Calls `pcbStore.cleanup()` on unmount.                                                                                                                                                                                                                                                                                                                                   |
| `PcbGeneratorSettings.vue` | [Switches tab] Selects switch footprint, stabilizer footprint (or None), switch rotation, diode footprint / rotation / X-Y offset, and routing mode. Footprint values are the kbplacer `lib:footprint` templates (with `{:.2f}u` size placeholders). Diode offsets use `CustomNumberInput` (mm).                                                                                                                                                                                                                                                                                                                           |
| `PcbLedSettings.vue`       | [LEDs tab] Per-key SK6812MINI-E LED-chain settings. A master **enable** checkbox drives `createLedSchFile`; an **add decoupling capacitors** checkbox is the positive-form UI over `skipLedDecoupling`. LED and capacitor footprint / rotation / side / offset fields stay visible but disabled when not applicable.                                                                                                                                                                                                                                                                                                       |
| `PcbJsonView.vue`          | [JSON tab] CodeMirror editor over the grouped `PcbSettingsJson` form. Live validation, **Apply** (Ctrl+Enter), **Reset**, **Download** (`pcb-settings.json`), and **Upload**. Mirrors `PlateJsonView` behavior: rebuilds on theme change, syncs from the store only when the editor has no uncommitted edits.                                                                                                                                                                                                                                                                                                              |
| `PcbGeneratorControls.vue` | **Generate PCB** button and, once a task exists, a **New Task** button. Gates generation on submitting state, active task, backend availability, VIA annotation, and matrix-duplicate validity. Surfaces `ApiError.userMessage` in an alert and shows contextual warnings (annotation required, duplicate positions).                                                                                                                                                                                                                                                                                                      |
| `PcbDownloadButton.vue`    | Downloads the result ZIP from `getResultDownloadUrl()` (`/api/pcb/{id}/result`). Visible only while the download is available (`isDownloadAvailable`, i.e. task succeeded and the 1-hour link has not expired).                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PcbGeneratorResults.vue`  | Right-hand output pane. Shows an indeterminate (sliding) progress bar with the current status message while `isTaskActive` — real progress is conveyed by the live build log below it — the tabbed render viewer on success, a failure alert on `isTaskFailed`, or the idle `FootprintPreview` before any task runs.                                                                                                                                                                                                                                                                                                       |
| `PcbRenderViewer.vue`      | Tabbed SVG viewer with independent zoom/pan for schematic vs. PCB views. One tab per schematic sheet (root labelled **Main** for multi-sheet projects, otherwise **Schematic**) followed by **PCB Front** / **PCB Back**, and — when `hasLogs` is set — a trailing **Logs** tab that embeds `PcbBuildLog` so the build output stays accessible after completion. Tabs are keyed by render name so the selection survives task changes.                                                                                                                                                                                     |
| `PcbBuildLog.vue`          | Dark monospace terminal that renders the store's `buildLogs` (one line per entry, optionally prefixed with `[source]`) streamed live over WebSocket. Auto-scrolls on new lines but pauses when the user scrolls up (with a **Jump to bottom** affordance), shows a **live** indicator while streaming, and offers copy-to-clipboard. A `fill` prop makes it grow to fill its container (used inside the viewer's **Logs** tab); by default it uses a fixed-height box. Shown beneath the progress bar while `isTaskActive`, below the failure alert on `isTaskFailed`, and in the render viewer's **Logs** tab on success. |
| `PcbWorkerStatus.vue`      | Backend availability badge. Auto-refreshes `fetchWorkerStatus()` every 30s and shows `idle/total workers available`, a busy warning, or a connection error with a retry button.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `PcbSettingsModal.vue`     | Lets the user override the backend URL for the session (not persisted). Writes through `pcbStore.setBackendUrl()` / `resetBackendUrl()`, which reset cached worker status so the next poll re-checks the new host.                                                                                                                                                                                                                                                                                                                                                                                                         |
| `PcbHelpModal.vue`         | Static help/explanatory modal for the panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### Store

**`stores/pcbGenerator.ts`** — Pinia store owning the entire task lifecycle. Unlike the Plate
Generator store there is no Web Worker or cache; the store is a thin state machine around the REST
API.

**State:**

- `settings: PcbSettings` — Current configuration (footprints, rotations, sides, offsets, LED chain).
  Persisted to `localStorage` under `kle-ng-pcb-settings` (debounced 500ms) via the grouped
  `PcbSettingsJson` format.
- `currentTaskId` / `taskStatus` — The active task id and its latest polled status.
- `renders: RenderViews` — Blob URLs for `front`, `back`, and one `SchematicView` per schematic sheet.
- `buildLogs: BuildLogLine[]` / `isLogStreamActive` — Live build-log lines streamed over
  WebSocket and whether the stream is currently open. The `WebSocket` itself is a non-reactive
  module-scoped variable (`logSocket`), so Vue never proxies it.
- `workerStatus` / `workerStatusError` — Backend capacity snapshot for the status badge.
- `customBackendUrl` — Session-only backend override (null → use env default).
- Download-expiration timers (`downloadExpiresAt`, `countdownTick`, …) driving the 1-hour link window.

**Key computed:**

- `isTaskActive` — status is `PENDING`, `PROGRESS`, or `RETRY`.
- `isTaskSuccess` / `isTaskFailed` — terminal states.
- `isBackendAvailable` — worker status present with `idle_capacity > 0`.
- `isDownloadAvailable` / `downloadTimeRemaining` / `isDownloadExpired` — derived from the expiration
  timestamp; `countdownTick` is voided into these to force per-second reactivity.

**Actions:**

- `startTask()` — Enforces the 5-second submit cooldown, serializes the layout (`kle-internal`
  format), validates key count (`> 0`, `≤ 150`), builds `PcbApiSettings` (LED fields only when
  enabled), applies `applyViaEncoderSwitchMount`, POSTs to `/api/pcb`, stores the returned `task_id`,
  and starts polling. Uses an `AbortController` so a new task cancels an in-flight one.
- `startPolling()` / `pollTaskStatus()` — Polls `/api/pcb/{id}` every 1s. On `SUCCESS` stops polling,
  calls `fetchRenders()`, and starts the download timer. On `FAILURE` stops. Tolerates up to
  `MAX_POLL_FAILURES` (5) transient errors before synthesizing a failure state.
- `fetchRenders()` — Revokes old blob URLs, reads the `files.renders` manifest (falls back to a fixed
  front/back/schematic set for older backends), fetches each render as a blob URL with
  `Promise.allSettled` (individual failures tolerated), buckets them into front / back / schematics,
  and sorts schematics root-first.
- `getResultDownloadUrl()` — Returns the `/api/pcb/{id}/result` ZIP URL.
- `fetchWorkerStatus()` — Populates `workerStatus` / `workerStatusError` for the badge.
- `startLogStream(taskId)` / `stopLogStream()` — Open / close the WebSocket log stream. Called
  from `startTask()` right after `startPolling()`. The server replays the full retained backfill
  from the start of the build on every (re)connect, so each connect **clears** `buildLogs` before
  repopulating to avoid duplicates. An `end` frame closes the socket and marks the stream inactive
  while **keeping** `buildLogs` readable; an unexpected drop triggers a bounded number of reconnects
  (`MAX_LOG_RECONNECTS`, 3) as long as the task is still active. `resetTask()` / `cleanup()` close the
  socket and clear the logs. Streaming is best-effort — a failed connection never affects the task.
- `resetTask()` / `cleanup()` — Stop polling and timers, abort requests, revoke blob URLs, clear state.
- `setBackendUrl()` / `resetBackendUrl()` — Manage the session backend override.
- `applySettings(json)` — Deserialize edited JSON from `PcbJsonView` onto defaults.

**Rate limiting & resilience:** a 5s client-side submit cooldown (`SUBMIT_COOLDOWN_MS`), request
cancellation via `AbortController`, and blob-URL revocation on every re-fetch / reset to avoid memory
leaks.

### Utilities & Config

#### `utils/pcbApi.ts`

The HTTP layer. Exports the `pcbApi` object (`submitTask`, `getTaskStatus`, `getTaskRenderAsBlobUrl`,
`getTaskResultUrl`, `getWorkerStatus`, `getTaskLogsWsUrl`) and the `ApiError` class (carrying a
user-facing `userMessage`). `getTaskLogsWsUrl(taskId)` is a pure URL builder for the log-stream
WebSocket (`${wsBase}/api/pcb/{id}/logs`); the store owns the socket.

- `fetchWithErrorHandling()` wraps `fetch` with a 30s timeout (`API_CONFIG.timeout`), merges caller
  `AbortSignal`s, and maps HTTP status codes to friendly messages (503 → "Server is busy",
  500/502/504 → "Backend server error", 404 → "task may have expired", 400 → server-provided message).
- `withRetry()` retries retriable failures (503/502/504 and network errors) with exponential backoff,
  up to 3 attempts. Applied to submit, render, and worker-status calls; **not** to status polling
  (which is already frequent).

#### `config/api.ts`

Resolves the backend base URL and exposes `ENDPOINTS` (`/api/pcb`, `/api/workers`). `getWsBaseUrl()`
derives a WebSocket base from the effective REST base by swapping the protocol (`http→ws`,
`https→wss`); when the base URL is empty (dev Vite-proxy, same-origin) it falls back to
`location.origin` with its protocol swapped.

- Development: `VITE_BACKEND_URL` unset → empty string (same origin, Vite proxies `/api/*`).
- Production: `VITE_BACKEND_URL` must be set and HTTPS, otherwise the PCB Generator is disabled
  (`isBackendConfigured()` → false, panel shows the "Backend Not Configured" warning).
- A custom URL set via `setCustomBackendUrl()` (from `PcbSettingsModal`) takes precedence and resets
  the cached config.

#### `utils/pcb-encoder.ts`

`applyViaEncoderSwitchMount(layout)` marks VIA rotary encoders so the backend places encoder
footprints. VIA tags an encoder by an `e0`/`e1`/… label at the **center** label position (index `4`
in the 12-element positional `labels` array of the serialized `kle-internal` format). Matching keys
get `sm: "rot_ec11"` — the same discriminator kbplacer's `apply_via_encoder_switch_mount` expects,
and the same value the [Plate Generator uses for EC11 cutouts](./plate-generator.md).
The function operates on the serialized snapshot only (never mutating the user's layout) and returns
the input unchanged when there are no encoders, keeping the common path allocation-free.

#### `utils/pcb/pcb-settings-serializer.ts`

Converts between the flat internal `PcbSettings` (numeric, Pinia-friendly) and the grouped,
minimal `PcbSettingsJson` used by the JSON editor and localStorage. Presence-implies-enabled is the
core convention:

- The `led` section is **omitted entirely** when `createLedSchFile` is false; its presence on
  deserialize implies the feature is on.
- The nested `led.capacitor` section is omitted when decoupling is skipped; its presence implies
  `skipLedDecoupling = false`.
- Diode/LED/capacitor offsets are stored as `offsetX`/`offsetY`; switch/diode/led placement share the
  `footprint`/`rotation`/`side` shape.

`deserializePcbSettings(json, defaults)` fills every missing field from `defaults`, so partial JSON
is always valid.

#### `utils/pcb/pcb-settings-validator.ts`

`validatePcbSettingsJson(text)` parses and structurally validates the grouped format for the JSON
editor and on localStorage load. Returns `{ valid, json, warnings }` or `{ valid, error }`. It
validates placement objects (string footprint, finite numeric rotation/offsets, `FRONT`/`BACK` side),
the `routing` enum, and warns on unknown fields at every level. It **fast-rejects** the legacy flat
format by detecting a top-level `switchFootprint` key.

### Types (`types/pcb.ts`)

- `PcbSettings` — internal flat settings.
- `PcbApiSettings` — the request shape; LED fields are optional and only sent when enabled.
- `TaskRequest` — `{ layout, settings }`.
- `TaskStatusType` — `PENDING | PROGRESS | SUCCESS | FAILURE | RETRY`.
- `RenderFile` / `ProjectFiles` — the file manifest returned in a SUCCESS response.
- `TaskResult` / `TaskStatusResponse` — polling response shape.
- `WorkerDetail` / `WorkerStatusResponse` — `/api/workers` shape.
- `SchematicView` / `RenderViews` — client-side render bookkeeping (blob URLs, per-sheet labels).
- `BuildLogLine` / `BuildLogMessage` — a streamed log line (`{ ts?, source?, line }`) and the union
  of a log line with the terminal `{ event: 'end', status }` frame.

## Backend File Reference (`kle-ng-api`)

The backend is two Go binaries sharing `internal/` packages, plus Redis and SeaweedFS as
infrastructure.

### `cmd/server` — REST API (`internal` package `main`)

Stateless HTTP front end built on `gorilla/mux`. In production it serves under a `kicad.` subdomain
and applies CORS restricted to `CORS_ALLOWED_ORIGIN`; in development CORS is fully permissive. It owns
**no** build logic — it enqueues tasks, inspects their state, and proxies files from the Filer.

**Routes:**

| Method & path                     | Handler              | Purpose                                                         |
| --------------------------------- | -------------------- | --------------------------------------------------------------- |
| `POST /api/pcb`                   | `KicadPostNewTask`   | Enqueue a generation task; returns `{ task_id }` (202).         |
| `GET /api/pcb/{id}`               | `KicadGetTaskStatus` | Map asynq state → `{ task_status, task_result }`.               |
| `DELETE /api/pcb/{id}`            | `KicadDeleteTask`    | Cancel a pending/retry task (active tasks cannot be cancelled). |
| `GET /api/pcb/{id}/render/{name}` | `KicadGetTaskRender` | Proxy `{id}/{name}.svg` from the Filer.                         |
| `GET /api/pcb/{id}/result`        | `KicadGetTaskResult` | Proxy `{id}/{id}.zip` from the Filer as an attachment.          |
| `GET /api/pcb/{id}/logs`          | `KicadGetTaskLogs`   | WebSocket upgrade; stream live build logs (backfill then tail). |
| `GET /api/workers`                | `KicadGetWorkers`    | Aggregate asynq server info into worker capacity.               |
| `GET /api/version`                | `GetVersion`         | Build version string.                                           |

**Enqueue & rate limiting:** `KicadPostNewTask` rejects with 503 when the `kicad` queue has more than
`MAX_QUEUE_SIZE` (default 2) pending+active tasks — the deployment runs on a small single-core host.
The request body is capped at 10MB. Tasks are created with `asynq.MaxRetry(3)`, a **10-minute
timeout**, `Queue("kicad")`, and 24-hour retention; asynq auto-generates the task id.

**Status mapping:** `KicadGetTaskStatus` translates asynq task states into the API contract —
`Pending → PENDING`, `Active → PROGRESS` (parsing the `common.Progress` written to the result
writer for `percentage`/`message`), `Completed/Archived-without-error → SUCCESS` (attaching the
`files` manifest via `successResult`), `Archived-with-error → FAILURE`, `Retry → RETRY`.

**Filer proxy:** `FilerProxy` fetches `{FILER_URL}/{objectName}`, copies headers, optionally overrides
`Content-Disposition` (for the ZIP download), and streams the body. This is how renders and the ZIP
reach the client without the server persisting anything.

**Task abandonment detection:** `TaskAccessTracker` records the last access time per task (updated on
submit and every status poll). A background goroutine (`startAbandonmentDetector`, interval
`TASK_ABANDONMENT_CHECK_INTERVAL`, default 2 min) cancels pending/retry tasks that haven't been polled
within `TASK_ABANDONMENT_TIMEOUT` (default 15 min), so clients that navigate away don't leave work
queued. Active tasks are left to finish (or hit the 10-minute timeout).

### `cmd/worker` — asynq consumer (`internal/worker`)

- `worker.go` — Builds the `asynq.Server` (concurrency from `WORKER_CONCURRENCY`, default 10;
  `kicad` and `critical` queues with priority weights; exponential retry backoff of 1/2/4/8 min) and
  runs the `ServeMux` until a termination signal.
- `task_handler.go` — Registers and runs `generate_kicad_project`. `HandleGenerateKicadProject`
  reports progress at **0% (init) → 10% (generating) → 50% (uploading) → 100% (complete)** by writing
  `common.Progress` JSON to the task's result writer (read back by the server on status polls). It
  recovers from panics, parses the payload, calls `kicad.NewPCB()`, uploads via
  `filerUploader.UploadToStorage()`, and writes the final result **including the file manifest**
  (`reportResult`). All PCB-generation errors are wrapped with `asynq.SkipRetry` — bad input never
  retries; only upload failures are retriable.
- `config.go` — Loads Redis / Filer / concurrency / queue settings from the environment.

### `internal/kicad` — the actual build

`kicad.go` is the core. `NewPCB(ctx, taskID, taskRequest)` performs the full build and returns the
work directory plus a `ProjectFiles` manifest:

1. **Parse & validate settings** — Extracts and type-checks every field (switch/diode rotation, side,
   positions, footprints, routing, LED chain). Missing/invalid fields return typed errors from
   `errors.go` (e.g. `ErrMissingSwitchSide`, `ErrInvalidFootprintFormat`). Footprint strings must be
   `lib:footprint`; `parsePlacement` reads the `<prefix>Rotation/Side/PositionX/PositionY` groups for
   LED and capacitor.
2. **Resolve footprint paths** — Switch/stabilizer footprints resolve against the bundled keyswitch
   library (`~/.local/share/kicad/9.0/3rdparty/.../keyswitch-kicad-library`), diode/LED/capacitor
   against the system KiCad library (`/usr/share/kicad/footprints/`).
3. **Create work dirs & write layout** — A temp work dir per task, a project subdir, and a `logs/`
   dir; the layout JSON is written next to the `.kicad_pcb`/`.kicad_sch` paths.
4. **Run kbplacer** (`RunKBPlacer` → `buildKBPlacerArgs`) — `python3 -m kbplacer` places switches,
   diodes, stabilizers, optional LEDs/capacitors, and routes according to the routing mode. Output is
   captured to `build.log`; on failure the log tail (last 5000 chars) is included in the returned
   error so the client sees a real reason.
5. **Bundle switch footprints** — Copies the switch library `.pretty` into the project and writes an
   `fp-lib-table` so the generated project opens standalone in KiCad.
6. **Render** — `GenerateSchematicImage` exports one SVG per schematic sheet via `kicad-cli`;
   `GenerateRender` exports PCB `front.svg`/`back.svg` (layer templates `F.Cu,F.SilkS,Edge.Cuts` /
   `B.Cu,B.SilkS,Edge.Cuts`).
7. **Assemble the manifest** — `front`, `back`, then the schematic renders (root sheet first).

**kbplacer invocation** (`buildKBPlacerArgs`): fixed args include `--create-sch-file`,
`--create-pcb-file`, `--max-keys 150`, and the encoder footprint/adjustment. Routing maps to
`--route-switches-with-diodes` (for `Switch-Diode only` and `Full`) and `--route-rows-and-columns`
(for `Full` only). Switch, diode, stabilizer, LED, and capacitor placements are passed as `--switch`,
`--diode`, and a `;`-separated `--additional-elements` list (`ST{}`, `LED{}`, `C{}` with `CUSTOM
x y rotation side` placement templates).

**Other files:**

- `errors.go` — Typed validation errors surfaced to the client as failure messages.
- `paths.go` — `SanitizeFilename` / `SanitizeFilepath` (removes illegal chars and `..` traversal),
  mirroring Python's `pathvalidate`.

### `internal/storage` — artifact upload

- `filer.go` — `FilerUploader` posts artifacts to the SeaweedFS Filer with a **1-hour TTL**.
  `UploadToStorage` zips the whole work dir in memory (`CreateZipInMemory`) and uploads it as
  `{taskID}/{taskID}.zip`, then uploads each manifest render as `{taskID}/{name}.svg`.
- `zip.go` — `CreateZipInMemory` walks the work dir and streams every file into an in-memory ZIP.

### `internal/logstream` — live build-log streaming

`logstream.go` publishes build output to a bounded Redis Stream (`pcb:logs:{task_id}`) that the
server's WebSocket handler (`cmd/server/logs.go`, `KicadGetTaskLogs`) tails: `XREAD` from ID `0`
returns the full backfill first and then blocks for new entries, so one code path serves both the
backfill and the live tail. The `Publisher` exposes `PublishLine` / `PublishEnd` and a `Writer`
line-splitter; the worker tees kbplacer's stdout+stderr through a single
`io.MultiWriter(build.log, streamWriter)` (with `python3 -u` for prompt flushing) and emits `worker`
step markers, publishing the terminal `end` on every exit path. Publishing is best-effort — if Redis
fails, the build is unaffected and `build.log` / the on-failure error string still work.

### `internal/common`

- `progress.go` — `Progress`, `RenderFile`, `ProjectFiles`. These structs are the wire format between
  worker and server (via Redis) and, ultimately, between server and client. `Files` is populated only
  on the final result write so intermediate progress updates stay compact. **The Go `RenderFile` /
  `ProjectFiles` shapes intentionally match the TypeScript `types/pcb.ts` counterparts.**
- `env.go` — `GetenvOrDefault` / `GetIntOrDefault`.

## API Reference

The client contract is documented at the field level in the backend repo's
[`docs/led-chain-api.md`](https://github.com/adamws/kle-ng-api/blob/master/docs/led-chain-api.md).
Summary:

### `POST /api/pcb`

Request body:

```jsonc
{
  "layout":   { "meta": { "name": "…" }, "keys": [ … ] },   // kle-internal format
  "settings": {
    "switchFootprint": "Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u",
    "stabilizerFootprint": "Mounting_Keyboard_Stabilizer:Stabilizer_Cherry_MX_{:.2f}u",
    "diodeFootprint": "Diode_SMD:D_SOD-123F",
    "routing": "Full",
    "switchRotation": 0, "switchSide": "FRONT",
    "diodeRotation": 90, "diodeSide": "BACK",
    "diodePositionX": 5.08, "diodePositionY": 4.0
    // LED chain fields (createLedSchFile, ledFootprint, …) sent only when enabled
  }
}
```

Returns `202 Accepted` with `{ "task_id": "…", "task_status": "pending" }`. Returns `503` when the
queue is full.

### `GET /api/pcb/{task_id}`

```jsonc
{
  "task_id": "…",
  "task_status": "PROGRESS", // PENDING | PROGRESS | SUCCESS | FAILURE | RETRY
  "task_result": {
    "percentage": 50,
    "message": "Uploading files to storage",
    // on SUCCESS, a file manifest is included:
    "files": {
      "renders": [
        { "name": "front", "kind": "pcb-front" },
        { "name": "back", "kind": "pcb-back" },
        { "name": "schematic", "kind": "schematic" },
      ],
      "archive": "<task_id>.zip",
    },
  },
}
```

For multi-sheet (LED-chain) projects the manifest additionally lists `schematic-key-matrix` and
`schematic-led-chain` renders with a `sheet` field. **The client should iterate `renders` rather than
assume fixed names.**

### Other endpoints

- `GET /api/pcb/{task_id}/render/{name}` — the SVG for a render name from the manifest.
- `GET /api/pcb/{task_id}/result` — the project ZIP (as an attachment).
- `DELETE /api/pcb/{task_id}` — cancel a still-pending task (409 if active, 410 if already finished).
- `GET /api/workers` — worker capacity (`total_capacity`, `idle_capacity`, per-worker detail).
- `GET /api/pcb/{task_id}/logs` — **WebSocket** stream of live build logs (see below).

### `GET /api/pcb/{task_id}/logs` (WebSocket)

An additive, independent channel to the 1s status polling. The client opens it as soon as it has a
`task_id`; the server replays the retained backfill from the **start of the build**, then live-tails,
then sends exactly one terminal frame before closing. Server → browser frames are text, one JSON
object each:

```jsonc
{ "ts": 1731758400, "source": "kbplacer", "line": "12:00:01: Routing SW1 with D1" }
{ "event": "end", "status": "success" }   // status: "success" | "failure"
```

- `source` is `"kbplacer"` (subprocess output) or `"worker"` (step markers). `ts` is a Unix timestamp
  (seconds), optional. `line` is rendered verbatim and is **not** newline-terminated.
- Backfill is a bounded Redis Stream (`pcb:logs:{task_id}`, ~last 2000 lines, expiring ~15 min after
  the build), so a late join / page reload / dropped socket just re-opens and replays from the start
  — no cursors. Because reconnect replays from the start, the client **clears** `buildLogs` on each
  (re)connect to avoid duplicates.
- The server pings every 30s (browsers auto-pong) and hard-caps the connection at 11 min. In prod the
  upgrader enforces `CORS_ALLOWED_ORIGIN`; in dev any origin is allowed. Streaming is best-effort — a
  client that never connects changes nothing about the build.

## Settings

### Switch / Stabilizer / Diode / Routing (Switches tab)

| Setting               | Default                                                     | Notes                                                                          |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `switchFootprint`     | `Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u`        | Cherry MX / Alps-Matias / Hybrid / Kailh Choc (V1/V2/Mini) / Hotswap variants. |
| `stabilizerFootprint` | `Mounting_Keyboard_Stabilizer:Stabilizer_Cherry_MX_{:.2f}u` | `""` (None) passes `--no-stabilizers` to kbplacer.                             |
| `switchRotation`      | `0`                                                         | 0 / 90 / 180 / 270°.                                                           |
| `diodeFootprint`      | `Diode_SMD:D_SOD-123F`                                      | SOD-123 / 123F / 323 / 323F.                                                   |
| `diodeRotation`       | `90`                                                        | 0 / 90 / 180 / 270°.                                                           |
| `diodeSide`           | `BACK`                                                      | `FRONT` / `BACK`.                                                              |
| `diodePositionX/Y`    | `5.08` / `4.0`                                              | Offset (mm) from the key center.                                               |
| `routing`             | `Full`                                                      | `Disabled` (place only), `Switch-Diode only`, or `Full` (also rows/columns).   |

The `{:.2f}u` placeholder in footprint names is a kbplacer template filled with the key size (e.g.
`2.00u`), so a single selection covers all key widths.

### LED chain (LEDs tab)

Per-key SK6812MINI-E addressable LEDs with optional decoupling capacitors. All fields are optional and
only sent when the feature is enabled; see the field-level table in
[`led-chain-api.md`](https://github.com/adamws/kle-ng-api/blob/master/docs/led-chain-api.md).

| Setting                 | Default                                                  | Notes                                                                                |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `createLedSchFile`      | `false`                                                  | **Master switch.** Generates the LED-chain schematic sheet **and** the PCB elements. |
| `skipLedDecoupling`     | `false`                                                  | Omits per-LED decoupling capacitors (UI exposes the inverse "add decoupling").       |
| `ledFootprint`          | `LED_SMD:LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount` | Required when the chain is enabled; must be SK6812MINI-E pinout.                     |
| `ledRotation/Side`      | `0` / `BACK`                                             | LED placement relative to its key.                                                   |
| `ledPositionX/Y`        | `0` / `5.25`                                             | Offset (mm).                                                                         |
| `ledCapacitorFootprint` | `Capacitor_SMD:C_0603_1608Metric`                        | Required when the chain is enabled and decoupling is not skipped.                    |
| `ledCapacitor*`         | `0` / `BACK` / `5.5` / `5.75`                            | Capacitor rotation / side / X / Y.                                                   |

Enabling the LED chain turns the schematic into a **hierarchical multi-sheet project** (root +
`key-matrix` + `led-chain`), each sheet individually previewable. kbplacer is invoked with
`--bundle-strategy hierarchical` because the deployment runs KiCad 9 (flat bundling is KiCad 10+ only),
keeping output deterministic.

## Task Lifecycle & States

```
       submit            worker picks up        kbplacer + render + upload
PENDING ──────► (queued) ──────────────► PROGRESS ──────────────────────► SUCCESS
   │                                         │                               │
   │ DELETE (client) / abandonment           │ error (SkipRetry)             │ download link
   ▼                                         ▼                               │  valid for 1h
(cancelled)                              FAILURE ◄── retry exhausted         ▼
                                                                    (renders + ZIP)
```

- **Client polling** runs at 1s intervals and tolerates 5 consecutive failures before giving up.
- **Progress percentages** come from the worker's `reportProgress` writes: 0 → 10 → 50 → 100.
- **Retries**: only infrastructure failures (e.g. Filer upload) retry, with 1/2/4/8-minute backoff;
  generation errors are marked `SkipRetry` and fail immediately.
- **Download window**: the Filer stores artifacts with a 1-hour TTL, and the client mirrors this with
  a client-side expiration timer (`DOWNLOAD_TIMEOUT_MS`, default 1h) that invalidates the download
  button and shows a toast when the link expires.
- **Abandonment**: pending tasks unpolled for 15 minutes are cancelled server-side.

## Deployment & Infrastructure

The production stack (`deploy/docker-compose.yml`) is orchestrated behind Traefik:

- **kicad-server** — the Go API (`admwscki/keyboard-tools-server`), routed at `kicad.${DOMAIN}` with a
  rate-limit middleware.
- **kicad-worker** — the Go worker + KiCad + kbplacer (`admwscki/keyboard-tools-kicad`), run with 2
  replicas. Built `FROM admwscki/kicad-kbplacer-primary:9.0.9-noble`, it installs the keyswitch
  footprint library, backports the SK6812MINI-E reverse-mount footprint from KiCad 10, and installs
  kbplacer (`pip install "kbplacer[schematic]"`).
- **redis** — asynq's task broker and result store.
- **s3** — SeaweedFS running as a combined server+filer on port 8888, holding time-limited artifacts.
- **asynqmon** — asynq's web dashboard (behind basic auth) for queue inspection.
- **prometheus** — metrics, including asynq queue metrics.

Locally, a worker + Redis + Filer can be run against the dev server; the frontend points at them via
the Vite proxy (`VITE_BACKEND_URL=""`) or a custom URL set through `PcbSettingsModal`. The `/api`
proxy entry sets `ws: true` so the browser's log-stream WebSocket upgrade is forwarded to the backend
in dev; in prod, Traefik forwards the upgrade on `kicad.<domain>` and the server's 30s pings keep the
connection under Traefik's 180s idle timeout with no special config.

## Relationship to Other Features

- **Matrix annotation** — a hard prerequisite; the generator is gated on `isViaAnnotated`. See
  [matrix-annotation.md](./matrix-annotation.md).
- **Plate Generator** — the browser-only sibling. Both consume the current keyboard layout and share
  the `sm="rot_ec11"` rotary-encoder convention, but the Plate Generator runs entirely client-side
  and produces mechanical cutouts, while the PCB Generator delegates to a KiCad backend and produces
  electrical designs. See [plate-generator.md](./plate-generator.md).
- **Key manufacturing properties** — per-key switch-mount (`sm`) values (including rotary encoders)
set in `KeyPropertiesPanel` feed both generators.
