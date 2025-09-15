import { ref, onMounted, onUnmounted, readonly } from 'vue'

export type Theme = 'light' | 'dark' | 'auto'

const theme = ref<Theme>('auto')
let mediaQueryList: MediaQueryList | null = null

export function useTheme() {
  const getSystemTheme = (): 'light' | 'dark' => {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const applyTheme = (selectedTheme: Theme) => {
    if (selectedTheme === 'auto') {
      document.documentElement.setAttribute('data-bs-theme', getSystemTheme())
    } else {
      document.documentElement.setAttribute('data-bs-theme', selectedTheme)
    }
  }

  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme

    // Apply theme to document
    applyTheme(newTheme)

    // Persist to localStorage
    localStorage.setItem('kle-theme', newTheme)

    // Setup or remove system theme listener
    if (mediaQueryList) {
      mediaQueryList.removeEventListener('change', handleSystemThemeChange)
      mediaQueryList = null
    }

    if (newTheme === 'auto') {
      mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQueryList.addEventListener('change', handleSystemThemeChange)
    }
  }

  const handleSystemThemeChange = () => {
    if (theme.value === 'auto') {
      applyTheme('auto')
    }
  }

  const getPreferredTheme = (): Theme => {
    const storedTheme = localStorage.getItem('kle-theme') as Theme
    if (storedTheme && ['light', 'dark', 'auto'].includes(storedTheme)) {
      return storedTheme
    }
    return 'auto'
  }

  const initializeTheme = () => {
    const preferredTheme = getPreferredTheme()
    setTheme(preferredTheme)
  }

  onMounted(() => {
    initializeTheme()
  })

  onUnmounted(() => {
    if (mediaQueryList) {
      mediaQueryList.removeEventListener('change', handleSystemThemeChange)
    }
  })

  return {
    theme: readonly(theme),
    setTheme,
    initializeTheme,
  }
}
