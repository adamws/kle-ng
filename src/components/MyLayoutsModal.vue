<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="close">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">My Layouts</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <!-- Quota is only worth mentioning once it actually constrains the user -->
          <div
            v-if="store.isFull"
            class="alert alert-warning py-2 mb-3"
            data-testid="layouts-quota-warning"
            role="status"
          >
            You have saved the maximum of {{ store.quota }} layouts. Delete one to add another, or
            save over an existing name to update it.
          </div>

          <!-- Save current layout -->
          <div class="save-row">
            <input
              v-model="saveName"
              type="text"
              class="form-control"
              :maxlength="MAX_NAME_LENGTH"
              placeholder="Name this layout"
              data-testid="save-layout-name"
              :disabled="store.busy"
              @keydown.enter.prevent="saveCurrent"
            />
            <button
              type="button"
              class="btn btn-primary flex-shrink-0 d-flex align-items-center justify-content-center"
              data-testid="save-layout"
              :disabled="!canSave"
              :title="saveHint"
              @click="saveCurrent"
            >
              <BiFloppy aria-hidden="true" />
              <span class="ms-1">{{ existingByName ? 'Update' : 'Save current' }}</span>
            </button>
          </div>

          <div
            v-if="store.errorMessage"
            class="alert alert-danger py-2 mb-3"
            data-testid="layouts-error"
            role="alert"
          >
            {{ store.errorMessage }}
          </div>

          <!-- Loading -->
          <div
            v-if="store.loading"
            class="text-center text-muted py-4"
            data-testid="layouts-loading"
          >
            <div class="spinner-border spinner-border-sm me-2" role="status"></div>
            Loading your layouts…
          </div>

          <!-- Empty -->
          <div
            v-else-if="store.layouts.length === 0"
            class="text-center text-muted py-4"
            data-testid="layouts-empty"
          >
            <BiKeyboard class="empty-icon mb-2" aria-hidden="true" />
            <p class="mb-0">No saved layouts yet.</p>
            <p class="small mb-0">Save the layout you are working on to keep it here.</p>
          </div>

          <!-- List -->
          <ul v-else class="layout-list list-unstyled mb-0" data-testid="layouts-list">
            <li v-for="layout in store.layouts" :key="layout.id" class="layout-item">
              <LayoutThumbnail
                v-if="decoded(layout)"
                :keys="decoded(layout)!.keys"
                :metadata="decoded(layout)!.meta"
                class="layout-item-thumb"
              />
              <div v-else class="layout-item-thumb is-broken" title="This layout could not be read">
                <BiExclamationTriangle class="text-warning" aria-hidden="true" />
              </div>

              <div class="layout-item-info">
                <template v-if="renamingId === layout.id">
                  <input
                    v-model="renameValue"
                    type="text"
                    class="form-control form-control-sm"
                    :maxlength="MAX_NAME_LENGTH"
                    data-testid="rename-input"
                    @keydown.enter.prevent="commitRename(layout.id)"
                    @keydown.esc.prevent="cancelRename"
                  />
                </template>
                <template v-else>
                  <div class="fw-medium text-truncate" :title="layout.name">{{ layout.name }}</div>
                  <div class="text-muted small">{{ describe(layout) }}</div>
                </template>
              </div>

              <!-- Pending confirmation replaces the actions for this row -->
              <div v-if="pending?.id === layout.id" class="layout-item-actions confirm">
                <span class="small text-truncate me-1">{{ pending.message }}</span>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="pending.danger ? 'btn-danger' : 'btn-primary'"
                  data-testid="confirm-action"
                  :disabled="store.busy"
                  @click="runPending"
                >
                  {{ pending.confirmLabel }}
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary"
                  data-testid="cancel-action"
                  @click="pending = null"
                >
                  Cancel
                </button>
              </div>

              <div v-else-if="renamingId === layout.id" class="layout-item-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-primary d-flex align-items-center justify-content-center"
                  data-testid="rename-confirm"
                  :disabled="store.busy || !renameValue.trim()"
                  @click="commitRename(layout.id)"
                >
                  <BiCheckLg aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                  data-testid="rename-cancel"
                  @click="cancelRename"
                >
                  <BiXLg aria-hidden="true" />
                </button>
              </div>

              <div v-else class="layout-item-actions">
                <button
                  type="button"
                  class="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center"
                  data-testid="load-layout"
                  :disabled="store.busy || !decoded(layout)"
                  title="Load into the editor"
                  @click="requestLoad(layout)"
                >
                  <BiBoxArrowInRight aria-hidden="true" />
                  <span class="d-none d-sm-inline ms-1">Load</span>
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                  data-testid="rename-layout"
                  :disabled="store.busy"
                  title="Rename"
                  @click="startRename(layout)"
                >
                  <BiPencil aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger d-flex align-items-center justify-content-center"
                  data-testid="delete-layout"
                  :disabled="store.busy"
                  title="Delete"
                  @click="requestDelete(layout)"
                >
                  <BiTrash aria-hidden="true" />
                </button>
              </div>
            </li>
          </ul>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Keyboard, type Key, type KeyboardMetadata } from '@adamws/kle-serial'
import { useKeyboardStore } from '@/stores/keyboard'
import { useLayoutsStore, MAX_NAME_LENGTH, type SavedLayout } from '@/stores/layouts'
import { encodeLayoutToUrl, decodeLayoutFromUrl } from '@/utils/url-sharing'
import { toast } from '@/composables/useToast'
import LayoutThumbnail from './LayoutThumbnail.vue'

import BiFloppy from 'bootstrap-icons/icons/floppy.svg'
// box-arrow-in-right, not one of the download arrows: `download.svg` already means
// "write a file to disk" in PlateDownloadButtons, and this loads into the editor. Its
// ink is also centred in its 16px box and only 12px tall, so it sits on the same
// optical line as the label — box-arrow-in-down's ran to the bottom edge of the box.
import BiBoxArrowInRight from 'bootstrap-icons/icons/box-arrow-in-right.svg'
import BiPencil from 'bootstrap-icons/icons/pencil.svg'
import BiTrash from 'bootstrap-icons/icons/trash.svg'
import BiCheckLg from 'bootstrap-icons/icons/check-lg.svg'
import BiXLg from 'bootstrap-icons/icons/x-lg.svg'
import BiKeyboard from 'bootstrap-icons/icons/keyboard.svg'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'

const props = defineProps<{ isVisible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const keyboardStore = useKeyboardStore()
const store = useLayoutsStore()

const saveName = ref('')
const renamingId = ref<string | null>(null)
const renameValue = ref('')

interface PendingAction {
  id: string
  message: string
  confirmLabel: string
  danger: boolean
  run: () => Promise<void>
}
const pending = ref<PendingAction | null>(null)

/**
 * Saving under the name of an existing layout updates that layout rather than adding a
 * second one. That is the only way to re-save work in place, so it stays available at
 * the quota — the database only counts inserts, and an update is not one.
 */
const existingByName = computed(() => {
  const name = saveName.value.trim().toLowerCase()
  if (!name) return null
  return store.layouts.find((layout) => layout.name.trim().toLowerCase() === name) ?? null
})

/*
 * `store.loading` gates this as well as `store.busy`: opening the modal refetches, and
 * until that lands `layouts` is empty or stale, so `existingByName` would miss a match
 * and save a duplicate instead of updating — and the confirmation it opens lives in a
 * row the loading spinner has replaced.
 */
const canSave = computed(
  () =>
    !store.busy &&
    !store.loading &&
    saveName.value.trim().length > 0 &&
    (!store.isFull || existingByName.value !== null),
)

const saveHint = computed(() => {
  if (existingByName.value) return `Update "${existingByName.value.name}" with the editor contents`
  if (store.isFull) return 'You have reached your limit — delete one to make room'
  return undefined
})

/**
 * Decoded payloads, cached by id so a re-render does not re-parse every row.
 * A payload that fails to decode yields null and the row degrades to a placeholder
 * with Load disabled, rather than taking the whole list down.
 */
const decodedCache = new Map<string, { keys: Key[]; meta: KeyboardMetadata } | null>()

const decoded = (layout: SavedLayout) => {
  const cached = decodedCache.get(layout.id)
  if (cached !== undefined) return cached

  let result: { keys: Key[]; meta: KeyboardMetadata } | null = null
  try {
    const keyboard = decodeLayoutFromUrl(layout.payload)
    result = { keys: keyboard.keys, meta: keyboard.meta }
  } catch (error) {
    console.error(`Could not decode saved layout "${layout.name}":`, error)
  }
  decodedCache.set(layout.id, result)
  return result
}

const describe = (layout: SavedLayout) => {
  const entry = decoded(layout)
  const keyCount = entry ? entry.keys.length : 0
  const keys = entry ? `${keyCount} ${keyCount === 1 ? 'key' : 'keys'}` : 'unreadable'
  return `${keys} · updated ${formatDate(layout.updatedAt)}`
}

const formatDate = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Current editor contents in the same encoding used by share links. */
const currentPayload = () => {
  const keyboard = new Keyboard()
  keyboard.keys = keyboardStore.keys
  keyboard.meta = keyboardStore.metadata
  return encodeLayoutToUrl(keyboard)
}

const defaultName = () =>
  keyboardStore.metadata.name?.trim() || keyboardStore.filename?.trim() || 'Untitled layout'

const saveCurrent = async () => {
  if (!canSave.value) return

  // Confirm in the row being replaced, so it is obvious which layout is about to change.
  const existing = existingByName.value
  if (existing) {
    pending.value = {
      id: existing.id,
      message: `Update "${existing.name}" with the editor contents?`,
      confirmLabel: 'Update',
      danger: false,
      run: async () => {
        const saved = await store.overwrite(existing.id, currentPayload())
        if (saved) {
          decodedCache.delete(saved.id)
          toast.showSuccess(`Updated "${saved.name}"`, 'My Layouts')
        }
      },
    }
    return
  }

  const saved = await store.save(saveName.value, currentPayload())
  if (saved) {
    decodedCache.delete(saved.id)
    toast.showSuccess(`Saved "${saved.name}"`, 'My Layouts')
  }
}

const applyLayout = (layout: SavedLayout) => {
  const entry = decoded(layout)
  if (!entry) return
  try {
    const keyboard = new Keyboard()
    keyboard.keys = entry.keys
    keyboard.meta = entry.meta
    keyboardStore.loadKeyboard(keyboard)
    keyboardStore.filename = layout.name
    // Loading a stored layout is not an unsaved change — rebaseline so the dirty
    // indicator and the beforeunload guard stay honest.
    keyboardStore.updateBaseline()
    toast.showSuccess(`Loaded "${layout.name}"`, 'My Layouts')
    close()
  } catch (error) {
    console.error('Error loading saved layout:', error)
    toast.showError(
      error instanceof Error ? error.message : 'Could not load this layout',
      'Load Failed',
    )
  }
}

const requestLoad = (layout: SavedLayout) => {
  // Only interrupt when there is genuinely unsaved work to lose.
  if (keyboardStore.dirty) {
    pending.value = {
      id: layout.id,
      message: 'Discard unsaved changes?',
      confirmLabel: 'Load anyway',
      danger: false,
      run: async () => applyLayout(layout),
    }
    return
  }
  applyLayout(layout)
}

const requestDelete = (layout: SavedLayout) => {
  pending.value = {
    id: layout.id,
    message: `Delete "${layout.name}"?`,
    confirmLabel: 'Delete',
    danger: true,
    run: async () => {
      if (await store.remove(layout.id)) {
        decodedCache.delete(layout.id)
        toast.showSuccess(`Deleted "${layout.name}"`, 'My Layouts')
      }
    },
  }
}

const runPending = async () => {
  const action = pending.value
  if (!action) return
  pending.value = null
  await action.run()
}

const startRename = (layout: SavedLayout) => {
  pending.value = null
  renamingId.value = layout.id
  renameValue.value = layout.name
}

const cancelRename = () => {
  renamingId.value = null
  renameValue.value = ''
}

const commitRename = async (id: string) => {
  const name = renameValue.value.trim()
  if (!name) return
  cancelRename()
  await store.rename(id, name)
}

const close = () => emit('close')

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  // Escape backs out of the innermost interaction first.
  if (pending.value) {
    pending.value = null
  } else if (renamingId.value) {
    cancelRename()
  } else {
    close()
  }
}

watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.classList.add('modal-open')
      saveName.value = defaultName()
      pending.value = null
      cancelRename()
      store.errorMessage = null
      void store.fetchAll(true)
    } else {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
    }
  },
)

onMounted(() => {
  if (props.isVisible) {
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.body.classList.remove('modal-open')
})
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
}

.save-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

/*
 * The buttons here centre their contents with `d-flex align-items-center
 * justify-content-center`, the same way the download and matrix modals do. Without it
 * the icons — 16px inline replaced elements — rest ON the text baseline and ride low
 * next to a label.
 *
 * Those buttons always carry text, though, and these do not: rename and delete are
 * icon-only, and Load drops its label below 576px. A flex container has no strut, so
 * an icon-only one would be only as tall as its 16px icon while its labelled neighbour
 * keeps a 20px text box, and the row would step. This restores that line box — its
 * height is .btn-sm's line-height, set in bootstrap-custom.scss.
 *
 * It has to be a zero-width item with no `gap` on the container: `gap` also applies
 * between the strut and the icon, which widens every icon-only button and pushes a
 * labelled one off centre. Label spacing is a margin utility instead.
 */
.layout-item-actions .btn::before {
  content: '';
  width: 0;
  height: 1.4286em;
}

.empty-icon {
  width: 2rem;
  height: 2rem;
}

.layout-list {
  max-height: 420px;
  overflow-y: auto;
}

.layout-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}

.layout-item + .layout-item {
  margin-top: 0.5rem;
}

.layout-item-thumb {
  width: 120px;
  height: 48px;
  flex-shrink: 0;
}

.layout-item-thumb.is-broken {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bs-tertiary-bg);
  border-radius: var(--bs-border-radius-sm);
}

.layout-item-info {
  flex: 1 1 auto;
  min-width: 0;
}

.layout-item-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.layout-item-actions.confirm {
  max-width: 60%;
}

@media (max-width: 575.98px) {
  .layout-item-thumb {
    width: 72px;
    height: 36px;
  }
}
</style>
