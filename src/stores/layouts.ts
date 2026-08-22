import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { isAuthConfigured } from '@/config/supabase'
import { getSupabaseClient } from '@/utils/supabase-loader'

/**
 * Saved Layouts Store
 *
 * CRUD against the `layouts` table. There is no API server in front of it: the browser
 * talks to PostgREST with the user's JWT and row level security scopes every statement
 * to the signed-in user, so no query here filters by user id and none needs to.
 *
 * The per-user quota is likewise enforced by a database trigger, not by this store —
 * `isFull` only exists so the UI can disable the save button before the round trip.
 * See supabase/migrations/20260813120000_layouts.sql.
 */

export interface SavedLayout {
  id: string
  name: string
  /** lz-string compressed KLE, the same encoding as #share= links */
  payload: string
  createdAt: string
  updatedAt: string
}

interface LayoutRow {
  id: string
  name: string
  payload: string
  created_at: string
  updated_at: string
}

const COLUMNS = 'id,name,payload,created_at,updated_at'

/** Mirrors layout_quota() in the migration; replaced by the real value on first fetch. */
const DEFAULT_QUOTA = 5

export const MAX_NAME_LENGTH = 120

/**
 * Mirrors the layouts_payload_length constraint in the migration.
 *
 * The payload is lz-string's compressToEncodedURIComponent output, which is plain
 * ASCII, so JavaScript's UTF-16 `.length` and Postgres's `char_length` agree.
 */
export const MAX_PAYLOAD_LENGTH = 32768

const PAYLOAD_TOO_LARGE = 'This layout is too large to save.'

function toSavedLayout(row: LayoutRow): SavedLayout {
  return {
    id: row.id,
    name: row.name,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Turn a PostgREST error into something the user can act on.
 *
 * Unrecognised *server* messages are deliberately not shown. A PostgREST error carries
 * raw Postgres text — constraint names, column names, function signatures — and putting
 * that in a toast publishes the schema to anyone who can provoke an error. The sentinel
 * branches below cover every message a user can act on; anything else is a developer
 * problem, so it goes to the console instead.
 *
 * Errors we threw ourselves are still passed through: they are written for this UI, and
 * `instanceof Error` is what tells them apart — supabase-js returns a plain object.
 */
function describeError(error: unknown, fallback: string): string {
  const isOwnError = error instanceof Error
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : ''

  // Raised by the enforce_layout_quota trigger; PostgREST passes the text through.
  if (message.includes('layout_quota_exceeded')) {
    return 'You have reached your saved layout limit. Delete one to make room.'
  }
  if (message.includes('layouts_name_length')) {
    return `Name must be between 1 and ${MAX_NAME_LENGTH} characters.`
  }
  if (message.includes('layouts_payload_length')) {
    return PAYLOAD_TOO_LARGE
  }
  if (isOwnError) return message || fallback

  if (message) {
    console.error('Unrecognised layouts error:', message)
  }
  return fallback
}

export const useLayoutsStore = defineStore('layouts', () => {
  const layouts = ref<SavedLayout[]>([])
  const quota = ref(DEFAULT_QUOTA)
  const loading = ref(false)
  const busy = ref(false)
  const loaded = ref(false)
  const errorMessage = ref<string | null>(null)

  /**
   * Which saved layout the editor's work came from, if any: the slot a Load came from, or
   * the one a save has just written to. The modal marks that row so re-saving your work
   * is a matter of pressing the button you can see rather than remembering where it came
   * from.
   *
   * `activeToken` is what keeps the mark honest. It holds the value
   * `keyboardStore.layoutGeneration` had when the mark was set, and that counter moves
   * whenever the editor's contents are replaced wholesale — an import, a preset, a share
   * link, a new layout. Comparing the two retires the mark on its own, without this store
   * having to watch the editor.
   *
   * Editing does not retire it, deliberately, and neither does an undo: the mark says
   * where the work came from, not that it is untouched since. That is what makes it
   * useful — an edited layout is exactly the one you want to put back in its own slot.
   */
  const activeId = ref<string | null>(null)
  const activeToken = ref<number | null>(null)

  const markActive = (id: string | null, token: number | null = null) => {
    activeId.value = id
    activeToken.value = token
  }

  const count = computed(() => layouts.value.length)
  const isFull = computed(() => count.value >= quota.value)

  const client = async () => {
    if (!isAuthConfigured()) throw new Error('Accounts are not configured')
    return getSupabaseClient()
  }

  /**
   * Fail an oversized payload locally instead of paying a round trip to learn the same
   * thing from layouts_payload_length. A fast path only — the constraint (like RLS)
   * stays the real boundary, and describeError() still translates it if this is ever
   * out of step with the schema.
   */
  const rejectOversizedPayload = (payload: string): boolean => {
    if (payload.length <= MAX_PAYLOAD_LENGTH) return false
    errorMessage.value = PAYLOAD_TOO_LARGE
    return true
  }

  /**
   * Oldest first, which is what makes a row a slot: a layout's position is decided when
   * it is created and nothing afterwards moves it.
   *
   * This used to sort by `updatedAt` descending. That put a layout at the top of the list
   * the moment it was written, so saving into the fourth slot dragged it to the first and
   * pushed every other row down — under the pointer that had just clicked it.
   */
  const sortInPlace = () => {
    layouts.value.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  }

  const fetchAll = async (force = false): Promise<void> => {
    if (loading.value) return
    if (loaded.value && !force) return

    loading.value = true
    errorMessage.value = null
    try {
      const supabase = await client()

      // The quota lives in the database; read it rather than duplicating the number.
      const { data: quotaValue } = await supabase.rpc('layout_quota')
      if (typeof quotaValue === 'number') quota.value = quotaValue

      const { data, error } = await supabase
        .from('layouts')
        .select(COLUMNS)
        // Ascending by creation, matching sortInPlace(): the list is a row of slots and a
        // slot keeps its place. The (user_id, updated_at desc) index still serves the user
        // filter, and at a five-row quota the sort itself costs nothing.
        .order('created_at', { ascending: true })
      if (error) throw error

      layouts.value = ((data ?? []) as LayoutRow[]).map(toSavedLayout)
      loaded.value = true
    } catch (error) {
      console.error('Error loading saved layouts:', error)
      errorMessage.value = describeError(error, 'Could not load your saved layouts')
    } finally {
      loading.value = false
    }
  }

  /** Insert a new layout. Returns the saved row, or null when the write failed. */
  const save = async (name: string, payload: string): Promise<SavedLayout | null> => {
    if (busy.value) return null
    errorMessage.value = null
    if (rejectOversizedPayload(payload)) return null

    busy.value = true
    try {
      const supabase = await client()
      // user_id defaults to auth.uid() in the schema, so it is never sent from here.
      const { data, error } = await supabase
        .from('layouts')
        .insert({ name: name.trim(), payload })
        .select(COLUMNS)
        .single()
      if (error) throw error

      const saved = toSavedLayout(data as LayoutRow)
      // Appended, not unshifted: a new layout belongs in the slot it was saved into,
      // which is the first vacant one — the end of the list.
      layouts.value.push(saved)
      sortInPlace()
      return saved
    } catch (error) {
      console.error('Error saving layout:', error)
      errorMessage.value = describeError(error, 'Could not save this layout')
      return null
    } finally {
      busy.value = false
    }
  }

  /** Replace the contents of an existing layout. */
  const overwrite = async (id: string, payload: string): Promise<SavedLayout | null> => {
    if (busy.value) return null
    errorMessage.value = null
    if (rejectOversizedPayload(payload)) return null

    return update(id, { payload }, 'Could not overwrite this layout')
  }

  const rename = async (id: string, name: string): Promise<SavedLayout | null> => {
    return update(id, { name: name.trim() }, 'Could not rename this layout')
  }

  async function update(
    id: string,
    patch: { name?: string; payload?: string },
    fallback: string,
  ): Promise<SavedLayout | null> {
    if (busy.value) return null
    busy.value = true
    errorMessage.value = null
    try {
      const supabase = await client()
      // updated_at is maintained by a database trigger, not sent from here.
      const { data, error } = await supabase
        .from('layouts')
        .update(patch)
        .eq('id', id)
        .select(COLUMNS)
        .single()
      if (error) throw error

      const saved = toSavedLayout(data as LayoutRow)
      const index = layouts.value.findIndex((layout) => layout.id === id)
      if (index >= 0) layouts.value[index] = saved
      sortInPlace()
      return saved
    } catch (error) {
      console.error('Error updating layout:', error)
      errorMessage.value = describeError(error, fallback)
      return null
    } finally {
      busy.value = false
    }
  }

  const remove = async (id: string): Promise<boolean> => {
    if (busy.value) return false
    busy.value = true
    errorMessage.value = null
    try {
      const supabase = await client()
      const { error } = await supabase.from('layouts').delete().eq('id', id)
      if (error) throw error

      layouts.value = layouts.value.filter((layout) => layout.id !== id)
      if (activeId.value === id) markActive(null)
      return true
    } catch (error) {
      console.error('Error deleting layout:', error)
      errorMessage.value = describeError(error, 'Could not delete this layout')
      return false
    } finally {
      busy.value = false
    }
  }

  /** Drop cached rows — call on sign-out so the next user starts clean. */
  const reset = () => {
    layouts.value = []
    loaded.value = false
    loading.value = false
    busy.value = false
    errorMessage.value = null
    markActive(null)
  }

  return {
    layouts,
    quota,
    loading,
    busy,
    loaded,
    errorMessage,
    activeId,
    activeToken,
    markActive,
    count,
    isFull,
    fetchAll,
    save,
    overwrite,
    rename,
    remove,
    reset,
  }
})
