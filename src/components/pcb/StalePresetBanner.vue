<!--
  StalePresetBanner (an overlay on the preview canvas): the track preset was drawn for other footprints or
  another diode placement. Keep marks it as drawn for the current settings,
  Clear removes it.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { usePcbTracksStore } from '@/stores/pcbTracks'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'

const tracks = usePcbTracksStore()

// one line, so the overlay hides little of the canvas; details in the tooltip
const message = computed(() => {
  const changes = tracks.staleChanges
  const what = changes.map((c) => c.label).join(', ')
  const text = `${what[0]?.toUpperCase()}${what.slice(1)} changed since the tracks were drawn`
  return changes.length === 1 ? `${text} (${changes[0]!.was} → ${changes[0]!.now})` : text
})
const details = computed(() =>
  tracks.staleChanges.map((c) => `${c.label}: ${c.was} → ${c.now}`).join('\n'),
)
</script>

<template>
  <div
    v-if="tracks.staleChanges.length"
    class="alert alert-warning stale-preset"
    role="alert"
    data-testid="pcb-stale-preset"
  >
    <BiExclamationTriangle class="stale-icon" />
    <div class="stale-text" :title="details">
      {{ message }}
    </div>
    <div class="stale-actions">
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        title="The tracks still connect: keep them and hide this message"
        data-testid="pcb-stale-keep"
        @click="tracks.keepPreset()"
      >
        Keep
      </button>
      <button
        type="button"
        class="btn btn-sm btn-outline-danger"
        title="Remove all tracks"
        data-testid="pcb-stale-clear"
        @click="tracks.clearPreset()"
      >
        Clear
      </button>
    </div>
  </div>
</template>

<style scoped>
.stale-preset {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  align-self: stretch;
  padding: 0.25rem 0.375rem 0.25rem 0.5rem;
  margin: 0;
  font-size: 0.8125rem;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
  pointer-events: auto;
}

.stale-icon {
  flex: none;
}

.stale-text {
  flex: 1;
}

.stale-actions {
  display: flex;
  flex: none;
  gap: 0.375rem;
}

.stale-actions .btn {
  padding: 0.0625rem 0.5rem;
  font-size: 0.8125rem;
}
</style>
