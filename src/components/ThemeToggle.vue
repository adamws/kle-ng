<template>
  <div class="dropdown">
    <button
      class="btn btn-outline-secondary dropdown-toggle"
      type="button"
      data-bs-toggle="dropdown"
      aria-expanded="false"
      :title="`Current theme: ${theme}`"
    >
      <i :class="themeIcon"></i>
    </button>
    <ul class="dropdown-menu dropdown-menu-end">
      <li>
        <button
          class="dropdown-item d-flex align-items-center"
          :class="{ active: theme === 'light' }"
          @click="setTheme('light')"
        >
          <i class="bi bi-sun-fill me-2"></i>
          Light
        </button>
      </li>
      <li>
        <button
          class="dropdown-item d-flex align-items-center"
          :class="{ active: theme === 'dark' }"
          @click="setTheme('dark')"
        >
          <i class="bi bi-moon-stars-fill me-2"></i>
          Dark
        </button>
      </li>
      <li>
        <button
          class="dropdown-item d-flex align-items-center"
          :class="{ active: theme === 'auto' }"
          @click="setTheme('auto')"
        >
          <i class="bi bi-circle-half me-2"></i>
          Auto
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

const { theme, setTheme } = useTheme()

const themeIcon = computed(() => {
  switch (theme.value) {
    case 'light':
      return 'bi bi-sun-fill'
    case 'dark':
      return 'bi bi-moon-stars-fill'
    default:
      return 'bi bi-circle-half'
  }
})
</script>

<style scoped>
.btn-outline-secondary {
  border-width: 2px;
}

/* Responsive sizing to match KeyboardToolbar buttons */
@media (max-width: 575.98px) {
  .btn-outline-secondary {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
  }
}

@media (max-width: 320px) {
  .btn-outline-secondary {
    font-size: 0.7rem;
    padding: 0.2rem 0.4rem;
  }
}
</style>
