<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="close">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Import from URL</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="mb-3">
            <label for="urlInput" class="form-label">Enter URL</label>
            <input
              id="urlInput"
              v-model="urlImportInput"
              type="url"
              class="form-control"
              placeholder="https://..."
              @keyup.enter="importFromUrl"
            />
            <div class="form-text">
              Paste a link to a JSON file, GitHub Gist, Ergogen layout or a kle-ng share link. All
              formats are automatically detected.
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">Cancel</button>
          <button
            type="button"
            class="btn btn-primary"
            @click="importFromUrl"
            :disabled="!urlImportInput"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { toast } from '@/composables/useToast'
import { processJsonLayout } from '@/utils/json-layout-processor'
import { decodeLayoutFromUrl, fetchGistLayout, loadErgogenKeyboard } from '@/utils/url-sharing'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()
const urlImportInput = ref('')

const close = () => {
  urlImportInput.value = ''
  emit('close')
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.classList.add('modal-open')
      nextTick(() => {
        const urlInput = document.getElementById('urlInput') as HTMLInputElement
        if (urlInput) urlInput.focus()
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

const convertGitHubBlobToRaw = (url: string): string => {
  const blobMatch = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/)

  if (blobMatch) {
    const [, owner, repo, branch, path] = blobMatch
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
    console.log(`Converted GitHub blob URL to raw URL: ${rawUrl}`)
    toast.showInfo(
      'Detected GitHub blob URL - automatically converting to raw URL for import',
      'URL Converted',
      { duration: 3000 },
    )
    return rawUrl
  }

  return url
}

const importFromShareLink = async (shareUrl: string) => {
  if (shareUrl.includes(window.location.hash) && window.location.hash.startsWith('#share=')) {
    toast.showInfo('This layout is already loaded in the current page', 'Already Loaded')
    return
  }

  const hashIndex = shareUrl.indexOf('#share=')
  if (hashIndex === -1) throw new Error('Invalid share link format')

  const encodedData = shareUrl.substring(hashIndex + 7)
  const layoutData = decodeLayoutFromUrl(encodedData)

  keyboardStore.loadKeyboard(layoutData)
  keyboardStore.filename = 'shared-layout'
  keyboardStore.updateBaseline()

  toast.showSuccess('Layout imported from share link', 'Import Successful')
}

const importFromGist = async (gistUrl: string) => {
  const gistIdMatch = gistUrl.match(/gist\.github\.com\/(?:[^/]+\/)?([a-f0-9]+)/i)
  if (!gistIdMatch) throw new Error('Invalid GitHub Gist URL')

  const gistId = gistIdMatch[1]
  const apiUrl = `https://api.github.com/gists/${gistId}`

  const response = await fetch(apiUrl)
  if (!response.ok) {
    throw new Error(`Failed to fetch Gist: ${response.status} ${response.statusText}`)
  }

  const gistData = (await response.json()) as {
    files: Record<string, { filename: string; content: string }>
  }

  const jsonFile = Object.values(gistData.files).find((file) =>
    file.filename.toLowerCase().endsWith('.json'),
  )

  if (!jsonFile) throw new Error('No JSON file found in Gist')

  await processJsonLayout(jsonFile.content, `gist-${gistId}`, `gist-${gistId}`, keyboardStore)
}

const importFromUrlHash = async (urlWithHash: string) => {
  const currentHash = window.location.hash
  if (
    urlWithHash.includes(currentHash) &&
    (currentHash.startsWith('#url=') || currentHash.startsWith('#gist='))
  ) {
    toast.showInfo('This layout is already loaded in the current page', 'Already Loaded')
    return
  }

  let hashIndex = urlWithHash.indexOf('#url=')
  let prefix = '#url='

  if (hashIndex === -1) {
    hashIndex = urlWithHash.indexOf('#gist=')
    prefix = '#gist='
  }

  if (hashIndex === -1) throw new Error('Invalid URL hash format')

  const urlParam = urlWithHash.substring(hashIndex + prefix.length)
  const decodedUrl = decodeURIComponent(urlParam)

  if (decodedUrl.includes('gist.github.com')) {
    await importFromGist(decodedUrl)
  } else if (/^[a-f0-9]+$/i.test(decodedUrl)) {
    const layoutData = await fetchGistLayout(decodedUrl)
    keyboardStore.loadKeyboard(layoutData)
    keyboardStore.filename = `gist-${decodedUrl}`
    keyboardStore.updateBaseline()
    toast.showSuccess(`Layout imported from gist: ${decodedUrl}`, 'Import Successful')
  } else {
    await importFromDirectUrl(decodedUrl)
  }
}

const importFromErgogenUrl = async (ergogenUrl: string) => {
  const keyboard = await loadErgogenKeyboard(ergogenUrl)

  if (!keyboard) throw new Error('No valid Ergogen data found in URL')

  keyboardStore.loadKeyboard(keyboard)
  keyboardStore.filename = 'ergogen-import'
  keyboardStore.updateBaseline()

  toast.showSuccess(
    `Ergogen layout imported from URL: ${Object.keys(keyboard.keys).length} keys`,
    'Import Successful',
  )
}

const importFromDirectUrl = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`)
  }

  const jsonText = await response.text()

  const urlParts = url.split('/')
  const filenameWithExt = urlParts[urlParts.length - 1]
  if (!filenameWithExt) throw new Error('Invalid URL: cannot extract filename')
  const filenameWithoutExt = filenameWithExt.replace(/\.json$/, '')

  await processJsonLayout(jsonText, filenameWithExt, filenameWithoutExt, keyboardStore)
}

const importFromUrl = async () => {
  if (!urlImportInput.value) return

  try {
    let url = urlImportInput.value.trim()
    url = convertGitHubBlobToRaw(url)

    if (url.includes('ergogen.xyz') && url.includes('#')) {
      await importFromErgogenUrl(url)
    } else if (url.includes('#share=')) {
      await importFromShareLink(url)
    } else if (url.includes('#url=') || url.includes('#gist=')) {
      await importFromUrlHash(url)
    } else if (url.includes('gist.github.com')) {
      await importFromGist(url)
    } else {
      await importFromDirectUrl(url)
    }
  } catch (error) {
    console.error('Error importing from URL:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to import from URL'
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
</style>
