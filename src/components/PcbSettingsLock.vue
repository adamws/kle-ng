<script setup lang="ts">
withDefaults(
  defineProps<{
    locked: boolean
    /** Off for content that must stay scrollable, e.g. a read-only editor. */
    overlay?: boolean
  }>(),
  { overlay: true },
)

const hint = "Settings of the last run are shown. Click 'New Task' to edit them."
</script>

<template>
  <div class="pcb-settings-lock">
    <fieldset
      :disabled="locked"
      :class="{ 'opacity-50': locked }"
      :title="locked ? hint : undefined"
    >
      <slot />
    </fieldset>
    <!-- Disabled controls don't show tooltips reliably, and some have their
         own title, so the hint also sits on an overlay covering them all. -->
    <div
      v-if="locked && overlay"
      class="lock-overlay"
      :title="hint"
      data-testid="pcb-settings-lock"
    ></div>
  </div>
</template>

<style scoped>
.pcb-settings-lock {
  position: relative;
}

.lock-overlay {
  position: absolute;
  inset: 0;
  cursor: not-allowed;
}
</style>
