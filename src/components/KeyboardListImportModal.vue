<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="close">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ title }}</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <input
            :id="`${prefix}SearchInput`"
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="form-control mb-3"
            placeholder="Search keyboards (e.g. dactyl 4x5)…"
            autocomplete="off"
            @keydown.down.prevent="focusListItem(0)"
          />
          <div v-if="listLoading" class="text-center text-muted py-3">
            <span class="spinner-border spinner-border-sm me-2"></span>Loading keyboard list…
          </div>
          <div v-else-if="listError" class="alert alert-danger">{{ listError }}</div>
          <div v-else ref="listRef" :class="`${prefix}-keyboard-list`">
            <button
              v-for="(result, index) in filteredKeyboards"
              :key="result.item"
              type="button"
              :class="[`${prefix}-keyboard-item`, { selected: selectedKeyboard === result.item }]"
              @click="selectedKeyboard = result.item"
              @dblclick="performImport"
              @focus="selectedKeyboard = result.item"
              @keydown="handleListKeydown($event, index)"
              v-html="result.html"
            ></button>
            <p v-if="!filteredKeyboards.length" class="text-muted fst-italic text-center py-3">
              No keyboards match your search
            </p>
          </div>
          <div class="form-text mt-2">
            {{
              searchQuery.trim()
                ? `${filteredKeyboards.length} result(s)`
                : `${keyboardList.length} keyboards available`
            }}
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            @click="performImport"
            :disabled="!selectedKeyboard"
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
import { toast } from '@/composables/useToast'
import { highlightMatches } from '@/utils/fuse-highlight'

interface Props {
  isVisible: boolean
  title: string
  listUrl: string
  label: string
  prefix: string
  importFn: (name: string) => Promise<void>
}

interface Emits {
  (e: 'close'): void
}

interface SearchResult {
  item: string
  html: string
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const searchInputRef = ref<HTMLInputElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const keyboardList = ref<string[]>([])
const searchQuery = ref('')
const selectedKeyboard = ref<string | null>(null)
const listLoading = ref(false)
const listError = ref<string | null>(null)
const fuseInstance = shallowRef<Fuse<string> | null>(null)

watch(keyboardList, (list) => {
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

const filteredKeyboards = computed<SearchResult[]>(() => {
  const query = searchQuery.value.trim()
  const source = keyboardList.value

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

watch(searchQuery, () => {
  selectedKeyboard.value = null
})

function listItems(): HTMLButtonElement[] {
  return listRef.value
    ? Array.from(
        listRef.value.querySelectorAll<HTMLButtonElement>(`.${props.prefix}-keyboard-item`),
      )
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
    performImport()
  }
}

const close = () => {
  searchQuery.value = ''
  selectedKeyboard.value = null
  emit('close')
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

const fetchKeyboardList = async () => {
  if (keyboardList.value.length > 0) return
  listLoading.value = true
  listError.value = null
  try {
    const resp = await fetch(props.listUrl)
    if (!resp.ok) throw new Error(`Failed to fetch keyboard list: ${resp.status}`)
    const data = await resp.json()
    keyboardList.value = data.keyboards ?? []
  } catch (e) {
    listError.value = e instanceof Error ? e.message : 'Failed to fetch keyboard list'
  } finally {
    listLoading.value = false
  }
}

watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.classList.add('modal-open')
      fetchKeyboardList()
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

const performImport = async () => {
  if (!selectedKeyboard.value) return
  const name = selectedKeyboard.value
  try {
    await props.importFn(name)
    toast.showSuccess(`${props.label} keyboard "${name}" imported`, 'Import Successful')
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : `Failed to import ${props.label} keyboard`
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

.qmk-keyboard-list,
.via-keyboard-list {
  height: 360px;
  overflow-y: auto;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}

.qmk-keyboard-item,
.via-keyboard-item {
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

.qmk-keyboard-item:last-child,
.via-keyboard-item:last-child {
  border-bottom: none;
}

.qmk-keyboard-item:hover,
.via-keyboard-item:hover {
  background-color: var(--bs-tertiary-bg);
}

.qmk-keyboard-item.selected,
.via-keyboard-item.selected {
  background-color: var(--bs-primary);
  color: #fff;
}

.qmk-keyboard-item:focus-visible,
.via-keyboard-item:focus-visible {
  outline: none;
}

.qmk-keyboard-item :deep(mark),
.via-keyboard-item :deep(mark) {
  background-color: #ffe066;
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}

.qmk-keyboard-item.selected :deep(mark),
.via-keyboard-item.selected :deep(mark) {
  background-color: rgba(255, 255, 255, 0.35);
  color: #fff;
}
</style>
