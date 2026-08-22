<!--
  A Bootstrap tooltip attached to a wrapper rather than to the control itself.

  The reason for the wrapper: a disabled button suppresses its own pointer events
  (`.btn:disabled { pointer-events: none }`), so neither a native `title` nor a tooltip
  bound to the button ever fires — the one moment a user most needs to be told why the
  button will not work is the one moment the browser stays silent. Hovering the wrapper
  still works, because the events land on it instead.

  `title` is passed as a function so the text stays live without re-creating the
  instance: Bootstrap resolves it at show time, which also means an empty string
  suppresses the tooltip entirely (`_isWithContent`). A visible tooltip is updated in
  place by the watcher.
-->
<template>
  <span
    ref="hostRef"
    class="hint-tooltip"
    :tabindex="focusable ? 0 : undefined"
    @mousedown="keepPointerFocusOff"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import Tooltip from 'bootstrap/js/dist/tooltip'

const props = withDefaults(
  defineProps<{
    /** Tooltip text; empty or undefined shows nothing. */
    text?: string
    placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right'
    /**
     * Makes the wrapper a tab stop so keyboard users reach the tooltip. Bind it to the
     * same condition that disables the control — a disabled button takes no focus of
     * its own, and an enabled one would otherwise gain a second, useless tab stop.
     */
    focusable?: boolean
  }>(),
  { text: '', placement: 'top', focusable: false },
)

const hostRef = ref<HTMLElement>()
let tooltip: Tooltip | null = null

/**
 * A click on a disabled control lands on this wrapper, and a wrapper with `tabindex`
 * takes focus from it — which is one of the tooltip's triggers, so the tooltip would
 * stay open after the pointer left, until something else was clicked. Only tabbing to
 * it should focus it, so pointer focus is refused here.
 *
 * Guarded on the target: an enabled control's own mousedown bubbles through this
 * handler too, and it must keep the focus it is entitled to.
 */
const keepPointerFocusOff = (event: MouseEvent) => {
  if (event.target === hostRef.value) event.preventDefault()
}

onMounted(() => {
  if (!hostRef.value) return
  tooltip = new Tooltip(hostRef.value, {
    title: () => props.text,
    placement: props.placement,
    trigger: 'hover focus',
    // The modal is a stacking context with its own overflow; body-level keeps the
    // tooltip from being clipped by the footer or the scrolling layout list.
    container: 'body',
  })
})

watch(
  () => props.text,
  (text) => tooltip?.setContent({ '.tooltip-inner': text }),
)

onUnmounted(() => {
  tooltip?.dispose()
  tooltip = null
})
</script>

<style scoped>
/*
 * Inline-flex so the wrapper hugs the control and takes part in a flex row the way the
 * control did on its own — a plain inline span would add a text line box under it and
 * break `align-items: stretch` sizing.
 */
.hint-tooltip {
  display: inline-flex;
}

/* The wrapper is only a tooltip host; its focus ring would sit around the control. */
.hint-tooltip:focus {
  outline: none;
}

.hint-tooltip:focus-visible {
  outline: var(--bs-focus-ring-width, 0.25rem) solid var(--bs-focus-ring-color);
  outline-offset: 1px;
  border-radius: var(--bs-border-radius);
}
</style>
