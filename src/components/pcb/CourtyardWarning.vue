<!--
  CourtyardWarning: names the parts whose courtyards overlap (see
  courtyard-collisions.ts), over the bottom of the preview. A warning only:
  Generate still works, and KiCad's DRC reports the same overlap.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { KEY_PITCH, type CourtyardCollision } from '@/utils/pcb/courtyard-collisions'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'

const props = defineProps<{ collisions: readonly CourtyardCollision[] }>()

const NAMES: Record<string, string> = { SW: 'switch', D: 'diode', LED: 'LED', C: 'capacitor' }
const name = (owner: string) => NAMES[owner] ?? owner
const capitalize = (s: string) => `${s[0]!.toUpperCase()}${s.slice(1)}`

const lines = computed(() =>
  props.collisions.map((c) =>
    c.neighbour
      ? `${capitalize(name(c.a))} courtyard overlaps the next key's ${name(c.b)} (${c.side})`
      : `${capitalize(name(c.a))} and ${name(c.b)} courtyards overlap (${c.side})`,
  ),
)
const hasNeighbour = computed(() => props.collisions.some((c) => c.neighbour))
</script>

<template>
  <div
    v-if="collisions.length"
    class="alert alert-danger courtyard-warning"
    role="alert"
    data-testid="pcb-courtyard-warning"
  >
    <BiExclamationTriangle class="courtyard-icon" />
    <div>
      <div v-for="(line, i) in lines" :key="i">{{ line }}</div>
      <div class="courtyard-hint">
        Parts would collide on the board: move them apart, or put one on the other side.
        <template v-if="hasNeighbour">Next keys are {{ KEY_PITCH }} mm apart.</template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.courtyard-warning {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  align-self: stretch;
  padding: 0.25rem 0.5rem;
  margin: 0;
  font-size: 0.8125rem;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.15);
  pointer-events: auto;
}

.courtyard-icon {
  flex: none;
  margin-top: 0.1875rem;
}

.courtyard-hint {
  opacity: 0.85;
}
</style>
