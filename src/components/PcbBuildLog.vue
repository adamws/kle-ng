<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'

// `fill` makes the terminal grow to fill its container (used when embedded in a
// tab); by default it uses a fixed height and a top margin (used inline under
// the progress bar / failure alert).
const props = withDefaults(defineProps<{ fill?: boolean }>(), { fill: false })

const pcbStore = usePcbGeneratorStore()
const { buildLogs, isLogStreamActive } = storeToRefs(pcbStore)

const scrollContainer = ref<HTMLElement | null>(null)

// Auto-scroll ("follow") is active until the user scrolls up; scrolling back to
// the bottom (or clicking "Jump to bottom") re-enables it.
const autoScroll = ref(true)

// Number of lines that have arrived while the user is scrolled up, surfaced on
// the jump-to-bottom button so they know how much they're missing.
const newLineCount = ref(0)

// Set while we programmatically scroll to the bottom, so the resulting scroll
// event isn't mistaken for the user moving the viewport. Cleared on the next
// animation frame (setting scrollTop may not emit a scroll event at all).
let isProgrammaticScroll = false

function isAtBottom(el: HTMLElement): boolean {
  // Small threshold so near-bottom still counts as "at bottom".
  return el.scrollHeight - el.scrollTop - el.clientHeight < 24
}

function onScroll() {
  const el = scrollContainer.value
  if (!el) return
  // Ignore the echo of our own auto-scroll; only react to real user movement.
  if (isProgrammaticScroll) return
  autoScroll.value = isAtBottom(el)
  if (autoScroll.value) newLineCount.value = 0
}

function onWheel(event: WheelEvent) {
  // Scrolling up is an explicit intent to read back, so pause immediately —
  // this wins the race against a burst of incoming lines trying to follow.
  if (event.deltaY < 0) autoScroll.value = false
}

function scrollToBottom() {
  const el = scrollContainer.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  autoScroll.value = true
  newLineCount.value = 0
}

// React to new lines: follow the tail while `autoScroll` is on, otherwise just
// count what the user is missing. A shrinking length means the stream was
// cleared and replayed (reconnect) — resume following from the fresh backfill.
watch(
  () => buildLogs.value.length,
  async (newLen, oldLen) => {
    if (newLen < oldLen) {
      autoScroll.value = true
      newLineCount.value = 0
    } else if (!autoScroll.value) {
      newLineCount.value += newLen - oldLen
    }

    if (!autoScroll.value) return
    await nextTick()
    const el = scrollContainer.value
    if (!el) return
    isProgrammaticScroll = true
    el.scrollTop = el.scrollHeight
    requestAnimationFrame(() => {
      isProgrammaticScroll = false
    })
  },
)

const copied = ref(false)
async function copyToClipboard() {
  const text = buildLogs.value.map((l) => l.line).join('\n')
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch (error) {
    console.error('Failed to copy build log:', error)
  }
}

const showJumpToBottom = computed(() => !autoScroll.value && buildLogs.value.length > 0)

const jumpLabel = computed(() =>
  newLineCount.value > 0
    ? `↓ ${newLineCount.value} new line${newLineCount.value === 1 ? '' : 's'}`
    : '↓ Jump to bottom',
)
</script>

<template>
  <div class="pcb-build-log" :class="{ fill: props.fill }">
    <div class="build-log-header">
      <span class="build-log-title">
        Build log
        <span v-if="isLogStreamActive" class="build-log-status">
          <span class="build-log-status-dot" aria-hidden="true"></span>
          live
        </span>
      </span>
      <button type="button" class="btn btn-sm btn-secondary" @click="copyToClipboard">
        {{ copied ? 'Copied' : 'Copy' }}
      </button>
    </div>

    <div class="build-log-body-wrapper">
      <div
        ref="scrollContainer"
        class="build-log-body"
        role="log"
        aria-label="Build log output"
        aria-live="polite"
        aria-relevant="additions"
        @scroll="onScroll"
        @wheel="onWheel"
      >
        <div v-for="(log, index) in buildLogs" :key="index" class="build-log-line">
          <span v-if="log.source" class="build-log-source">[{{ log.source }}]</span>
          <span class="build-log-text">{{ log.line }}</span>
        </div>
        <div v-if="buildLogs.length === 0" class="build-log-empty">Waiting for output…</div>
      </div>

      <button
        v-if="showJumpToBottom"
        type="button"
        class="btn btn-sm btn-primary jump-to-bottom"
        @click="scrollToBottom"
      >
        {{ jumpLabel }}
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Site-matched soft panel: uses Bootstrap theme variables so the terminal is
   light in light mode and dark in dark mode, blending with the surrounding
   panels (no hardcoded colors, mirrors the PcbRenderViewer tab-bar). */
.pcb-build-log {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-top: 1rem;
  border: 1px solid var(--bs-border-color);
  border-radius: 4px;
  overflow: hidden;
  background-color: var(--bs-tertiary-bg);
}

/* Embedded in a tab: fill the available height instead of a fixed-size box. */
.pcb-build-log.fill {
  margin-top: 0;
  flex: 1;
  min-height: 0;
}

.build-log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.25rem 0.5rem;
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
  border-bottom: 1px solid var(--bs-border-color);
  font-size: 0.8rem;
}

.build-log-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
}

.build-log-status {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--bs-success);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.build-log-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--bs-success);
  animation: build-log-pulse 1.5s ease-in-out infinite;
}

@keyframes build-log-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

.build-log-body-wrapper {
  position: relative;
}

/* When filling a tab, let the scroll body grow with the wrapper. */
.pcb-build-log.fill .build-log-body-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.pcb-build-log.fill .build-log-body {
  flex: 1;
  height: auto;
}

.build-log-body {
  height: 220px;
  overflow-y: auto;
  padding: 0.5rem;
  font-family: var(--bs-font-monospace);
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--bs-body-color);
  white-space: pre-wrap;
  word-break: break-word;
  /* Themed thin scrollbar (Firefox) */
  scrollbar-width: thin;
  scrollbar-color: var(--bs-secondary-color) transparent;
}

/* Themed scrollbar (WebKit/Blink) */
.build-log-body::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.build-log-body::-webkit-scrollbar-track {
  background: transparent;
}

.build-log-body::-webkit-scrollbar-thumb {
  background-color: var(--bs-secondary-color);
  border-radius: 5px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.build-log-source {
  color: var(--bs-primary);
  margin-right: 0.4rem;
}

.build-log-empty {
  color: var(--bs-secondary-color);
  font-style: italic;
}

.jump-to-bottom {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

@media (prefers-reduced-motion: reduce) {
  .build-log-status-dot {
    animation: none;
  }
}
</style>
