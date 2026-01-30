<template>
  <div v-if="isVisible" class="github-star-popup">
    <button
      @click="close"
      class="btn btn-sm btn-outline-secondary close-btn"
      type="button"
      aria-label="Close"
    >
      <BiX />
    </button>
    <div class="popup-content">
      <div class="popup-message">
        <h6 class="popup-title">Enjoying KLE-NG?</h6>
        <p class="popup-text">
          If you find this tool useful, please consider starring it on GitHub to support the
          project!
        </p>
      </div>
      <a
        href="https://github.com/adamws/kle-ng"
        target="_blank"
        rel="noopener noreferrer"
        class="star-button"
        @click="handleStarClick"
      >
        <BiGithub />
        Star on GitHub
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import BiX from 'bootstrap-icons/icons/x.svg'
import BiGithub from 'bootstrap-icons/icons/github.svg'

const STORAGE_KEY = 'kle-ng-github-star-popup-dismissed'
const VISIT_TIME_KEY = 'kle-ng-first-visit-time'
const DISPLAY_DELAY = 60000 // 1 minute in milliseconds

const isVisible = ref(false)
let timeoutId: number | null = null

const close = () => {
  isVisible.value = false
  // Store in local storage that popup was dismissed
  localStorage.setItem(STORAGE_KEY, 'true')
}

const handleStarClick = () => {
  // Close popup when user clicks the star button
  close()
}

const checkAndShowPopup = () => {
  // Skip popup in unit test environments only
  // Allow E2E tests (which set window.__ALLOW_POPUP_IN_E2E__)
  const isUnitTest =
    import.meta.env.MODE === 'test' ||
    typeof (globalThis as Record<string, unknown>).describe !== 'undefined'
  const isE2ETest =
    typeof navigator !== 'undefined' &&
    navigator.webdriver &&
    (window as typeof window & { __ALLOW_POPUP_IN_E2E__?: boolean }).__ALLOW_POPUP_IN_E2E__

  if (isUnitTest && !isE2ETest) {
    return
  }

  // Check if popup was already dismissed
  const wasDismissed = localStorage.getItem(STORAGE_KEY) === 'true'
  if (wasDismissed) {
    return
  }

  // Get or set first visit time
  const firstVisitTime = localStorage.getItem(VISIT_TIME_KEY)
  const now = Date.now()

  if (!firstVisitTime) {
    // First visit - store the current time
    localStorage.setItem(VISIT_TIME_KEY, now.toString())

    // Set timeout to show popup after 1 minute
    timeoutId = window.setTimeout(() => {
      // Check again if popup wasn't dismissed in the meantime
      if (localStorage.getItem(STORAGE_KEY) !== 'true') {
        isVisible.value = true
      }
    }, DISPLAY_DELAY)
  } else {
    // Check if this is still a new user (within first session)
    const timeSinceFirstVisit = now - parseInt(firstVisitTime, 10)

    if (timeSinceFirstVisit < DISPLAY_DELAY) {
      // User hasn't been here for 1 minute yet, show popup after remaining time
      const remainingTime = DISPLAY_DELAY - timeSinceFirstVisit
      timeoutId = window.setTimeout(() => {
        if (localStorage.getItem(STORAGE_KEY) !== 'true') {
          isVisible.value = true
        }
      }, remainingTime)
    } else {
      // User has been here for more than 1 minute, show popup immediately
      isVisible.value = true
    }
  }
}

onMounted(() => {
  checkAndShowPopup()
})

onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }
})
</script>

<style scoped>
.github-star-popup {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  border: 2px solid var(--bs-warning);
  border-radius: 12px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(0, 0, 0, 0.05);
  max-width: 360px;
  z-index: 1050;
  animation: slideIn 0.4s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 20px;
  height: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-content {
  padding: 20px;
}

.popup-message {
  margin-bottom: 16px;
}

.popup-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--bs-body-color);
}

.popup-text {
  font-size: 14px;
  color: var(--bs-secondary-color);
  margin: 0;
  line-height: 1.5;
}

.star-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
  text-decoration: none;
}

.star-button:hover {
  box-shadow: 0 4px 12px rgba(255, 193, 7, 0.4);
}

.star-button:active {
  transform: translateY(0);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .github-star-popup {
    bottom: 16px;
    right: 16px;
    left: 16px;
    max-width: none;
  }
}
</style>
