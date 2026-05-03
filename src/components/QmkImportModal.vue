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
            ref="searchInputRef"
            v-model="qmkSearchQuery"
            type="text"
            class="form-control mb-3"
            placeholder="Search keyboards (e.g. dactyl 4x5)…"
            autocomplete="off"
            @keydown.down.prevent="focusListItem(0)"
          />
          <div v-if="qmkListLoading" class="text-center text-muted py-3">
            <span class="spinner-border spinner-border-sm me-2"></span>Loading keyboard list…
          </div>
          <div v-else-if="qmkListError" class="alert alert-danger">{{ qmkListError }}</div>
          <div v-else ref="listRef" class="qmk-keyboard-list">
            <button
              v-for="(result, index) in filteredQmkKeyboards"
              :key="result.item"
              type="button"
              class="qmk-keyboard-item"
              :class="{ selected: qmkSelectedKeyboard === result.item }"
              @click="qmkSelectedKeyboard = result.item"
              @dblclick="importFromQmkBrowser"
              @focus="qmkSelectedKeyboard = result.item"
              @keydown="handleListKeydown($event, index)"
              v-html="result.html"
            ></button>
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
import { ref, computed, watch, shallowRef, nextTick, onMounted, onUnmounted } from 'vue'
import Fuse from 'fuse.js'
import { useKeyboardStore } from '@/stores/keyboard'
import { toast } from '@/composables/useToast'
import { convertQmkToKle } from '@/utils/qmk-import'
import { highlightMatches } from '@/utils/fuse-highlight'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

interface QmkSearchResult {
  item: string
  html: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

const searchInputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const qmkKeyboardList = ref<string[]>([])
const qmkSearchQuery = ref('')
const qmkSelectedKeyboard = ref<string | null>(null)
const qmkListLoading = ref(false)
const qmkListError = ref<string | null>(null)
const fuseInstance = shallowRef<Fuse<string> | null>(null)

watch(qmkKeyboardList, (list) => {
  if (!list.length) return
  fuseInstance.value = new Fuse(list, {
    includeScore: true,
    includeMatches: true,
    threshold: 0.4,
    ignoreLocation: true,
    minMatchCharLength: 2,
    distance: 200,
  })
})

const filteredQmkKeyboards = computed<QmkSearchResult[]>(() => {
  const query = qmkSearchQuery.value.trim()
  const source = qmkKeyboardList.value

  if (!query) {
    return source.map((item) => ({ item, html: item }))
  }

  const fuse = fuseInstance.value
  if (!fuse) return []

  return fuse.search(query).map(({ item, matches }) => {
    const indices = matches?.[0]?.indices ?? []
    return { item, html: highlightMatches(item, indices) }
  })
})

watch(qmkSearchQuery, () => {
  qmkSelectedKeyboard.value = null
})

function listItems(): HTMLButtonElement[] {
  return listRef.value
    ? Array.from(listRef.value.querySelectorAll<HTMLButtonElement>('.qmk-keyboard-item'))
    : []
}

function focusListItem(index: number) {
  listItems()[index]?.focus()
}

function handleListKeydown(event: KeyboardEvent, index: number) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusListItem(index + 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (index === 0) {
      searchInputRef.value?.focus()
    } else {
      focusListItem(index - 1)
    }
  } else if (event.key === 'Enter') {
    importFromQmkBrowser()
  }
}

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
        searchInputRef.value?.focus()
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
  height: 360px;
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

.qmk-keyboard-item:focus-visible {
  outline: none;
}

.qmk-keyboard-item mark {
  background-color: #ffe066;
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.qmk-keyboard-item.selected mark {
  background-color: rgba(255, 255, 255, 0.35);
  color: #fff;
}
</style>
