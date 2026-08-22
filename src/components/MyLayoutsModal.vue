<template>
  <div
    v-if="isVisible"
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="my-layouts-title"
    @click.self="close"
  >
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="my-layouts-title" class="modal-title">My Layouts</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <!--
            Every slot the quota allows is on screen at all times, filled or not, so the
            modal is the same height before and after a save, a delete, or the first load
            of a session — nothing under the pointer moves when the list changes.

            The slot is also where the writing happens. Each row carries the action that
            targets it: Load takes the layout out, Save puts the editor contents in, and
            every vacant row offers the same Save for a new one. There is no name field
            above the list deciding which row is meant — the row you press is the row you
            get, and it stays that row until the modal is closed.
          -->
          <ul
            ref="listRef"
            class="layout-list list-unstyled mb-0"
            data-testid="layouts-list"
            :aria-busy="isLoadingSlots"
          >
            <li
              v-for="(layout, index) in slots"
              :key="layout?.id ?? `slot-${index}`"
              class="layout-item"
              :class="{
                'layout-item-vacant': !layout,
                'layout-item-open': isOpenSlot(index),
                'layout-item-current': layout && isCurrent(layout),
              }"
              data-testid="layout-slot"
              @click="isOpenSlot(index) && startCreate(index)"
            >
              <!--
                Thumbnail column. Drawn once for all of a row's states, so entering a
                rename or a confirmation cannot change what is beside the text.
              -->
              <LayoutThumbnail
                v-if="layout && decoded(layout)"
                :keys="decoded(layout)!.keys"
                :metadata="decoded(layout)!.meta"
                class="layout-item-thumb"
              />
              <div
                v-else-if="layout"
                class="layout-item-thumb is-broken"
                title="This layout could not be read"
              >
                <BiExclamationTriangle class="text-warning" aria-hidden="true" />
              </div>
              <!--
                A vacant slot's stand-in for the thumbnail: the ghost of a keyboard,
                faint enough to read as the shape of what would be here. While the first
                fetch is in flight it pulses instead of claiming to be empty — it is not
                known yet whether it is.
              -->
              <div
                v-else
                class="layout-item-thumb layout-item-thumb-vacant"
                :class="{ 'is-pulsing': isLoadingSlots }"
                aria-hidden="true"
              >
                <svg
                  v-if="!isLoadingSlots"
                  class="vacant-preview"
                  viewBox="0 0 60 24"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <g fill="currentColor">
                    <rect
                      v-for="x in 9"
                      :key="`a${x}`"
                      :x="x * 6 - 3"
                      y="3"
                      width="5"
                      height="5"
                      rx="1"
                    />
                    <rect
                      v-for="x in 8"
                      :key="`b${x}`"
                      :x="x * 6 - 1.5"
                      y="9.5"
                      width="5"
                      height="5"
                      rx="1"
                    />
                    <rect x="3" y="16" width="5" height="5" rx="1" />
                    <rect x="9" y="16" width="5" height="5" rx="1" />
                    <rect x="15" y="16" width="30" height="5" rx="1" />
                    <rect x="46" y="16" width="5" height="5" rx="1" />
                    <rect x="52" y="16" width="5" height="5" rx="1" />
                  </g>
                </svg>
              </div>

              <!--
                Text column. An invisible copy of a filled row's two lines shares the
                grid cell with whatever the row is currently showing, so every state —
                two lines, a single input, a centred label — is exactly the same height.
                Below 576px these lines, not the thumbnail, are what a row is as tall as.
              -->
              <div class="layout-item-info">
                <div class="info-sizer" aria-hidden="true">
                  <div>&nbsp;</div>
                  <div class="small">&nbsp;</div>
                </div>

                <!-- Filled, renaming -->
                <div v-if="layout && renamingId === layout.id" class="info-content">
                  <input
                    v-model="renameValue"
                    type="text"
                    class="form-control form-control-sm"
                    :maxlength="MAX_NAME_LENGTH"
                    data-testid="rename-input"
                    @keydown.enter.prevent="commitRename(layout.id)"
                    @keydown.esc.prevent="cancelRename"
                  />
                </div>

                <!-- Filled, idle or confirming -->
                <div v-else-if="layout" class="info-content">
                  <div class="layout-item-name fw-medium">
                    <span class="text-truncate" :title="layout.name">{{ layout.name }}</span>
                    <!--
                      Not a `.badge`: that Bootstrap partial is not one of the ones
                      bootstrap-custom.scss imports, so the class would render unstyled.
                    -->
                    <span v-if="isCurrent(layout)" class="current-tag" data-testid="current-marker">
                      Current
                    </span>
                  </div>
                  <!--
                    A pending question takes the description's line rather than sitting
                    among the buttons. It is the widest column, so a sentence fits
                    without being truncated, and the row keeps both its height and its
                    column widths. It also means the question does not have to name the
                    layout — the name is directly above it.
                  -->
                  <div
                    v-if="pending?.id === layout.id"
                    class="small fw-medium text-truncate"
                    :class="pending?.danger ? 'text-danger' : 'text-body-emphasis'"
                    data-testid="confirm-message"
                  >
                    {{ pending?.message }}
                  </div>
                  <div v-else class="text-muted small text-truncate">
                    {{ describe(layout) }}
                  </div>
                </div>

                <!-- Vacant, naming the layout about to be saved here -->
                <div v-else-if="isCreatingAt(index)" class="info-content">
                  <input
                    ref="createInputRef"
                    v-model="createName"
                    type="text"
                    class="form-control form-control-sm"
                    :maxlength="MAX_NAME_LENGTH"
                    placeholder="Name this layout"
                    data-testid="new-name-input"
                    @keydown.enter.prevent="commitCreate"
                    @keydown.esc.prevent="cancelCreate"
                    @click.stop
                  />
                </div>

                <!-- Vacant, idle -->
                <div v-else class="info-content info-content-center">
                  <div v-if="!isLoadingSlots" class="vacant-label">Empty slot</div>
                </div>
              </div>

              <!--
                Action column. It stops its own clicks: they would otherwise reach the
                row, and a row that becomes vacant during the click that emptied it —
                the delete confirmation — would read the same click as "save here".
              -->
              <div v-if="layout" class="layout-item-actions" @click.stop>
                <!-- Pending confirmation replaces the actions for this row -->
                <template v-if="pending?.id === layout.id">
                  <button
                    type="button"
                    class="btn btn-sm"
                    :class="pending?.danger ? 'btn-danger' : 'btn-primary'"
                    data-testid="confirm-action"
                    :disabled="store.busy"
                    @click="runPending"
                  >
                    {{ pending?.confirmLabel }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-secondary"
                    data-testid="cancel-action"
                    @click="pending = null"
                  >
                    Cancel
                  </button>
                </template>

                <template v-else-if="renamingId === layout.id">
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
                </template>

                <template v-else>
                  <HintTooltip
                    :text="loadDisabledReason(layout)"
                    :focusable="!!loadDisabledReason(layout)"
                    data-testid="load-layout-tooltip"
                  >
                    <button
                      type="button"
                      class="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center"
                      data-testid="load-layout"
                      :disabled="!!loadDisabledReason(layout)"
                      title="Load into the editor"
                      @click="requestLoad(layout)"
                    >
                      <BiBoxArrowInRight aria-hidden="true" />
                      <span class="d-none d-sm-inline ms-1">Load</span>
                    </button>
                  </HintTooltip>
                  <!--
                    The counterpart to Load, and the only way to overwrite: the row is
                    the destination, so nothing has to be typed to name one.
                  -->
                  <HintTooltip
                    :text="writeDisabledReason"
                    :focusable="!canWrite"
                    data-testid="save-here-tooltip"
                  >
                    <button
                      type="button"
                      class="btn btn-sm d-flex align-items-center justify-content-center"
                      :class="isCurrent(layout) ? 'btn-primary' : 'btn-outline-primary'"
                      data-testid="save-here"
                      :disabled="!canWrite"
                      title="Replace with the editor contents"
                      @click="requestOverwrite(layout)"
                    >
                      <BiFloppy aria-hidden="true" />
                      <span class="d-none d-sm-inline ms-1">Save</span>
                    </button>
                  </HintTooltip>
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
                </template>
              </div>

              <div v-else-if="isCreatingAt(index)" class="layout-item-actions" @click.stop>
                <HintTooltip
                  :text="createDisabledReason"
                  :focusable="!canCreate"
                  data-testid="new-name-tooltip"
                >
                  <button
                    type="button"
                    class="btn btn-sm btn-primary d-flex align-items-center justify-content-center"
                    data-testid="new-name-confirm"
                    :disabled="!canCreate"
                    @click.stop="commitCreate"
                  >
                    <BiCheckLg aria-hidden="true" />
                  </button>
                </HintTooltip>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                  data-testid="new-name-cancel"
                  @click.stop="cancelCreate"
                >
                  <BiXLg aria-hidden="true" />
                </button>
              </div>

              <!--
                Every vacant slot takes a save, and takes it where it stands: the row
                order is fixed for as long as the modal is open, so a layout put in the
                fourth slot is drawn in the fourth slot.
              -->
              <div v-else-if="isOpenSlot(index)" class="layout-item-actions" @click.stop>
                <HintTooltip
                  :text="writeDisabledReason"
                  :focusable="!canWrite"
                  data-testid="save-into-slot-tooltip"
                >
                  <button
                    type="button"
                    class="btn btn-sm btn-outline-primary d-flex align-items-center justify-content-center"
                    data-testid="save-into-slot"
                    :disabled="!canWrite"
                    title="Save the editor contents into this slot"
                    @click.stop="startCreate(index)"
                  >
                    <BiPlusLg aria-hidden="true" />
                    <span class="d-none d-sm-inline ms-1">Save</span>
                  </button>
                </HintTooltip>
              </div>
            </li>
          </ul>

          <!--
            The caption is always present, so filling the last slot changes the sentence
            and not the height. It is a caption rather than the banner it replaces because
            that one appeared on the fifth save and pushed the whole list down.

            An error takes this line rather than one of its own. It arrives in response to
            a click, and the dialog is centred, so anything that changes the body's height
            moves every row half that distance — under the pointer that was just used. The
            caption is the one line here that can be spared: it says how much room is left,
            which is not what matters while an error is on screen, and it comes back with
            the error, which the next action clears.

            It is anchored to the top of this line and grows downward into the body's
            padding, never upward: a message long enough to wrap must not reach the last
            row's buttons, which is exactly where a failed save leaves its name field open
            and waiting to be tried again.
          -->
          <div class="caption-line">
            <p class="small text-muted mb-0" data-testid="slot-caption">
              {{ quotaCaption }}
            </p>
            <div
              v-if="store.errorMessage"
              class="alert alert-danger py-1 px-2 mb-0 small caption-line-alert"
              data-testid="layouts-error"
              role="alert"
            >
              {{ store.errorMessage }}
            </div>
          </div>

          <p v-if="isLoadingSlots" class="visually-hidden" role="status">Loading your layouts…</p>
        </div>

        <div class="modal-footer">
          <!-- Kept away from the per-row actions: this one is about the whole list,
               and the footer is the only place that belongs to all of it. -->
          <HintTooltip
            class="me-auto"
            :text="downloadDisabledReason"
            :focusable="!canDownloadAll"
            data-testid="download-all-tooltip"
          >
            <button
              type="button"
              class="btn btn-outline-secondary d-flex align-items-center justify-content-center"
              data-testid="download-all-layouts"
              :disabled="!canDownloadAll"
              @click="downloadAll"
            >
              <BiDownload aria-hidden="true" />
              <span class="ms-1">Download all</span>
            </button>
          </HintTooltip>
          <button type="button" class="btn btn-secondary" @click="close">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Keyboard, type Key, type KeyboardMetadata } from '@adamws/kle-serial'
import { useKeyboardStore } from '@/stores/keyboard'
import { useLayoutsStore, MAX_NAME_LENGTH, type SavedLayout } from '@/stores/layouts'
import { encodeLayoutToUrl, decodeLayoutFromUrl } from '@/utils/url-sharing'
import { getSerializedData, stringifyWithRounding } from '@/utils/serialization'
import { createZip, type ZipEntry } from '@/utils/zip'
import { toast } from '@/composables/useToast'
import LayoutThumbnail from './LayoutThumbnail.vue'
import HintTooltip from './HintTooltip.vue'

import BiFloppy from 'bootstrap-icons/icons/floppy.svg'
import BiPlusLg from 'bootstrap-icons/icons/plus-lg.svg'
import BiDownload from 'bootstrap-icons/icons/download.svg'
// box-arrow-in-right, not one of the download arrows: `download.svg` already means
// "write a file to disk" in PlateDownloadButtons, and this loads into the editor. Its
// ink is also centred in its 16px box and only 12px tall, so it sits on the same
// optical line as the label — box-arrow-in-down's ran to the bottom edge of the box.
import BiBoxArrowInRight from 'bootstrap-icons/icons/box-arrow-in-right.svg'
import BiPencil from 'bootstrap-icons/icons/pencil.svg'
import BiTrash from 'bootstrap-icons/icons/trash.svg'
import BiCheckLg from 'bootstrap-icons/icons/check-lg.svg'
import BiXLg from 'bootstrap-icons/icons/x-lg.svg'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'

const props = defineProps<{ isVisible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const keyboardStore = useKeyboardStore()
const store = useLayoutsStore()

const listRef = ref<HTMLElement>()
// Inside v-for, so Vue hands back an array even though only one row is ever creating.
const createInputRef = ref<HTMLInputElement[] | HTMLInputElement>()

const renamingId = ref<string | null>(null)
const renameValue = ref('')

/** The slot asking for the name of the layout about to go into it, if any. */
const creatingIndex = ref<number | null>(null)
const createName = ref('')

interface PendingAction {
  id: string
  message: string
  confirmLabel: string
  danger: boolean
  run: () => Promise<void>
}
const pending = ref<PendingAction | null>(null)

/**
 * Why a write is unavailable, in the order the conditions are worth reporting. Both of
 * these resolve on their own, which is all a user needs to know here: a save is never
 * refused for being at the quota, because a full list has no open slot to press, and
 * saving over a slot is an update rather than an insert — the database only counts
 * inserts, so it stays available at the quota.
 *
 * Empty means the buttons work — `canWrite` is derived from it, so a button and the
 * explanation for it can never disagree.
 */
const writeDisabledReason = computed(() => {
  if (store.loading) return 'Waiting for your saved layouts to load…'
  if (store.busy) return 'Waiting for the previous action to finish…'
  return ''
})

const canWrite = computed(() => writeDisabledReason.value === '')

const createDisabledReason = computed(() => {
  if (writeDisabledReason.value) return writeDisabledReason.value
  if (!createName.value.trim()) return 'Enter a name for this layout first'
  return ''
})

const canCreate = computed(() => createDisabledReason.value === '')

/**
 * Load has one reason of its own: a payload that will not decode. The button has always
 * been disabled for that and has never said so, because a disabled `.btn` suppresses its
 * own pointer events and its `title` never fires.
 */
const loadDisabledReason = (layout: SavedLayout) => {
  if (store.busy) return 'Waiting for the previous action to finish…'
  if (!decoded(layout)) return 'This layout could not be read'
  return ''
}

const downloadDisabledReason = computed(() => {
  if (store.loading) return 'Waiting for your saved layouts to load…'
  if (store.busy) return 'Waiting for the previous action to finish…'
  if (store.layouts.length === 0) return 'You have no saved layouts to download yet'
  return ''
})

const canDownloadAll = computed(() => downloadDisabledReason.value === '')

/**
 * The order the slots are drawn in, as layout ids with `null` for a vacancy.
 *
 * It is taken when the modal opens and then left alone. A delete empties its slot where
 * it stands instead of pulling the rows beneath it up, and the next save drops into that
 * gap: for as long as the modal is on screen a row only ever changes what is in it, never
 * where it is. Reopening rebuilds the order from the store — oldest first — which is when
 * the gaps close up.
 */
const slotOrder = ref<(string | null)[]>([])

const takeSlotOrder = () => {
  const ids = store.layouts.map((layout) => layout.id)
  const count = Math.max(store.quota, ids.length)
  slotOrder.value = Array.from({ length: count }, (_, index) => ids[index] ?? null)
}

const placeAt = (index: number, id: string) => {
  while (slotOrder.value.length <= index) slotOrder.value.push(null)
  slotOrder.value[index] = id
}

const clearSlot = (id: string) => {
  const index = slotOrder.value.indexOf(id)
  if (index !== -1) slotOrder.value[index] = null
}

/**
 * One entry per slot the quota allows, in the order this session fixed, and `null` for
 * every vacancy. Rendering the vacant ones is what keeps the modal a fixed size: the row
 * count never changes, so saving or deleting swaps a row's contents instead of resizing
 * the dialog.
 */
const slots = computed<(SavedLayout | null)[]>(() => {
  const unplaced = new Map(store.layouts.map((layout) => [layout.id, layout]))
  const rows = slotOrder.value.map((id) => {
    const layout = id ? (unplaced.get(id) ?? null) : null
    if (layout) unplaced.delete(layout.id)
    return layout
  })

  // Anything the store holds that the order does not — a layout saved in another tab and
  // picked up by a refetch, or the very first render before an order has been taken —
  // goes into the gaps rather than nowhere.
  const stray = [...unplaced.values()]
  for (let index = 0; index < rows.length && stray.length > 0; index += 1) {
    if (!rows[index]) rows[index] = stray.shift()!
  }
  rows.push(...stray)

  // Never fewer rows than the quota allows; the vacancies are what the fixed size is made
  // of. Anything past it is a quota lowered since these were saved — those layouts stay
  // reachable (and deletable) rather than dropping out of the list.
  while (rows.length < store.quota) rows.push(null)
  return rows
})

/**
 * Every vacancy takes a save, and takes it where it stands. The order this session fixed
 * is what decides where a new layout is drawn, so an insert can go into any empty row
 * without disturbing the ones around it — there is no first-gap-only rule to explain.
 */
const isOpenSlot = (index: number) =>
  !isLoadingSlots.value && creatingIndex.value === null && slots.value[index] === null

const isCreatingAt = (index: number) => creatingIndex.value === index

/**
 * Only the first fetch of a session has nothing to show: a refetch keeps the previous
 * rows on screen until the new ones replace them, which is itself a way of not moving
 * anything.
 */
const isLoadingSlots = computed(() => store.loading && store.layouts.length === 0)

const quotaCaption = computed(() => {
  // A non-breaking space rather than nothing: until the first fetch lands the count is
  // not known, and an empty line would be a shorter line.
  if (isLoadingSlots.value) return '\u00a0'
  const used = store.layouts.length
  if (used >= store.quota) {
    return `All ${store.quota} slots are used — save over one, or delete one to free a slot.`
  }
  return `${used} of ${store.quota} slots used`
})

/**
 * Whether this row is where the editor's work came from. Both halves matter: the id says
 * which layout, and the token says the editor has not been handed something else since —
 * `layoutGeneration` moves whenever the contents are replaced wholesale, so an import or
 * a new layout retires the mark on its own. Editing does not: an edited layout is exactly
 * the one you want to put back in its own slot.
 */
const isCurrent = (layout: SavedLayout) =>
  store.activeId === layout.id && store.activeToken === keyboardStore.layoutGeneration

/**
 * Decoded payloads, so a re-render does not re-parse every row. A payload that fails to
 * decode yields null and the row degrades to a placeholder with Load disabled, rather
 * than taking the whole list down.
 *
 * Keyed by the payload and not by the layout id, which is what makes an overwrite show
 * up. An id survives a write, so the cache had to be invalidated by hand after one — and
 * that invalidation ran after the store mutation had already queued the re-render, so the
 * row could redraw from the entry it was about to drop and keep the old picture on screen
 * until something unrelated re-rendered it. Keyed by payload there is nothing to
 * invalidate: new contents are a new key, and LayoutThumbnail watches for exactly the new
 * `keys`/`metadata` identity a miss produces.
 */
const decodedCache = new Map<string, { keys: Key[]; meta: KeyboardMetadata } | null>()

const decoded = (layout: SavedLayout) => {
  const cached = decodedCache.get(layout.payload)
  if (cached !== undefined) return cached

  // A miss means a payload changed, so this is the moment to drop the ones nothing points
  // at any more — otherwise every overwrite would leave its predecessor here for the rest
  // of the session.
  const live = new Set(store.layouts.map((saved) => saved.payload))
  for (const key of decodedCache.keys()) {
    if (!live.has(key)) decodedCache.delete(key)
  }

  let result: { keys: Key[]; meta: KeyboardMetadata } | null = null
  try {
    const keyboard = decodeLayoutFromUrl(layout.payload)
    result = { keys: keyboard.keys, meta: keyboard.meta }
  } catch (error) {
    console.error(`Could not decode saved layout "${layout.name}":`, error)
  }
  decodedCache.set(layout.payload, result)
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

/**
 * Prefill from the layout's own name, and from nothing else — an unnamed layout offers an
 * empty field and its placeholder.
 *
 * `keyboardStore.filename` used to be the fallback, with 'Untitled layout' behind it.
 * But filename is what a download is called, not what the layout is: `loadKeyboard()`
 * never clears it and only some import paths set it, so it outlives the layout it came
 * from and proposed the previous one's name. An empty field is the better default — it
 * says nothing rather than saying something stale.
 */
const defaultName = () => keyboardStore.metadata.name?.trim() ?? ''

const focusIn = (selector: string) => {
  const target = listRef.value?.querySelector<HTMLElement>(selector)
  target?.focus()
  return !!target
}

/**
 * Where the first keystroke should go when the modal opens: the slot waiting to be
 * filled, or failing that the first saved layout. Neither writes anything on Enter —
 * both open a name field or a confirmation — so landing on one is safe.
 *
 * Skipped once the user has put focus somewhere themselves; the fetch this runs behind
 * can land well after the dialog is on screen.
 */
const focusPrimary = () => {
  const active = document.activeElement
  if (active && active !== document.body && active !== document.documentElement) return
  if (focusIn('[data-testid="save-into-slot"]')) return
  focusIn('[data-testid="load-layout"]')
}

const startCreate = (index: number) => {
  if (!canWrite.value || creatingIndex.value !== null) return
  pending.value = null
  cancelRename()
  creatingIndex.value = index
  createName.value = defaultName()
  void nextTick(() => {
    const input = createInputRef.value
    const element = Array.isArray(input) ? input[0] : input
    element?.focus()
    element?.select()
  })
}

const cancelCreate = () => {
  creatingIndex.value = null
  createName.value = ''
}

const commitCreate = async () => {
  if (!canCreate.value) return

  const index = creatingIndex.value
  if (index === null) return

  const saved = await store.save(createName.value, currentPayload())
  // A failed write keeps the field open with what was typed still in it; the reason is in
  // the alert floating over the slots.
  if (!saved) return

  cancelCreate()
  // Into the row that was pressed, not wherever the store happens to have put it.
  placeAt(index, saved.id)
  store.markActive(saved.id, keyboardStore.layoutGeneration)
  toast.showSuccess(`Saved "${saved.name}"`, 'My Layouts')

  // The button that was pressed no longer exists — the slot is a filled row now. Hand
  // focus to that row rather than dropping it back to the document.
  await nextTick()
  const row = listRef.value?.querySelectorAll('[data-testid="layout-slot"]')[index]
  row?.querySelector<HTMLElement>('[data-testid="load-layout"]')?.focus()
}

/**
 * Saving over a slot is how work is re-saved in place, and it is confirmed in the row
 * being replaced so it is obvious which layout is about to change. The row names it, so
 * the question does not repeat the name.
 */
const requestOverwrite = (layout: SavedLayout) => {
  if (!canWrite.value) return
  cancelCreate()
  cancelRename()
  pending.value = {
    id: layout.id,
    message: 'Replace with the editor contents?',
    confirmLabel: 'Replace',
    danger: false,
    run: async () => {
      const saved = await store.overwrite(layout.id, currentPayload())
      if (saved) {
        store.markActive(saved.id, keyboardStore.layoutGeneration)
        toast.showSuccess(`Updated "${saved.name}"`, 'My Layouts')
      }
    },
  }
}

/**
 * A layout name is free text; an archive entry name is not. Strip what Windows
 * refuses, and never return an empty stem, which would produce a bare ".json".
 */
const toEntryStem = (name: string) => {
  // Reserved on Windows: < > : " / \ | ? * and the C0 controls, none of
  // which a layout name is stopped from containing.
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim()
  return cleaned.replace(/[. ]+$/, '') || 'layout'
}

/**
 * Names are not unique across saved layouts, and sanitising can collide two that
 * were distinct, so entries are suffixed until they are. Compared case-insensitively
 * because the filesystems these land on generally are.
 */
const toEntryName = (stem: string, taken: Set<string>) => {
  let candidate = `${stem}.json`
  for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) {
    candidate = `${stem} (${n}).json`
  }
  taken.add(candidate.toLowerCase())
  return candidate
}

/**
 * The revoke is deferred rather than run in the same turn as `click()`: current
 * browsers snapshot the blob synchronously, but that is not guaranteed and revoking
 * immediately has historically raced the download handoff. A macrotask is enough — the
 * navigation has been queued by then.
 */
const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Every saved layout in one archive, as a backup.
 *
 * A zip of one ordinary .json per layout rather than a single combined file: each
 * entry is then exactly what "Export → Download JSON" produces for that layout, so
 * restoring one is an ordinary import and needs nothing that understands a bundle
 * format. A layout whose payload will not decode is skipped rather than failing the
 * download — the point of a backup is to rescue what is still readable.
 */
const downloadAll = () => {
  const taken = new Set<string>()
  const entries: ZipEntry[] = []
  let unreadable = 0

  for (const layout of store.layouts) {
    const entry = decoded(layout)
    if (!entry) {
      unreadable += 1
      continue
    }
    const keyboard = new Keyboard()
    keyboard.keys = entry.keys
    keyboard.meta = entry.meta
    entries.push({
      name: toEntryName(toEntryStem(layout.name), taken),
      text: stringifyWithRounding(getSerializedData(keyboard, 'kle'), 2),
    })
  }

  if (entries.length === 0) {
    toast.showError(
      unreadable > 0 ? 'None of your saved layouts could be read' : 'There is nothing to download',
      'Download Failed',
    )
    return
  }

  const now = new Date()
  try {
    saveBlob(
      new Blob([createZip(entries, now)], { type: 'application/zip' }),
      `kle-ng-layouts-${now.toISOString().slice(0, 10)}.zip`,
    )
  } catch (error) {
    console.error('Error building the layout archive:', error)
    toast.showError(
      error instanceof Error ? error.message : 'Could not build the archive',
      'Download Failed',
    )
    return
  }

  toast.showSuccess(
    unreadable > 0
      ? `Downloaded ${entries.length} of ${store.layouts.length} layouts — ${unreadable} could not be read`
      : `Downloaded ${entries.length} ${entries.length === 1 ? 'layout' : 'layouts'}`,
    'My Layouts',
  )
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
    // The token is read after the load, not before: loadKeyboard() is what moves it.
    store.markActive(layout.id, keyboardStore.layoutGeneration)
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
  cancelCreate()
  // Only interrupt when there is genuinely unsaved work to lose.
  if (keyboardStore.dirty) {
    pending.value = {
      id: layout.id,
      message: 'Discard unsaved changes?',
      // Named for the action, like the other two, so the button pair stays about the
      // same width whichever confirmation is open.
      confirmLabel: 'Load',
      danger: false,
      run: async () => applyLayout(layout),
    }
    return
  }
  applyLayout(layout)
}

const requestDelete = (layout: SavedLayout) => {
  cancelCreate()
  pending.value = {
    id: layout.id,
    message: 'Delete this layout permanently?',
    confirmLabel: 'Delete',
    danger: true,
    run: async () => {
      if (await store.remove(layout.id)) {
        // The row empties in place; nothing below it moves up to take its number.
        clearSlot(layout.id)
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
  cancelCreate()
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
  } else if (creatingIndex.value !== null) {
    cancelCreate()
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
      pending.value = null
      cancelRename()
      cancelCreate()
      store.errorMessage = null
      // Opening is when the gaps close up and any change from elsewhere is taken on.
      takeSlotOrder()
      void store.fetchAll(true).then(() => {
        takeSlotOrder()
        void nextTick(focusPrimary)
      })
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
    takeSlotOrder()
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

/*
 * The buttons here centre their contents with `d-flex align-items-center
 * justify-content-center`, the same way the download and matrix modals do. Without it
 * the icons — 16px inline replaced elements — rest ON the text baseline and ride low
 * next to a label.
 *
 * Those buttons always carry text, though, and these do not: rename and delete are
 * icon-only, and Load and Save drop their labels below 576px. A flex container has no
 * strut, so an icon-only one would be only as tall as its 16px icon while its labelled
 * neighbour keeps a 20px text box, and the row would step. This restores that line box —
 * its height is .btn-sm's line-height, set in bootstrap-custom.scss.
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

/*
 * The caption's line, and the containing block for the alert that covers it (see the
 * template). Sized by the caption, so it is the same height with or without an error.
 */
.caption-line {
  position: relative;
  margin-top: 0.75rem;
}

/*
 * Top-anchored, so the overhang of a message too long for one line goes down into the
 * modal body's padding and never up into the last row.
 */
.caption-line-alert {
  position: absolute;
  inset: 0 0 auto 0;
  box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.2);
}

/*
 * The cap is only reachable with a quota well past the five this was built for; the list
 * is exactly `quota` rows tall by construction, and five of them come to about 360px.
 * Past that scrolling is what should happen, so the dialog keeps its size.
 */
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

/*
 * A vacant slot is drawn as the outline of a row rather than as a row: dashed and
 * unfilled, so the spare ones read as space waiting to be used and not as things.
 */
.layout-item-vacant {
  border-style: dashed;
  background: none;
}

/*
 * The one vacant slot a save can land in. Its button is what a keyboard reaches and what
 * says precisely what will happen, but a click anywhere on a row that reads "empty" is
 * asking for the same thing, so the whole row takes one.
 */
.layout-item-open {
  cursor: pointer;
}

.layout-item-open:hover {
  border-color: var(--bs-primary);
  background: var(--bs-tertiary-bg);
}

.layout-item-open:hover .layout-item-thumb-vacant {
  border-color: var(--bs-primary);
}

.layout-item-open:hover .vacant-label {
  color: var(--bs-primary);
  opacity: 1;
}

/* The row the editor is showing; the same accent is on its Save button. */
.layout-item-current {
  border-color: var(--bs-primary);
}

.layout-item-thumb-vacant {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--bs-border-color);
  border-radius: var(--bs-border-radius-sm);
  color: var(--bs-secondary-color);
}

.vacant-preview {
  width: 78%;
  height: 78%;
  opacity: 0.2;
}

.vacant-label {
  color: var(--bs-secondary-color);
  opacity: 0.65;
  font-size: 0.8125rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/*
 * Until the first fetch lands it is not known whether these slots are empty, so they
 * pulse instead of saying so. (A Bootstrap spinner is not an option here — the
 * `spinners` partial is not one of the ones bootstrap-custom.scss imports.)
 */
.layout-item-thumb-vacant.is-pulsing {
  border-style: solid;
  background: var(--bs-tertiary-bg);
  animation: slot-pulse 1.4s ease-in-out infinite;
}

@keyframes slot-pulse {
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .layout-item-thumb-vacant.is-pulsing {
    animation: none;
  }
}

.layout-item-thumb.is-broken {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bs-tertiary-bg);
  border-radius: var(--bs-border-radius-sm);
}

/*
 * Every state of the text column shares one grid cell with an invisible copy of a filled
 * row's two lines, so a rename editor, a name field and a centred "Empty slot" are all
 * exactly as tall as the two lines they stand in for. Without it the single-input states
 * are shorter than the rest below 576px, where the text and not the thumbnail is what a
 * row is as tall as.
 */
.layout-item-info {
  flex: 1 1 auto;
  min-width: 0;
  display: grid;
}

.layout-item-info > * {
  grid-area: 1 / 1;
}

.info-sizer {
  visibility: hidden;
}

.info-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.info-content-center {
  align-items: center;
}

/*
 * The name and its marker share a line. The name is the part that gives way, so the
 * marker keeps its size and the name truncates against it.
 */
.layout-item-name {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}

.current-tag {
  flex-shrink: 0;
  padding: 0 0.3em;
  border: 1px solid var(--bs-primary);
  border-radius: var(--bs-border-radius-sm);
  color: var(--bs-primary);
  font-size: 0.6875rem;
  line-height: 1.4;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.layout-item-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

/*
 * The buttons never shrink, so anything long has to live in .layout-item-info, which
 * can (it is `flex: 1 1 auto; min-width: 0`). A flex item's automatic minimum size is
 * its content width, so a sentence placed in here instead would refuse to shrink and
 * spill out of the row — no `max-width` on this container can reach inside it to stop
 * that, which is exactly what the confirmation prompt used to do.
 */

@media (max-width: 575.98px) {
  .layout-item-thumb {
    width: 72px;
    height: 36px;
  }
}
</style>
