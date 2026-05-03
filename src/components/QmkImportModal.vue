<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="close">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Import from QMK</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <input
            id="qmkSearchInput"
            v-model="qmkSearchQuery"
            type="text"
            class="form-control mb-3"
            placeholder="Search keyboards (e.g. dactyl 4x5)…"
            autocomplete="off"
          />
          <div v-if="qmkListLoading" class="text-center text-muted py-3">
            <span class="spinner-border spinner-border-sm me-2"></span>Loading keyboard list…
          </div>
          <div v-else-if="qmkListError" class="alert alert-danger">{{ qmkListError }}</div>
          <div v-else class="qmk-keyboard-list">
            <button
              v-for="kb in filteredQmkKeyboards"
              :key="kb"
              type="button"
              class="qmk-keyboard-item"
              :class="{ selected: qmkSelectedKeyboard === kb }"
              @click="qmkSelectedKeyboard = kb"
              @dblclick="importFromQmkBrowser"
            >
              {{ kb }}
            </button>
            <p v-if="!filteredQmkKeyboards.length" class="text-muted fst-italic text-center py-3">
              No keyboards match your search
            </p>
          </div>
          <div class="form-text mt-2">
            {{
              qmkSearchQuery.trim()
                ? `${filteredQmkKeyboards.length} result(s)`
                : `${qmkKeyboardList.length} keyboards available`
            }}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            @click="importFromQmkBrowser"
            :disabled="!qmkSelectedKeyboard"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { toast } from '@/composables/useToast'
import { convertQmkToKle } from '@/utils/qmk-import'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

const qmkKeyboardList = ref<string[]>([])
const qmkSearchQuery = ref('')
const qmkSelectedKeyboard = ref<string | null>(null)
const qmkListLoading = ref(false)
const qmkListError = ref<string | null>(null)

const filteredQmkKeyboards = computed(() => {
  const words = qmkSearchQuery.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const source = qmkKeyboardList.value
  if (!words.length) return source
  return source.filter((k) => {
    const t = k.toLowerCase()
    return words.every((w) => t.includes(w))
  })
})

watch(qmkSearchQuery, () => {
  qmkSelectedKeyboard.value = null
})

const close = () => {
  qmkSearchQuery.value = ''
  qmkSelectedKeyboard.value = null
  emit('close')
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

const fetchQmkKeyboardList = async () => {
  if (qmkKeyboardList.value.length > 0) return
  qmkListLoading.value = true
  qmkListError.value = null
  try {
    const resp = await fetch('https://keyboards.qmk.fm/v1/keyboard_list.json')
    if (!resp.ok) throw new Error(`Failed to fetch keyboard list: ${resp.status}`)
    const data = await resp.json()
    qmkKeyboardList.value = data.keyboards ?? []
  } catch (e) {
    qmkListError.value = e instanceof Error ? e.message : 'Failed to fetch keyboard list'
  } finally {
    qmkListLoading.value = false
  }
}

watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.classList.add('modal-open')
      fetchQmkKeyboardList()
      nextTick(() => {
        const searchInput = document.getElementById('qmkSearchInput') as HTMLInputElement
        if (searchInput) searchInput.focus()
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
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.body.classList.remove('modal-open')
})

const importFromQmkBrowser = async () => {
  if (!qmkSelectedKeyboard.value) return
  const name = qmkSelectedKeyboard.value
  const url = `https://keyboards.qmk.fm/v1/keyboards/${name}/info.json`
  try {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`)
    const data = await resp.json()
    const keyboardData = data.keyboards?.[name]
    if (!keyboardData) throw new Error(`Keyboard data not found for "${name}"`)
    const keyboard = convertQmkToKle(keyboardData)
    keyboardStore.loadKeyboard(keyboard)
    keyboardStore.filename = name.replace(/\//g, '-')
    keyboardStore.updateBaseline()
    toast.showSuccess(`QMK keyboard "${name}" imported`, 'Import Successful')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to import QMK keyboard'
    toast.showError(errorMessage, 'Import Failed')
  } finally {
    close()
  }
}
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
}

.qmk-keyboard-list {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}

.qmk-keyboard-item {
  display: block;
  width: 100%;
  padding: 0.4rem 0.75rem;
  text-align: left;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--bs-border-color);
  font-family: var(--bs-font-monospace);
  font-size: 0.875rem;
  color: var(--bs-body-color);
  cursor: pointer;
  transition: background-color 0.1s;
}

.qmk-keyboard-item:last-child {
  border-bottom: none;
}

.qmk-keyboard-item:hover {
  background-color: var(--bs-tertiary-bg);
}

.qmk-keyboard-item.selected {
  background-color: var(--bs-primary);
  color: #fff;
}
</style>
