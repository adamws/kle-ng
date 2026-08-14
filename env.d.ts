/// <reference types="vite/client" />

import type {} from './src/types/filesystem-access'

declare global {
  interface ImportMetaEnv {
    /** PCB generator backend (see src/config/api.ts). Unset disables the generator. */
    readonly VITE_BACKEND_URL?: string
    /** Supabase project URL. Unset disables accounts (see src/config/supabase.ts). */
    readonly VITE_SUPABASE_URL?: string
    /** Supabase anon key — public by design; RLS is the security boundary. */
    readonly VITE_SUPABASE_ANON_KEY?: string
    /**
     * Shared test account for preview deployments (see getTestUser() in
     * src/config/supabase.ts). Set only by the preview workflow; both of these are
     * compiled into the bundle and are therefore PUBLIC. Never point them at an
     * account that exists on the production project.
     */
    readonly VITE_TEST_USER_EMAIL?: string
    readonly VITE_TEST_USER_PASSWORD?: string
  }
}
