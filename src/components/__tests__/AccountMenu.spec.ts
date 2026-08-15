import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  getTestUser: vi.fn<() => { email: string; password: string; label: string } | null>(() => null),
  isLocalSupabase: vi.fn(() => true),
  getSupabaseClient: vi.fn(),
  setTheme: vi.fn(),
}))

vi.mock('@/config/supabase', () => ({
  AUTH_STORAGE_KEY: 'kle-ng-auth',
  isAuthConfigured: mocks.isAuthConfigured,
  getTestUser: mocks.getTestUser,
  isLocalSupabase: mocks.isLocalSupabase,
}))

vi.mock('@/utils/supabase-loader', () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}))

import AccountMenu from '../AccountMenu.vue'
import { useAuthStore } from '@/stores/auth'

const SIGNED_IN_USER = {
  id: 'user-1',
  email: 'dev@example.com',
  name: 'adamws',
  avatarUrl: 'https://example.com/a.png',
}

describe('AccountMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isAuthConfigured.mockReturnValue(true)
    mocks.getTestUser.mockReturnValue(null)
    setActivePinia(createPinia())
  })

  const mountMenu = () => mount(AccountMenu, { global: { plugins: [createPinia()] } })

  describe('theme section', () => {
    it('offers all three theme options', () => {
      const wrapper = mountMenu()
      const labels = wrapper.findAll('.dropdown-item').map((i) => i.text())
      expect(labels).toEqual(expect.arrayContaining(['Light', 'Dark', 'Auto']))
    })

    // The theme picker used to be its own component that rendered unconditionally.
    // Folding it in here must not make it depend on accounts being set up.
    it('stays available when accounts are not configured', () => {
      mocks.isAuthConfigured.mockReturnValue(false)
      const wrapper = mountMenu()

      expect(wrapper.find('[data-testid="user-menu-button"]').exists()).toBe(true)
      const labels = wrapper.findAll('.dropdown-item').map((i) => i.text())
      expect(labels).toEqual(['Light', 'Dark', 'Auto'])
      expect(wrapper.find('[data-testid="sign-in-github"]').exists()).toBe(false)
    })

    it('marks the current theme as active', () => {
      const wrapper = mountMenu()
      const active = wrapper.findAll('.dropdown-item.active')
      expect(active).toHaveLength(1)
      // 'auto' is the default in useTheme
      expect(active[0]!.text()).toBe('Auto')
    })
  })

  describe('signed out', () => {
    it('offers GitHub sign-in and shows the generic person icon', () => {
      const wrapper = mountMenu()
      expect(wrapper.find('[data-testid="sign-in-github"]').exists()).toBe(true)
      expect(wrapper.find('img.user-avatar').exists()).toBe(false)
      expect(wrapper.find('[data-testid="sign-out"]').exists()).toBe(false)
    })

    it('hides the test user entry unless one is available', () => {
      expect(mountMenu().find('[data-testid="sign-in-test-user"]').exists()).toBe(false)

      mocks.getTestUser.mockReturnValue({
        email: 'dev@test.local',
        password: 'password123',
        label: 'local development',
      })
      expect(mountMenu().find('[data-testid="sign-in-test-user"]').exists()).toBe(true)
    })
  })

  describe('signed in', () => {
    const mountSignedIn = () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      useAuthStore().user = SIGNED_IN_USER
      return mount(AccountMenu, { global: { plugins: [pinia] } })
    }

    it('identifies the user with the avatar alone', () => {
      const wrapper = mountSignedIn()

      const avatar = wrapper.find('img.user-avatar')
      expect(avatar.exists()).toBe(true)
      expect(avatar.attributes('src')).toBe(SIGNED_IN_USER.avatarUrl)

      // The trigger carries no visible label
      expect(wrapper.find('[data-testid="user-menu-button"]').text().trim()).toBe('')
    })

    it('does not print the email or name anywhere on screen', () => {
      const text = mountSignedIn().text()
      expect(text).not.toContain(SIGNED_IN_USER.email)
      expect(text).not.toContain(SIGNED_IN_USER.name)
    })

    // The name is still the button's accessible name, so the account remains
    // identifiable to a screen reader and on hover.
    it('keeps the account identifiable through the accessible name', () => {
      const button = mountSignedIn().find('[data-testid="user-menu-button"]')
      expect(button.attributes('aria-label')).toContain(SIGNED_IN_USER.name)
      expect(button.attributes('title')).toContain(SIGNED_IN_USER.name)
    })

    it('offers sign out instead of sign in', () => {
      const wrapper = mountSignedIn()
      expect(wrapper.find('[data-testid="sign-out"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="sign-in-github"]').exists()).toBe(false)
    })
  })
})
