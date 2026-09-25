<template>
  <div
    v-if="isVisible"
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="preset-import-title"
    data-testid="modal-preset-import"
    @click.self="onBackdropClick"
  >
    <div class="modal-dialog modal-dialog-centered modal-xl">
      <div class="modal-content">
        <div class="modal-header">
          <h5 id="preset-import-title" class="modal-title">Import from Preset</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>

        <div class="modal-body">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="form-control mb-3"
            data-testid="preset-search"
            placeholder="Search presets (e.g. 60%, ortho, split)…"
            autocomplete="off"
            @keydown.down.prevent="focusCard(0)"
          />

          <!--
            Fixed height, not content height: the grid is what a search narrows, and
            the modal must not jump around under the pointer while it is being typed
            into — least of all collapse when a query matches nothing.
          -->
          <div ref="scrollRef" class="preset-scroll-area" @scroll="dismissLanguageMenu">
            <!--
              One card per preset, and the card is the preview: there is nothing to
              read here that the picture does not already say, so a click loads
              straight away rather than selecting for a second confirmation step.

              A preset with several sets of legends keeps that single click — it loads
              the default. The language control in the corner is strictly optional, and
              is a sibling of the card rather than a child because a <button> cannot
              legally contain another one.
            -->
            <div v-if="filteredPresets.length" ref="gridRef" class="preset-grid">
              <div
                v-for="(entry, index) in filteredPresets"
                :key="entry.preset.id"
                class="preset-card-slot"
              >
                <button
                  type="button"
                  class="preset-card"
                  data-testid="preset-card"
                  :data-preset-id="entry.preset.id"
                  :data-preset-name="entry.preset.name"
                  :title="cardTitle(entry.preset)"
                  @click="choose(entry.preset)"
                  @keydown="handleGridKeydown($event, index)"
                >
                  <span class="preset-card-thumb">
                    <LayoutThumbnail
                      v-if="isDrawable(entry.preset.id)"
                      :keys="previews[entry.preset.id]!.data!.keyboard.keys"
                      :metadata="previews[entry.preset.id]!.data!.keyboard.meta"
                      class="preset-thumb-canvas"
                    />
                    <!--
                      blank.json deserializes to zero keys, which the preview renderer
                      would draw as an 18x18 white square — indistinguishable from a
                      broken render. Say what it is instead.
                    -->
                    <span
                      v-else-if="statusOf(entry.preset.id) === 'ready'"
                      class="preset-card-empty"
                      data-testid="preset-card-empty"
                    >
                      Empty canvas
                    </span>
                    <span
                      v-else-if="statusOf(entry.preset.id) === 'error'"
                      class="preset-card-failed"
                      data-testid="preset-card-error"
                    >
                      <BiExclamationTriangle class="text-warning" aria-hidden="true" />
                    </span>
                    <span v-else class="preset-card-skeleton" aria-hidden="true"></span>
                  </span>

                  <span class="preset-card-name text-truncate" v-html="entry.html"></span>
                  <span
                    class="preset-card-meta small text-muted"
                    :class="{ 'preset-card-meta-inset': languageCount(entry.preset) > 1 }"
                    :style="
                      languageCount(entry.preset) > 1
                        ? { '--lang-code-chars': selectedLanguageCode(entry.preset).length }
                        : undefined
                    "
                    >{{ metaLine(entry.preset) }}</span
                  >
                </button>

                <!--
                  A selector, not an action: it only changes which language THIS card
                  would load, and loading still happens by clicking the card. Styled
                  from scratch because Bootstrap's `badge` partial is not compiled into
                  this app, so .badge would render as unstyled text.
                -->
                <button
                  v-if="languageCount(entry.preset) > 1"
                  type="button"
                  class="preset-lang-toggle"
                  data-testid="preset-language-toggle"
                  :data-preset-languages="languageCount(entry.preset)"
                  :aria-expanded="openLanguageId === entry.preset.id"
                  aria-haspopup="menu"
                  :aria-label="`${entry.preset.name}: legends, currently ${selectedLanguageName(entry.preset)}`"
                  :title="`Legends: ${selectedLanguageName(entry.preset)} — click to change`"
                  @click.stop="toggleLanguageMenu(entry.preset, $event)"
                  @keydown="handleToggleKeydown(entry.preset, $event)"
                >
                  <BiGlobe2 class="preset-lang-globe" aria-hidden="true" />
                  <span class="preset-lang-code">{{ selectedLanguageCode(entry.preset) }}</span>
                  <BiCaretDown class="preset-lang-caret" aria-hidden="true" />
                </button>
              </div>
            </div>

            <p
              v-else
              class="preset-empty-state text-muted fst-italic text-center mb-0"
              data-testid="preset-empty-state"
            >
              No presets match your search
            </p>
          </div>

          <div class="form-text mt-2" data-testid="preset-count">
            {{
              searchQuery.trim()
                ? `${filteredPresets.length} result(s)`
                : `${ALL_PRESETS.length} presets available`
            }}
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="close">Close</button>
        </div>
      </div>
    </div>

    <!--
      One menu for the whole grid rather than one per card, positioned with `fixed`
      from the toggle's rect. Anything absolutely positioned inside a card would be
      clipped by the scroll area's `overflow`, and a card in the last row would open
      its menu into a region the user has to scroll to reach.
    -->
    <div
      v-if="openLanguagePreset"
      ref="langMenuRef"
      class="preset-lang-menu"
      role="menu"
      data-testid="preset-language-menu"
      :style="langMenuStyle"
      :aria-label="`Legends for ${openLanguagePreset.name}`"
    >
      <template
        v-for="(language, index) in presetLanguages(openLanguagePreset)"
        :key="language.code"
      >
        <button
          type="button"
          role="menuitem"
          class="preset-lang-option"
          data-testid="preset-language-option"
          :data-language-code="language.code"
          @click="pickLanguage(language.code)"
          @keydown="handleMenuKeydown($event, index)"
        >
          <span class="preset-lang-option-name text-truncate">{{ language.name }}</span>
          <span class="preset-lang-option-code">{{ language.code }}</span>
          <!-- A fixed slot on every row, so the check never pushes one code out of the column. -->
          <span class="preset-lang-option-mark">
            <BiCheck2
              v-if="language.code === selectedLanguageCodeRaw(openLanguagePreset)"
              class="preset-lang-option-check"
              aria-hidden="true"
            />
          </span>
        </button>
        <!--
          The default is pinned first and the rest are alphabetical; without a rule it
          reads as one mis-sorted entry. Not worth it for a two-language menu.
        -->
        <div
          v-if="index === 0 && languageCount(openLanguagePreset) > 2"
          role="separator"
          class="preset-lang-separator"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import Fuse from 'fuse.js'
import { useKeyboardStore } from '@/stores/keyboard'
import { toast } from '@/composables/useToast'
import { escapeHtml, highlightMatches } from '@/utils/fuse-highlight'
import {
  ALL_PRESETS,
  applyPreset,
  defaultLanguageOf,
  loadPresetPreview,
  presetLanguages,
  presetPayload,
  type Preset,
  type PresetPreview,
} from '@/utils/presets'
import { isTypeaheadKey, typeaheadIndex } from '@/utils/typeahead'
import LayoutThumbnail from './LayoutThumbnail.vue'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'
import BiGlobe2 from 'bootstrap-icons/icons/globe2.svg'
import BiCaretDown from 'bootstrap-icons/icons/caret-down-fill.svg'
import BiCheck2 from 'bootstrap-icons/icons/check2.svg'

/**
 * Browses the whole built-in preset library.
 *
 * The Import dropdown lists only the curated `TOP_PRESETS`; everything else is
 * reachable here. Cards draw the layout with the same renderer as the editor
 * canvas (via LayoutThumbnail), so boards can be told apart at a glance.
 */

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

interface SearchResult {
  preset: Preset
  /** The preset name, escaped, with Fuse's match ranges wrapped in <mark> */
  html: string
}

type PreviewStatus = 'loading' | 'ready' | 'error'

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

const searchInputRef = ref<HTMLInputElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const gridRef = ref<HTMLElement | null>(null)

const searchQuery = ref('')
const previews = ref<Record<string, { status: PreviewStatus; data?: PresetPreview }>>({})

// Which language each card is set to, keyed by preset id. Absent means "the preset's
// default", so the common case stores nothing and a card is correct before it is ever
// touched. This is a staging area only — picking a language changes what the card
// WOULD load, and loading still takes a click on the card itself.
const selectedLanguages = ref<Record<string, string>>({})

// The preset whose language menu is open, or null. One menu exists at a time, so
// this doubles as the menu's visibility.
const openLanguagePreset = ref<Preset | null>(null)
const openLanguageId = computed(() => openLanguagePreset.value?.id ?? null)
const langMenuRef = ref<HTMLElement | null>(null)
const langMenuStyle = ref<Record<string, string>>({})
let langTrigger: HTMLElement | null = null

// Type-ahead state for the open menu: what has been typed so far, and the timer that
// clears it after a pause. Reset whenever the menu closes.
const TYPEAHEAD_RESET_MS = 500
let typeaheadBuffer = ''
let typeaheadTimer: ReturnType<typeof setTimeout> | undefined

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

// The catalogue is a static import, so the index is built once for the module
// rather than per modal instance.
const fuse = new Fuse(ALL_PRESETS as Preset[], {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'keywords', weight: 2 },
    { name: 'description', weight: 1 },
  ],
  includeMatches: true,
  // Tighter than the QMK/VIA list's 0.4, which is tuned for long slash-separated
  // keyboard paths. Preset names are short, so 0.4 lets a three-letter query like
  // "iso" reach half the catalogue; 0.3 returns the two ISO boards and stops.
  threshold: 0.3,
  ignoreLocation: true,
  minMatchCharLength: 2,
  distance: 200,
})

const filteredPresets = computed<SearchResult[]>(() => {
  const query = searchQuery.value.trim()
  if (!query) {
    return ALL_PRESETS.map((preset) => ({ preset, html: escapeHtml(preset.name) }))
  }

  return fuse.search(query).map(({ item, matches }) => {
    // highlightMatches indexes into the string it is given, so only a hit on
    // `name` can be highlighted. Indices from a `keywords` or `description`
    // match would mark arbitrary characters of the displayed name.
    const nameMatch = matches?.find((match) => match.key === 'name')
    return {
      preset: item,
      html: nameMatch
        ? highlightMatches(item.name, nameMatch.indices as [number, number][])
        : escapeHtml(item.name),
    }
  })
})

/* -------------------------------------------------------------------------- */
/* Previews                                                                    */
/* -------------------------------------------------------------------------- */

// Keyed by preset id, not payload path: a multilingual preset draws its default
// language, and the card must not change identity when that default changes.
const statusOf = (id: string): PreviewStatus | undefined => previews.value[id]?.status

const isDrawable = (id: string) => {
  const entry = previews.value[id]
  return entry?.status === 'ready' && (entry.data?.keyCount ?? 0) > 0
}

const metaLine = (preset: Preset) => {
  const entry = previews.value[preset.id]
  if (!entry || entry.status === 'loading') return ' ' // reserve the line so cards never resize
  if (entry.status === 'error') return 'Preview unavailable'
  const count = entry.data?.keyCount ?? 0
  return count === 0 ? 'Empty' : `${count} ${count === 1 ? 'key' : 'keys'}`
}

const languageCount = (preset: Preset) => presetLanguages(preset).length

/** The language this card is currently set to — its own default until changed. */
const selectedLanguageCodeRaw = (preset: Preset) =>
  selectedLanguages.value[preset.id] ?? defaultLanguageOf(preset)?.code ?? ''
const selectedLanguageCode = (preset: Preset) => selectedLanguageCodeRaw(preset).toUpperCase()
const selectedLanguageName = (preset: Preset) =>
  presetLanguages(preset).find((language) => language.code === selectedLanguageCodeRaw(preset))
    ?.name ?? ''

const cardTitle = (preset: Preset) => {
  const base = preset.description || preset.name
  return languageCount(preset) > 1
    ? `${base} — loads ${selectedLanguageName(preset)} legends`
    : base
}

const ensurePreview = async (preset: Preset) => {
  const id = preset.id
  if (previews.value[id]) return // loading, ready or failed — all settled decisions
  previews.value = { ...previews.value, [id]: { status: 'loading' } }
  try {
    // The default language: the geometry is identical across languages, so which one
    // is drawn does not matter, and this keeps the request count independent of how
    // many languages a preset has.
    const data = await loadPresetPreview(presetPayload(preset))
    previews.value = { ...previews.value, [id]: { status: 'ready', data } }
  } catch (error) {
    console.error(`Could not render preview for preset "${id}":`, error)
    previews.value = { ...previews.value, [id]: { status: 'error' } }
  }
}

/* -------------------------------------------------------------------------- */
/* Lazy loading of the cards on screen                                         */
/* -------------------------------------------------------------------------- */

let observer: IntersectionObserver | null = null

const teardownObserver = () => {
  observer?.disconnect()
  observer = null
}

const setupObserver = () => {
  teardownObserver()
  if (!gridRef.value) return

  // No IntersectionObserver (jsdom): the catalogue is a handful of small
  // same-origin files, so loading all of them is a fine degenerate path.
  if (typeof IntersectionObserver === 'undefined') {
    for (const preset of ALL_PRESETS) void ensurePreview(preset)
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const id = (entry.target as HTMLElement).dataset.presetId
        if (!id) continue
        const preset = ALL_PRESETS.find((candidate) => candidate.id === id)
        if (!preset) continue
        // The parsed result is cached for the session and there is nothing to
        // cancel, so a card only ever needs to be seen once.
        observer?.unobserve(entry.target)
        void ensurePreview(preset)
      }
    },
    { root: scrollRef.value, rootMargin: '160px' },
  )

  for (const card of gridRef.value.querySelectorAll('[data-preset-id]')) {
    observer.observe(card)
  }
}

watch([filteredPresets, gridRef], () => {
  if (!props.isVisible) return
  void nextTick(setupObserver)
})

/* -------------------------------------------------------------------------- */
/* Keyboard navigation across the grid                                         */
/* -------------------------------------------------------------------------- */

function gridCards(): HTMLButtonElement[] {
  return Array.from(gridRef.value?.querySelectorAll<HTMLButtonElement>('.preset-card') ?? [])
}

function focusCard(index: number) {
  gridCards()[index]?.focus()
}

function getColumnCount(): number {
  if (!gridRef.value) return 1
  const columns = getComputedStyle(gridRef.value).gridTemplateColumns.split(' ').filter(Boolean)
  return columns.length || 1
}

function handleGridKeydown(event: KeyboardEvent, index: number) {
  const columns = getColumnCount()
  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault()
      focusCard(index + 1)
      break
    case 'ArrowLeft':
      event.preventDefault()
      if (index === 0) {
        searchInputRef.value?.focus()
      } else {
        focusCard(index - 1)
      }
      break
    case 'ArrowDown':
      event.preventDefault()
      focusCard(index + columns)
      break
    case 'ArrowUp':
      event.preventDefault()
      if (index - columns < 0) {
        searchInputRef.value?.focus()
      } else {
        focusCard(index - columns)
      }
      break
  }
}

/* -------------------------------------------------------------------------- */

// Every card loads on a single click, multilingual or not — in whatever language it
// is currently set to. The language control is a deliberate detour, never a toll on
// the common case.
//
// Except while a language menu is open: clicking away is how a menu is dismissed, and
// a stray click on the next card must not replace the layout and wipe undo history.
// Like onBackdropClick, this runs before the document listener that closes the menu.
const choose = (preset: Preset) => {
  if (openLanguagePreset.value) return
  void load(preset, selectedLanguages.value[preset.id])
}

const load = async (preset: Preset, language?: string) => {
  try {
    await applyPreset(preset, keyboardStore, language)
  } catch (error) {
    console.error('Error loading preset:', error)
    toast.showError(`Failed to load ${preset.name}`, 'Error loading preset')
  } finally {
    // Closing regardless matches the other import modals: on success the editor
    // is what the user wants to see, and on failure the toast outlives the modal.
    close()
  }
}

/* -------------------------------------------------------------------------- */
/* The optional language menu                                                  */
/* -------------------------------------------------------------------------- */

const toggleLanguageMenu = (preset: Preset, event: Event) => {
  if (openLanguagePreset.value?.id === preset.id) {
    closeLanguageMenu()
    return
  }
  openLanguageMenu(preset, event)
}

/**
 * Opens (or keeps open) this card's menu. ArrowDown on the toggle never closes it.
 *
 * Focus always moves in, onto the language the card is set to, however the menu was
 * opened. With ~90 languages, type-ahead is the way through the list, and it can only
 * hear keys while focus is inside; `:focus-visible` keeps the ring off for mouse
 * users. Landing on the current choice rather than the first option also scrolls a
 * staged language deep in the list into view when the menu is reopened.
 */
const openLanguageMenu = (preset: Preset, event: Event) => {
  if (openLanguagePreset.value?.id === preset.id) {
    selectedMenuItem()?.focus()
    return
  }
  langTrigger = event.currentTarget as HTMLElement
  openLanguagePreset.value = preset
  void nextTick(() => {
    positionLanguageMenu()
    selectedMenuItem()?.focus()
  })
}

/**
 * The toggle's own keys: ArrowDown opens the menu, and a letter opens it and jumps
 * straight to the first matching language, so "p","o" from the card reaches Polish.
 */
const handleToggleKeydown = (preset: Preset, event: KeyboardEvent) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    openLanguageMenu(preset, event)
    return
  }
  if (!isTypeaheadKey(event, true)) return
  event.preventDefault()
  const key = event.key
  openLanguageMenu(preset, event)
  // Runs after openLanguageMenu's own nextTick has focused the current option.
  void nextTick(() => {
    const items = menuItems()
    typeahead(key, items.indexOf(document.activeElement as HTMLButtonElement))
  })
}

const closeLanguageMenu = ({ refocus = false } = {}) => {
  resetTypeahead()
  if (!openLanguagePreset.value) return
  const trigger = langTrigger
  openLanguagePreset.value = null
  langTrigger = null
  // Escape and a pick both leave focus inside a node that is about to disappear.
  if (refocus) void nextTick(() => trigger?.focus())
}

/** Listener-safe wrapper: a DOM event would otherwise land in the options bag. */
const dismissLanguageMenu = () => closeLanguageMenu()

/**
 * Sets the card's language. Deliberately does NOT import: the menu is a way to adjust
 * a card before committing to it, and collapsing "choose" and "load" into one click
 * would make the choice unrevisable — there would be no way to look at a language,
 * change your mind, and pick another without importing the first one on the way.
 */
const pickLanguage = (code: string) => {
  const preset = openLanguagePreset.value
  if (preset) selectedLanguages.value = { ...selectedLanguages.value, [preset.id]: code }
  closeLanguageMenu({ refocus: true })
}

/**
 * Fixed positioning from the toggle's rect, right-aligned to it, flipping above when
 * the space below runs out. `fixed` rather than `absolute` because every ancestor
 * between the card and the modal clips: the scroll area hides overflow on both axes.
 */
const positionLanguageMenu = () => {
  const menu = langMenuRef.value
  if (!langTrigger || !menu) return

  const trigger = langTrigger.getBoundingClientRect()
  const { width, height } = menu.getBoundingClientRect()
  const gap = 4
  const margin = 8

  const spaceBelow = window.innerHeight - trigger.bottom
  const flipUp = spaceBelow < height + gap + margin && trigger.top > spaceBelow

  langMenuStyle.value = {
    top: `${flipUp ? Math.max(margin, trigger.top - height - gap) : trigger.bottom + gap}px`,
    left: `${Math.max(margin, Math.min(trigger.right - width, window.innerWidth - width - margin))}px`,
  }
}

const menuItems = () =>
  Array.from(langMenuRef.value?.querySelectorAll<HTMLButtonElement>('.preset-lang-option') ?? [])

/** The option for the language the open card is set to; the first one as a fallback. */
const selectedMenuItem = () => {
  const preset = openLanguagePreset.value
  const items = menuItems()
  if (!preset) return items[0] ?? null
  const code = selectedLanguageCodeRaw(preset)
  return items.find((item) => item.dataset.languageCode === code) ?? items[0] ?? null
}

const resetTypeahead = () => {
  typeaheadBuffer = ''
  clearTimeout(typeaheadTimer)
  typeaheadTimer = undefined
}

/**
 * Adds one typed character and moves focus to the option it now points at. Names are
 * matched first, then codes, so "pl" and "Polish" both work but a code never beats a
 * name. A key that matches nothing leaves focus where it is.
 */
const typeahead = (key: string, current: number) => {
  const preset = openLanguagePreset.value
  if (!preset) return
  typeaheadBuffer += key
  clearTimeout(typeaheadTimer)
  typeaheadTimer = setTimeout(resetTypeahead, TYPEAHEAD_RESET_MS)

  const languages = presetLanguages(preset).map((language) => ({
    label: language.name,
    alias: language.code,
  }))
  const index = typeaheadIndex(languages, typeaheadBuffer, current)
  if (index !== -1) menuItems()[index]?.focus()
}

const handleMenuKeydown = (event: KeyboardEvent, index: number) => {
  if (isTypeaheadKey(event, typeaheadBuffer === '')) {
    event.preventDefault()
    typeahead(event.key, index)
    return
  }
  const items = menuItems()
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      items[(index + 1) % items.length]?.focus()
      break
    case 'ArrowUp':
      event.preventDefault()
      items[(index - 1 + items.length) % items.length]?.focus()
      break
    case 'Home':
      event.preventDefault()
      items[0]?.focus()
      break
    case 'End':
      event.preventDefault()
      items[items.length - 1]?.focus()
      break
    case 'Tab':
      // A menu is a single stop; tabbing out of it closes it rather than walking
      // through options that are meant to be reached with the arrow keys. The menu is
      // gone before the browser would move focus, so letting Tab through would drop
      // focus onto the page behind the modal — return it to the toggle instead.
      event.preventDefault()
      closeLanguageMenu({ refocus: true })
      break
  }
}

// A click on the toggle stops propagating, so this only ever sees clicks elsewhere.
const handleDocumentClick = (event: MouseEvent) => {
  if (langMenuRef.value?.contains(event.target as Node)) return
  closeLanguageMenu()
}

// The menu is positioned from a rect taken once, so anything that moves the toggle
// has to dismiss it rather than leave it floating somewhere wrong.
watch(openLanguagePreset, (open) => {
  if (open) {
    document.addEventListener('click', handleDocumentClick)
    window.addEventListener('resize', dismissLanguageMenu)
  } else {
    document.removeEventListener('click', handleDocumentClick)
    window.removeEventListener('resize', dismissLanguageMenu)
  }
})

// Filtering re-renders the grid underneath an open menu, and its toggle may not even
// survive the change.
watch(filteredPresets, () => closeLanguageMenu())

// A click that dismisses the menu should stop there, not also close the modal behind
// it. This runs before the document listener (the backdrop is on the way up to the
// document), so the menu is still open here; the document listener closes it next.
const onBackdropClick = () => {
  if (openLanguagePreset.value) return
  close()
}

const close = () => {
  searchQuery.value = ''
  closeLanguageMenu()
  teardownObserver()
  emit('close')
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  // One Escape peels off one layer: the menu first, the modal only once it is gone.
  if (openLanguagePreset.value) {
    closeLanguageMenu({ refocus: true })
    return
  }
  close()
}

watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      // Cleared on open rather than on close: a staged language belongs to one visit,
      // and the parent can hide this modal without close() ever running.
      selectedLanguages.value = {}
      document.addEventListener('keydown', handleKeyDown)
      document.body.classList.add('modal-open')
      nextTick(() => {
        searchInputRef.value?.focus()
        setupObserver()
      })
    } else {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
      teardownObserver()
    }
  },
)

onMounted(() => {
  if (props.isVisible) {
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
    void nextTick(setupObserver)
  }
})

onUnmounted(() => {
  resetTypeahead()
  document.removeEventListener('keydown', handleKeyDown)
  document.body.classList.remove('modal-open')
  document.removeEventListener('click', handleDocumentClick)
  window.removeEventListener('resize', dismissLanguageMenu)
  teardownObserver()
})
</script>

<style scoped>
/* No .modal-backdrop element is rendered, so the scrim lives here. */
.modal {
  background: rgba(0, 0, 0, 0.5);
}

/* Fixed, not max-height: filtering changes how many cards there are, and the modal
   has to stay exactly as tall while the user types. */
.preset-scroll-area {
  height: min(60vh, 520px);
  overflow-y: auto;
  overflow-x: hidden;
}

/* Fills the reserved area rather than sitting in the top of it. */
.preset-empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.75rem;
}

/* On a phone 190px leaves room for a single column, and one card per screenful
   turns browsing fifteen presets into a long scroll. Two smaller cards read
   better than one big one here. */
@media (max-width: 575.98px) {
  .preset-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }

  .preset-card-thumb {
    height: 64px;
  }

  .preset-lang-toggle {
    right: 0.375rem;
    bottom: 0.375rem;
  }

  /* A 140px card cannot fit "104 keys" beside a full "🌐 EN-GB ▾". The caret goes
     rather than the globe: the globe is what says "language", and the chip still
     reads as a control by its pill and border. */
  .preset-lang-caret {
    display: none;
  }

  .preset-card-meta-inset {
    padding-right: calc(2.3125rem + var(--lang-code-chars, 2) * 0.46rem);
  }
}

/* The grid item, so the language toggle can be positioned against the card without
   living inside it — a <button> may not contain another one. */
.preset-card-slot {
  position: relative;
  display: flex;
}

/* Styled from scratch rather than with Bootstrap's .card, which fights the
   button reset when the card itself is the control. */
.preset-card {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem;
  text-align: left;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  color: var(--bs-body-color);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.preset-card:hover,
.preset-card:focus-visible {
  background: var(--bs-primary-bg-subtle);
  border-color: var(--bs-primary);
}

/* Fixed box so the grid is already rectangular before any preview lands, and so
   the light-backed preview reads as an intentional swatch in dark mode. */
.preset-card-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 84px;
  overflow: hidden;
  background: var(--bs-tertiary-bg);
  border-radius: var(--bs-border-radius-sm);
}

.preset-thumb-canvas {
  width: 100%;
  height: 100%;
}

/* Bootstrap's spinners partial is not compiled into this app, so the waiting
   state is a plain keyframe rather than .spinner-border. */
.preset-card-skeleton {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--bs-secondary-bg);
  animation: preset-pulse 1.4s ease-in-out infinite;
}

@keyframes preset-pulse {
  50% {
    opacity: 0.4;
  }
}

@media (prefers-reduced-motion: reduce) {
  .preset-card-skeleton {
    animation: none;
  }
}

.preset-card-empty {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  border: 1px dashed var(--bs-border-color);
  border-radius: var(--bs-border-radius-sm);
  padding: 0.5rem 0.75rem;
}

/* Bottom-right of the card, on the same line as the key count: it belongs with the
   card's metadata, not on top of the artwork, and sitting beside "104 keys" reads as
   another fact about what you are about to load. */
.preset-lang-toggle {
  position: absolute;
  right: 0.5rem;
  bottom: 0.5rem;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  /* 24px tall: the WCAG 2.5.8 minimum target, reached by the chip itself rather than
     an invisible hit area, so what you see is what you can press. */
  min-height: 1.5rem;
  padding: 0 0.375rem 0 0.4375rem;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1;
  color: var(--bs-secondary-color);
  /* Opaque, not the translucent --bs-secondary-bg: it overlaps the preview, and a
     see-through chip over key legends is unreadable. */
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
}

.preset-lang-toggle:hover,
.preset-lang-toggle:focus-visible,
.preset-lang-toggle[aria-expanded='true'] {
  color: var(--bs-primary);
  border-color: var(--bs-primary);
}

.preset-lang-globe,
.preset-lang-caret {
  fill: currentColor;
  /* Whole pixels, never shrunk, never cropped. The globe's outline touches its 16x16
     viewBox edge, so at a fractional size (0.8em of 11px was 8.8px) pixel snapping
     shaved the circle flat on one side, worst at 1x DPR. */
  flex-shrink: 0;
  overflow: visible;
}

.preset-lang-globe {
  width: 12px;
  height: 12px;
}

.preset-lang-caret {
  width: 8px;
  height: 8px;
  opacity: 0.7;
}

.preset-lang-code {
  letter-spacing: 0.02em;
}

/* Fixed, so the scroll area's overflow cannot clip it; see positionLanguageMenu(). */
.preset-lang-menu {
  position: fixed;
  z-index: 1070;
  min-width: 11rem;
  max-height: 15rem;
  overflow-y: auto;
  padding: 0.25rem;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);
}

.preset-lang-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.3125rem 0.5rem;
  font-size: 0.8125rem;
  text-align: left;
  color: var(--bs-body-color);
  background: none;
  border: 0;
  border-radius: var(--bs-border-radius-sm);
  cursor: pointer;
}

.preset-lang-option:hover,
.preset-lang-option:focus-visible {
  background: var(--bs-primary-bg-subtle);
}

.preset-lang-option-name {
  flex: 1;
  min-width: 0;
}

.preset-lang-option-code {
  font-size: 0.6875rem;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
}

.preset-lang-option-mark {
  display: inline-flex;
  flex-shrink: 0;
  width: 0.875em;
}

.preset-lang-option-check {
  width: 0.875em;
  height: 0.875em;
  fill: var(--bs-primary);
}

.preset-lang-separator {
  height: 1px;
  margin: 0.25rem 0.5rem;
  background: var(--bs-border-color);
}

/* Reserves the corner so the key count cannot run under the language chip. The chip
   is as wide as its code ("EN" is 60px, "EN-GB" 82px, a staged "MS-ARAB" wider still),
   so the reservation follows the code's length: a fixed part for the padding, globe
   and caret, plus about 7.4px per character (measured: 22px across the 3 extra characters of "EN-GB"). The ellipsis is the backstop that
   keeps a card from ever wrapping onto a second line and changing height. */
.preset-card-meta-inset {
  padding-right: calc(3.0625rem + var(--lang-code-chars, 2) * 0.46rem);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-card-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.preset-card-name :deep(mark) {
  background-color: #ffe066;
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
}
</style>
