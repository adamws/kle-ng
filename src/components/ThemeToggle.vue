<template>
  <div class="dropdown">
    <button
      class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center"
      data-testid="theme-toggle-button"
      type="button"
      data-bs-toggle="dropdown"
      aria-expanded="false"
      :title="`Current theme: ${theme}`"
    >
      <BiSunFill v-if="theme === 'light'" />
      <BiMoonStarsFill v-else-if="theme === 'dark'" />
      <BiCircleHalf v-else />
    </button>
    <ul class="dropdown-menu dropdown-menu-end" data-testid="theme-dropdown-menu">
      <li>
        <button
          class="dropdown-item d-flex align-items-center gap-2"
          :class="{ active: theme === 'light' }"
          @click="setTheme('light')"
        >
          <BiSunFill />
          Light
        </button>
      </li>
      <li>
        <button
          class="dropdown-item d-flex align-items-center gap-2"
          :class="{ active: theme === 'dark' }"
          @click="setTheme('dark')"
        >
          <BiMoonStarsFill />
          Dark
        </button>
      </li>
      <li>
        <button
          class="dropdown-item d-flex align-items-center gap-2"
          :class="{ active: theme === 'auto' }"
          @click="setTheme('auto')"
        >
          <BiCircleHalf />
          Auto
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useTheme } from '@/composables/useTheme'
import BiSunFill from 'bootstrap-icons/icons/sun-fill.svg'
import BiMoonStarsFill from 'bootstrap-icons/icons/moon-stars-fill.svg'
import BiCircleHalf from 'bootstrap-icons/icons/circle-half.svg'

const { theme, setTheme } = useTheme()
</script>

<style scoped>
.btn-outline-secondary {
  border-width: 2px;
}

.dropdown-item.active:hover {
  background-color: var(--bs-dropdown-link-active-bg) !important;
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
