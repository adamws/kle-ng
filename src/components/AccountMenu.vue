<template>
  <!--
    The trailing header menu. It carries the theme setting as well as the account,
    so unlike the account section inside it, it renders whether or not accounts are
    configured — otherwise a build without Supabase env vars would have no way to
    change the theme at all.

    For the same reason `auth.busy` disables the account entries rather than the
    trigger: signIn() leaves `busy` set on its success path (the browser is meant to
    leave the page), so a bfcache restore after a back-navigation would otherwise
    come back with theme switching permanently unavailable.
  -->
  <div class="dropdown">
    <button
      class="account-trigger"
      data-testid="user-menu-button"
      type="button"
      data-bs-toggle="dropdown"
      aria-expanded="false"
      :title="triggerLabel"
      :aria-label="triggerLabel"
    >
      <img
        v-if="auth.isSignedIn && auth.user?.avatarUrl"
        :src="auth.user.avatarUrl"
        class="user-avatar"
        alt=""
      />
      <BiPersonCircle v-else aria-hidden="true" />
    </button>

    <ul class="dropdown-menu dropdown-menu-end" data-testid="user-menu-dropdown">
      <!-- Theme first: it is the only entry every visitor can use, and putting it at
           the top is what makes it findable behind an unlabeled icon. -->
      <li><h6 class="dropdown-header">Theme</h6></li>
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

      <!-- Accounts are optional; without them the menu is just the theme picker -->
      <template v-if="auth.isConfigured">
        <!-- Sign out has no heading band of its own, so it needs the divider; the
             signed-out branch below is introduced by its own band instead. -->
        <template v-if="auth.isSignedIn">
          <li><hr class="dropdown-divider" /></li>
          <li>
            <button
              class="dropdown-item d-flex align-items-center gap-2"
              data-testid="sign-out"
              :disabled="auth.busy"
              @click="auth.signOut()"
            >
              <BiBoxArrowRight />
              Sign out
            </button>
          </li>
        </template>

        <template v-else>
          <li><h6 class="dropdown-header">Sign in to save layouts</h6></li>
          <!--
            GitHub is the only provider enabled in Supabase. `AuthProvider` still allows
            'google', so adding it back is this block plus dashboard configuration.
          -->
          <li>
            <button
              class="dropdown-item d-flex align-items-center gap-2"
              data-testid="sign-in-github"
              :disabled="auth.busy"
              @click="auth.signIn('github')"
            >
              <BiGithub />
              Continue with GitHub
            </button>
          </li>

          <!-- The account seeded into the local dev stack, and only that: getTestUser()
               requires a dev build against a local instance, so no deployed build —
               preview or production — ever offers this. -->
          <template v-if="auth.canUseTestUser">
            <li><hr class="dropdown-divider" /></li>
            <li>
              <button
                class="dropdown-item d-flex align-items-center gap-2"
                data-testid="sign-in-test-user"
                :disabled="auth.busy"
                @click="auth.signInAsTestUser()"
              >
                <BiPersonCircle />
                <span>
                  Continue as test user
                  <span class="d-block text-muted small">{{ auth.testUser?.label }}</span>
                </span>
              </button>
            </li>
          </template>
        </template>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'

import BiPersonCircle from 'bootstrap-icons/icons/person-circle.svg'
import BiBoxArrowRight from 'bootstrap-icons/icons/box-arrow-right.svg'
import BiGithub from 'bootstrap-icons/icons/github.svg'
import BiSunFill from 'bootstrap-icons/icons/sun-fill.svg'
import BiMoonStarsFill from 'bootstrap-icons/icons/moon-stars-fill.svg'
import BiCircleHalf from 'bootstrap-icons/icons/circle-half.svg'

const auth = useAuthStore()
const { theme, setTheme } = useTheme()

/**
 * The signed-in account is identified here rather than on screen: the trigger is
 * avatar-only by design, but a user still needs some way to confirm which account
 * they are in, and screen readers need a name for the button.
 */
const triggerLabel = computed(() => {
  if (auth.isSignedIn) return `Settings — signed in as ${auth.user?.name}`
  return auth.isConfigured ? 'Settings and sign in' : 'Settings'
})
</script>

<style scoped>
/* Deliberately not a .btn: the avatar is already a circle, and a rectangle drawn
   around it read as a box with a circle in it. The padding and the transparent border
   reproduce a .btn's footprint exactly, so dropping the chrome leaves every other
   control in the header where it was. */
.account-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem 0.75rem;
  border: 2px solid transparent;
  background: none;
  color: var(--bs-body-color);
  border-radius: 50%;
  /* base.css sets the body to 15px; .btn pinned this to 1rem, and the strut below is
     sized in em, so restate it or the button ends up a pixel shorter than its row */
  font-size: 1rem;
}

/* Without a label the button would collapse to the height of its icon and sit short
   next to the text buttons. The strut gives it the same line box a text button has, so
   the heights track each other through the responsive font-size changes. */
.account-trigger::before {
  content: '';
  display: block;
  width: 0;
  height: 1.5em;
}

/* em, not rem, so these shrink with the button and never outgrow the strut above */
.user-avatar,
.account-trigger svg {
  width: 1.5em;
  height: 1.5em;
}

.user-avatar {
  border-radius: 50%;
  object-fit: cover;
}

/* Hover and the open menu are shown on the circle itself — there is no longer a
   surrounding shape for them to land on. Keyboard focus needs a ring rather than the
   same treatment: signed out the circle is an icon, and recolouring it would be
   indistinguishable from hover. The outline follows the border-radius above. */
.account-trigger:focus {
  outline: none;
}

.account-trigger:focus-visible {
  outline: 2px solid var(--bs-primary);
  outline-offset: 2px;
}

.account-trigger:hover .user-avatar,
.account-trigger.show .user-avatar {
  box-shadow: 0 0 0 2px var(--bs-primary);
}

.account-trigger:hover svg,
.account-trigger.show svg {
  color: var(--bs-primary);
}

.dropdown-item.active:hover {
  background-color: var(--bs-dropdown-link-active-bg) !important;
}
</style>
