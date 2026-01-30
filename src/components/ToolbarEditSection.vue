<template>
  <div class="toolbar-section">
    <label class="section-label">Edit</label>
    <div class="tool-buttons">
      <!-- Add Key Button Group -->
      <div class="btn-group-vertical add-key-group">
        <button
          class="tool-button primary-add-btn"
          data-testid="toolbar-add-key"
          @click="$emit('add-key')"
          title="Add Standard Key"
        >
          <BiPlusCircle />
        </button>
        <button
          ref="dropdownBtnRef"
          class="tool-button dropdown-btn"
          @click="$emit('toggle-special-keys')"
          title="Add Special Key"
        >
          <BiChevronDown />
        </button>
      </div>

      <!-- Special Keys Dropdown -->
      <div
        v-if="showSpecialKeysDropdown"
        ref="dropdownRef"
        class="special-keys-dropdown"
        style="opacity: 0"
      >
        <div class="dropdown-header">Special Keys</div>
        <button
          v-for="specialKey in specialKeys"
          :key="specialKey.name"
          @click="$emit('add-special-key', specialKey)"
          class="dropdown-item"
          :title="specialKey.description"
        >
          {{ specialKey.name }}
        </button>
      </div>

      <button
        class="tool-button"
        data-testid="toolbar-delete-keys"
        @click="$emit('delete-keys')"
        :disabled="!canDelete"
        title="Delete Keys"
      >
        <BiTrash />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { type SpecialKeyTemplate } from '@/data/specialKeys'
import BiPlusCircle from 'bootstrap-icons/icons/plus-circle.svg'
import BiChevronDown from 'bootstrap-icons/icons/chevron-down.svg'
import BiTrash from 'bootstrap-icons/icons/trash.svg'

defineProps<{
  showSpecialKeysDropdown: boolean
  specialKeys: SpecialKeyTemplate[]
  canDelete: boolean
}>()

defineEmits<{
  'add-key': []
  'toggle-special-keys': []
  'add-special-key': [specialKey: SpecialKeyTemplate]
  'delete-keys': []
}>()

const dropdownBtnRef = ref<HTMLElement>()
const dropdownRef = ref<HTMLElement>()

defineExpose({
  dropdownBtnRef,
  dropdownRef,
})
</script>
