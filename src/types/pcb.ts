// Internal settings format (stored in Pinia)
export interface PcbSettings {
  switchFootprint: string
  diodeFootprint: string
  routing: string
  keyDistanceX: number // Separate numeric values to prevent parsing errors
  keyDistanceY: number
  controllerCircuit: string
}

// API request format (for submission)
export interface PcbApiSettings {
  switchFootprint: string
  diodeFootprint: string
  routing: string
  keyDistance: string // Formatted as "X Y" string for API
  controllerCircuit: string
}

export interface TaskRequest {
  layout: object
  settings: PcbApiSettings
}

export type TaskStatusType = 'PENDING' | 'PROGRESS' | 'SUCCESS' | 'FAILURE' | 'RETRY'

export interface TaskResult {
  percentage: number
  status?: string
  message?: string
  error?: string
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

export interface RenderViews {
  front: string | null // Blob URLs for memory efficiency
  back: string | null
  schematic: string | null
}

export interface StoredTask {
  taskId: string
  submittedAt: number // Timestamp for staleness checking
}
