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
  }
}
