<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="onBackdropClick">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            {{ stage === 'done' ? 'Your short link' : 'Create a short link?' }}
          </h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>

        <!-- Consent. Nothing has been stored yet, and Cancel is still a way out. -->
        <div v-if="stage !== 'done'" class="modal-body">
          <p>
            A short link stores this layout on the kle-ng server and gives you a URL that points at
            it. Before you create one:
          </p>
          <ul class="mb-3">
            <li class="mb-2">
              <strong>It makes the design public.</strong> Anyone who has the link can open the
              layout, without signing in. Treat creating a short link as publishing the design.
            </li>
            <li class="mb-2">
              <strong>It cannot be undone.</strong> There is no way to delete a short link or
              withdraw a layout once it has been stored — not from the app, and not by deleting your
              account. Assume it is permanent.
            </li>
            <li class="mb-2">
              <strong>kle-ng may keep and use it.</strong> The stored layout may be retained
              indefinitely and used by kle-ng in the future, including after you stop using the app.
            </li>
          </ul>
          <p class="mb-0 text-body-secondary">
            If you would rather not store anything on the server, use the plain
            <strong>Share Link</strong> button instead. It packs the whole layout into the URL, so
            it needs no account and no server — it is just much longer.
          </p>

          <div
            v-if="errorMessage"
            class="alert alert-danger mt-3 mb-0"
            role="alert"
            data-testid="short-link-error"
          >
            {{ errorMessage }}
          </div>
        </div>

        <!-- Result. The link is shown rather than pushed to the clipboard, so nothing
             changes behind the user's back and the field stays available if whatever
             they copied next overwrote it. -->
        <div v-else class="modal-body">
          <label for="shortLinkUrl" class="form-label">Short link</label>
          <div class="input-group">
            <input
              id="shortLinkUrl"
              ref="urlInput"
              type="text"
              class="form-control"
              data-testid="short-link-url"
              :value="shortUrl"
              readonly
              @focus="selectAll"
            />
            <button
              type="button"
              class="btn"
              :class="copied ? 'btn-success' : 'btn-outline-secondary'"
              data-testid="short-link-copy"
              @click="copy"
            >
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
          <div class="form-text" data-testid="short-link-hint">
            {{
              copyFailed
                ? 'Copying failed — select the link above and copy it manually.'
                : 'Save this link before closing'
            }}
          </div>
        </div>

        <div class="modal-footer">
          <template v-if="stage !== 'done'">
            <button
              type="button"
              class="btn btn-secondary"
              data-testid="short-link-cancel"
              @click="close"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              data-testid="short-link-confirm"
              :disabled="stage === 'creating'"
              @click="confirm"
            >
              <span
                v-if="stage === 'creating'"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>
              {{ errorMessage ? 'Try again' : 'Create short link' }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            data-testid="short-link-close"
            @click="close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { useShortLinksStore } from '@/stores/short-links'
import { buildShortLinkUrl } from '@/utils/short-links'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()
const shortLinksStore = useShortLinksStore()

type Stage = 'consent' | 'creating' | 'done'

const stage = ref<Stage>('consent')
const shortUrl = ref('')
const errorMessage = ref<string | null>(null)
const copied = ref(false)
const copyFailed = ref(false)
const urlInput = ref<HTMLInputElement | null>(null)

let copiedTimer: ReturnType<typeof setTimeout> | null = null

const close = () => emit('close')

// A misclick on the backdrop must not take the link away with it. Escape and the two
// close buttons still work — this only removes the dismissal that happens by accident.
const onBackdropClick = () => {
  if (stage.value === 'done') return
  close()
}

const confirm = async () => {
  // The button is disabled while creating, but `stage` only reaches the DOM on the next
  // tick, so two clicks in one tick would both arrive here.
  if (stage.value === 'creating') return

  stage.value = 'creating'
  errorMessage.value = null

  try {
    const id = await shortLinksStore.create(keyboardStore.encodeCurrentLayout())
    if (!id) {
      errorMessage.value = shortLinksStore.errorMessage || 'Could not create a short link.'
      stage.value = 'consent'
      return
    }
    shortUrl.value = buildShortLinkUrl(id)
    stage.value = 'done'
    // Focus the field rather than copying: the user asked for a link, not for their
    // clipboard to change. Selecting it makes a manual copy one keystroke away.
    await nextTick()
    urlInput.value?.focus()
  } catch (error) {
    console.error('Error creating short link:', error)
    errorMessage.value = 'Could not create a short link. Please try again.'
    stage.value = 'consent'
  }
}

const selectAll = () => urlInput.value?.select()

const copy = async () => {
  copyFailed.value = false
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(shortUrl.value)
    copied.value = true
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // The link is on screen either way, so a refused clipboard is a hint, not an error.
    copyFailed.value = true
    selectAll()
  }
}

const reset = () => {
  stage.value = 'consent'
  shortUrl.value = ''
  errorMessage.value = null
  copied.value = false
  copyFailed.value = false
  if (copiedTimer) {
    clearTimeout(copiedTimer)
    copiedTimer = null
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      // Reset on open, not on close: a link left in the field would otherwise be the
      // first thing the next layout's dialog showed.
      reset()
      document.addEventListener('keydown', handleKeyDown)
      document.body.classList.add('modal-open')
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
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
}
</style>
