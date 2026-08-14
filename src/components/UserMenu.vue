<template>
  <!-- Hidden entirely when accounts are not configured, so the editor is unchanged -->
  <div v-if="auth.isConfigured" class="dropdown">
    <button
      class="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2"
      data-testid="user-menu-button"
      type="button"
      data-bs-toggle="dropdown"
      aria-expanded="false"
      :disabled="auth.busy"
      :title="auth.isSignedIn ? `Signed in as ${auth.user?.name}` : 'Sign in'"
    >
      <img
        v-if="auth.isSignedIn && auth.user?.avatarUrl"
        :src="auth.user.avatarUrl"
        class="user-avatar"
        alt=""
      />
      <BiPersonCircle v-else />
      <span class="d-none d-lg-inline text-truncate user-label">
        {{ auth.isSignedIn ? auth.user?.name : 'Sign in' }}
      </span>
    </button>

    <ul class="dropdown-menu dropdown-menu-end" data-testid="user-menu-dropdown">
      <template v-if="auth.isSignedIn">
        <li>
          <h6 class="dropdown-header text-truncate">{{ auth.user?.email || auth.user?.name }}</h6>
        </li>
        <li><hr class="dropdown-divider" /></li>
        <li>
          <button
            class="dropdown-item d-flex align-items-center gap-2"
            data-testid="sign-out"
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
            @click="auth.signIn('github')"
          >
            <BiGithub />
            Continue with GitHub
          </button>
        </li>

        <!-- Dev builds against a local Supabase stack only; compiled out of production -->
        <template v-if="auth.canUseTestUser">
          <li><hr class="dropdown-divider" /></li>
          <li>
            <button
              class="dropdown-item d-flex align-items-center gap-2"
              data-testid="sign-in-test-user"
              @click="auth.signInAsTestUser()"
            >
              <BiPersonCircle />
              <span>
                Continue as test user
                <span class="d-block text-muted small">local development</span>
              </span>
            </button>
          </li>
        </template>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

import BiPersonCircle from 'bootstrap-icons/icons/person-circle.svg'
import BiBoxArrowRight from 'bootstrap-icons/icons/box-arrow-right.svg'
import BiGithub from 'bootstrap-icons/icons/github.svg'

const auth = useAuthStore()
</script>

<style scoped>
.user-avatar {
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  object-fit: cover;
}

.user-label {
  max-width: 10rem;
}
</style>
