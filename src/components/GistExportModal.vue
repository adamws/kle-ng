<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="onBackdropClick">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ title }}</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>

        <!-- Connect. No token yet, so nothing can be sent to GitHub until the user
             agrees to a round trip. -->
        <div v-if="stage === 'connect'" class="modal-body">
          <p>
            Creating a gist needs your permission on GitHub. Signing in to kle-ng does not ask for
            it, so that an account you only use to save layouts never gets access to your gists.
          </p>
          <p class="mb-0 text-body-secondary">
            You will be sent to GitHub to approve <strong>gist access</strong> and brought straight
            back here. Your current layout is carried across, edits included.
          </p>

          <div
            v-if="errorMessage"
            class="alert alert-danger mt-3 mb-0"
            role="alert"
            data-testid="gist-error"
          >
            {{ errorMessage }}
          </div>
        </div>

        <!-- Options. Nothing has been created yet, and Cancel is still a way out. -->
        <div v-else-if="stage !== 'done'" class="modal-body">
          <div class="mb-3">
            <label for="gistFilename" class="form-label">File name</label>
            <input
              id="gistFilename"
              v-model="filename"
              type="text"
              class="form-control"
              data-testid="gist-filename"
              :disabled="stage === 'creating'"
            />
          </div>

          <div class="mb-3">
            <label for="gistDescription" class="form-label">
              Description <span class="text-body-secondary">(optional)</span>
            </label>
            <input
              id="gistDescription"
              v-model="description"
              type="text"
              class="form-control"
              data-testid="gist-description"
              :disabled="stage === 'creating'"
            />
          </div>

          <fieldset>
            <legend class="form-label fs-6">Visibility</legend>
            <div class="form-check">
              <input
                id="gistSecret"
                v-model="isPublic"
                class="form-check-input"
                type="radio"
                :value="false"
                data-testid="gist-secret"
                :disabled="stage === 'creating'"
              />
              <label class="form-check-label" for="gistSecret">
                Secret — not listed on your profile, but anyone with the link can open it
              </label>
            </div>
            <div class="form-check">
              <input
                id="gistPublic"
                v-model="isPublic"
                class="form-check-input"
                type="radio"
                :value="true"
                data-testid="gist-public"
                :disabled="stage === 'creating'"
              />
              <label class="form-check-label" for="gistPublic">
                Public — listed on your GitHub profile and searchable
              </label>
            </div>
          </fieldset>

          <p class="form-text mb-0">
            The gist is created in your own GitHub account, so you can edit or delete it there at
            any time. kle-ng keeps no copy.
          </p>

          <div
            v-if="errorMessage"
            class="alert alert-danger mt-3 mb-0"
            role="alert"
            data-testid="gist-error"
          >
            {{ errorMessage }}
          </div>
        </div>

        <!-- Result. The link is shown rather than pushed to the clipboard, so nothing
             changes behind the user's back and the field stays available if whatever
             they copied next overwrote it. -->
        <div v-else class="modal-body">
          <label for="gistUrl" class="form-label">Gist</label>
          <div class="input-group">
            <input
              id="gistUrl"
              ref="urlInput"
              type="text"
              class="form-control"
              data-testid="gist-url"
              :value="gistUrl"
              readonly
              @focus="selectAll"
            />
            <button
              type="button"
              class="btn"
              :class="copied ? 'btn-success' : 'btn-outline-secondary'"
              data-testid="gist-copy"
              @click="copy"
            >
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>
          <div class="form-text" data-testid="gist-hint">
            {{
              copyFailed
                ? 'Copying failed — select the link above and copy it manually.'
                : 'The gist is in your GitHub account — edit or delete it there any time.'
            }}
          </div>
        </div>

        <div class="modal-footer">
          <template v-if="stage === 'connect'">
            <button
              type="button"
              class="btn btn-secondary"
              data-testid="gist-cancel"
              @click="close"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              data-testid="gist-connect"
              :disabled="authStore.busy"
              @click="authorize"
            >
              Connect GitHub
            </button>
          </template>
          <template v-else-if="stage !== 'done'">
            <button
              type="button"
              class="btn btn-secondary"
              data-testid="gist-cancel"
              @click="close"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-primary"
              data-testid="gist-confirm"
              :disabled="stage === 'creating' || !filename.trim()"
              @click="confirm"
            >
              <span
                v-if="stage === 'creating'"
                class="spinner-border spinner-border-sm me-2"
                aria-hidden="true"
              ></span>
              {{ errorMessage ? 'Try again' : 'Create gist' }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            data-testid="gist-close"
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
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { useAuthStore } from '@/stores/auth'
import { useGistsStore } from '@/stores/gists'
import { stringifyWithRounding } from '@/utils/serialization'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()
const authStore = useAuthStore()
const gistsStore = useGistsStore()

type Stage = 'connect' | 'options' | 'creating' | 'done'

const stage = ref<Stage>('options')
const filename = ref('')
const description = ref('')
const isPublic = ref(false)
const gistUrl = ref('')
const errorMessage = ref<string | null>(null)
const copied = ref(false)
const copyFailed = ref(false)
const urlInput = ref<HTMLInputElement | null>(null)

let copiedTimer: ReturnType<typeof setTimeout> | null = null

const title = computed(() => {
  if (stage.value === 'done') return 'Your gist'
  if (stage.value === 'connect') return 'Connect GitHub'
  return 'Create a gist'
})

const close = () => emit('close')

// A misclick on the backdrop must not take the link away with it. Escape and the two
// close buttons still work — this only removes the dismissal that happens by accident.
const onBackdropClick = () => {
  if (stage.value === 'done') return
  close()
}

/**
 * The same name Export → Download JSON would use, so a gist and a downloaded file are
 * recognisably the same layout.
 */
const defaultFilename = () =>
  `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.json`

const authorize = () => {
  // The redirect leaves the page and there is no autosave, so the layout has to travel
  // in the URL. generateShareUrl() is the fragment the editor already restores on
  // startup; captureReturnUrl() inside the auth store keeps it across the round trip.
  gistsStore.authorize(keyboardStore.generateShareUrl())
}

const confirm = async () => {
  // The button is disabled while creating, but `stage` only reaches the DOM on the next
  // tick, so two clicks in one tick would both arrive here.
  if (stage.value === 'creating') return

  stage.value = 'creating'
  errorMessage.value = null

  try {
    const url = await gistsStore.create({
      filename: filename.value.trim(),
      content: stringifyWithRounding(keyboardStore.getSerializedData('kle'), 2),
      description: description.value.trim() || undefined,
      isPublic: isPublic.value,
    })
    if (!url) {
      errorMessage.value = gistsStore.errorMessage || 'Could not create a gist.'
      // A rejected token cannot be retried — send the user back to the consent step
      // rather than offering a "Try again" that is guaranteed to fail the same way.
      stage.value = gistsStore.needsAuthorization ? 'connect' : 'options'
      return
    }
    gistUrl.value = url
    stage.value = 'done'
    // Focus the field rather than copying: the user asked for a link, not for their
    // clipboard to change. Selecting it makes a manual copy one keystroke away.
    await nextTick()
    urlInput.value?.focus()
  } catch (error) {
    console.error('Error creating gist:', error)
    errorMessage.value = 'Could not create a gist. Please try again.'
    stage.value = 'options'
  }
}

const selectAll = () => urlInput.value?.select()

const copy = async () => {
  copyFailed.value = false
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(gistUrl.value)
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
  stage.value = authStore.hasGithubToken ? 'options' : 'connect'
  filename.value = defaultFilename()
  description.value = ''
  isPublic.value = false
  gistUrl.value = ''
  errorMessage.value = null
  copied.value = false
  copyFailed.value = false
  if (copiedTimer) {
    clearTimeout(copiedTimer)
    copiedTimer = null
  }
}

// Mounted already open — a resumed export, or a test. Initialised here rather than in
// onMounted so the first render is already on the right step: the starting stage depends
// on whether a GitHub token exists, and onMounted runs after the DOM has been built.
if (props.isVisible) reset()

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
