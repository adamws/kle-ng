// Internal settings format (stored in Pinia)
export interface PcbSettings {
  switchFootprint: string
  stabilizerFootprint: string
  diodeFootprint: string
  routing: string
  // Switch configuration
  switchRotation: number
  switchSide: 'FRONT' | 'BACK'
  // Diode configuration
  diodeRotation: number
  diodeSide: 'FRONT' | 'BACK'
  diodePositionX: number
  diodePositionY: number
  // LED chain configuration (per-key SK6812MINI-E LEDs + optional decoupling capacitors)
  createLedSchFile: boolean
  skipLedDecoupling: boolean
  ledFootprint: string
  ledCapacitorFootprint: string
  ledRotation: number
  ledSide: 'FRONT' | 'BACK'
  ledPositionX: number
  ledPositionY: number
  ledCapacitorRotation: number
  ledCapacitorSide: 'FRONT' | 'BACK'
  ledCapacitorPositionX: number
  ledCapacitorPositionY: number
}

// API request format (for submission)
export interface PcbApiSettings {
  switchFootprint: string
  stabilizerFootprint: string
  diodeFootprint: string
  routing: string
  // Switch configuration
  switchRotation: number
  switchSide: string // "FRONT" or "BACK"
  // Diode configuration
  diodeRotation: number
  diodeSide: string // "FRONT" or "BACK"
  diodePositionX: number
  diodePositionY: number
  // LED chain configuration. All fields are optional and only sent when the
  // feature is enabled (createLedSchFile). Capacitor fields are omitted when
  // decoupling is skipped. Mirrors the backend's "required when" semantics.
  createLedSchFile?: boolean
  skipLedDecoupling?: boolean
  ledFootprint?: string
  ledCapacitorFootprint?: string
  ledRotation?: number
  ledSide?: string // "FRONT" or "BACK"
  ledPositionX?: number
  ledPositionY?: number
  ledCapacitorRotation?: number
  ledCapacitorSide?: string // "FRONT" or "BACK"
  ledCapacitorPositionX?: number
  ledCapacitorPositionY?: number
}

export interface TaskRequest {
  layout: object
  settings: PcbApiSettings
}

export type TaskStatusType = 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'RETRY'

// A single generated SVG preview, as advertised by the backend's file manifest.
// Each is fetchable via GET /api/pcb/{task_id}/render/{name}.
export type RenderKind = 'pcb-front' | 'pcb-back' | 'schematic'

export interface RenderFile {
  name: string // render identifier used in /render/{name}
  kind: RenderKind
  sheet?: string // schematic sheet name (multi-sheet projects only)
}

// Manifest of artifacts produced by a completed task, returned in the SUCCESS
// task_result so the frontend can decide what to preview / download without
// unpacking the result zip.
export interface ProjectFiles {
  renders: RenderFile[]
  archive: string // file name of the downloadable zip
}

export interface TaskResult {
  percentage: number
  message?: string
  error?: string
  retries?: number
  max_retry?: number
  files?: ProjectFiles
}

export interface TaskStatusResponse {
  task_id: string
  task_status: TaskStatusType
  task_result: TaskResult
}

export interface WorkerDetail {
  id: string
  host: string
  pid: number
  concurrency: number
  started: string
  status: string
  active_tasks: number
  idle_capacity: number
  queues: Record<string, number>
}

export interface WorkerStatusResponse {
  worker_processes: number
  total_capacity: number
  active_tasks: number
  idle_capacity: number
  workers: WorkerDetail[]
}

// A single schematic sheet ready for display. A single-sheet project has one
// entry (the root, sheet === ''); a multi-sheet project (e.g. the LED chain) has
// the root plus one entry per child sheet.
export interface SchematicView {
  name: string // render name, e.g. 'schematic' or 'schematic-led-chain'
  sheet: string // sheet name ('' for the root sheet)
  label: string // human-friendly tab label, e.g. 'Schematic' or 'LED Chain'
  url: string | null // Blob URL for memory efficiency
}

export interface RenderViews {
  front: string | null // Blob URLs for memory efficiency
  back: string | null
  schematics: SchematicView[] // one entry per schematic sheet (root first)
}

export interface StoredTask {
  taskId: string
  submittedAt: number // Timestamp for staleness checking
}
