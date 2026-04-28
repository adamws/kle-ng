<script setup lang="ts">
import { computed } from 'vue'
import LZString from 'lz-string'
import { useKeyboardStore } from '@/stores/keyboard'
import { getLayoutOptionGroups, type LayoutOptionGroup } from '@/utils/layout-options'

const keyboardStore = useKeyboardStore()

const viaLabels = computed((): unknown => {
  try {
    const compressed = (keyboardStore.metadata as Record<string, unknown>)._kleng_via_data
    if (typeof compressed !== 'string') return undefined
    const json = LZString.decompressFromBase64(compressed)
    if (!json) return undefined
    const parsed = JSON.parse(json) as Record<string, unknown>
    const layouts = parsed.layouts as Record<string, unknown> | undefined
    return layouts?.labels
  } catch {
    return undefined
  }
})

const groups = computed(() => getLayoutOptionGroups(keyboardStore.keys, viaLabels.value))

function resolveChoiceTitle(group: LayoutOptionGroup, choice: number): string {
  if (group.choiceLabels?.[choice]) return group.choiceLabels[choice]!
  const groupName = group.groupLabel ?? `Option ${group.option}`
  return `${groupName} · Choice ${choice}`
}

function isChoiceActive(option: number, choice: number): boolean {
  const choices = keyboardStore.displayLayoutChoices
  return choices !== null && choices.get(option) === choice
}

function handleChoiceClick(option: number, choice: number) {
  const current = keyboardStore.displayLayoutChoices
  if (!current) {
    // Enter preview: init all groups to choice 0, then apply the clicked one
    const map = new Map<number, number>()
    for (const group of groups.value) map.set(group.option, 0)
    map.set(option, choice)
    keyboardStore.setDisplayLayoutChoices(map)
  } else {
    const map = new Map(current)
    map.set(option, choice)
    keyboardStore.setDisplayLayoutChoices(map)
  }
}
</script>

<template>
  <div v-if="groups.length > 0" class="layout-option-toolbar" data-testid="layout-option-toolbar">
    <button
      class="bubble-btn"
      :class="{ active: !keyboardStore.isLayoutPreviewMode }"
      title="Show all layout options"
      data-testid="layout-option-all"
      @click="keyboardStore.setDisplayLayoutChoices(null)"
    >
      <span class="bubble-label all-label">all</span>
    </button>

    <div
      v-for="group in groups"
      :key="group.option"
      class="option-group"
      data-testid="layout-option-group"
      :data-option="group.option"
    >
      <button
        v-for="choice in group.choices"
        :key="choice"
        class="bubble-btn"
        :class="{ active: isChoiceActive(group.option, choice) }"
        :title="resolveChoiceTitle(group, choice)"
        data-testid="layout-option-choice"
        :data-option="group.option"
        :data-choice="choice"
        @click="handleChoiceClick(group.option, choice)"
      >
        <span class="bubble-label diag-fraction">
          <span class="frac-top">{{ choice }}</span>
          <span class="frac-slash">⁄</span>
          <span class="frac-bot">{{ group.option }}</span>
        </span>
      </button>
    </div>

    <span
      v-if="keyboardStore.isLayoutPreviewMode"
      class="preview-hint"
      data-testid="layout-option-preview-hint"
    >
      Layout preview mode (<em class="text-warning">readonly</em>) — switch to
      <strong>all</strong> to edit
    </span>
  </div>
</template>

<style scoped>
.layout-option-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
}

.option-group {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  padding-left: 6px;
  border-left: 1px solid var(--bs-border-color, #dee2e6);
}

.bubble-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid var(--bs-secondary-color, #6c757d);
  background: transparent;
  color: var(--bs-secondary-color, #6c757d);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
  flex-shrink: 0;
}

.bubble-btn:hover {
  border-color: var(--bs-primary, #0d6efd);
  color: var(--bs-primary, #0d6efd);
  background: rgba(var(--bs-primary-rgb, 13 110 253), 0.08);
}

.bubble-btn.active {
  border-color: var(--bs-secondary-color);
  background: var(--bs-secondary-color);
  color: var(--bs-body-bg);
}

.bubble-label {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  user-select: none;
}

.all-label {
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.diag-fraction {
  gap: 0;
}

.frac-top {
  font-size: 0.55rem;
  font-weight: 700;
  align-self: flex-start;
  line-height: 1.4;
}

.frac-slash {
  font-size: 0.85rem;
  font-weight: 300;
  line-height: 1;
}

.frac-bot {
  font-size: 0.55rem;
  font-weight: 700;
  align-self: flex-end;
  line-height: 1.4;
}

.preview-hint {
  margin-left: 8px;
  font-size: 0.75rem;
  color: var(--bs-secondary-color, #6c757d);
  white-space: nowrap;
}
</style>
