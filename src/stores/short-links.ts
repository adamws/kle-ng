import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isAuthConfigured } from '@/config/supabase'
import { getSupabaseClient } from '@/utils/supabase-loader'
import { MAX_SHORT_LINK_PAYLOAD_LENGTH } from '@/utils/short-links'

/**
 * Short Links Store
 *
 * Creation only. Resolution lives in utils/short-links.ts as a raw fetch — it has to
 * work for an anonymous visitor without loading supabase-js, and it needs no state.
 *
 * There is no local cache and no list. `short_links.created_by` records who first made
 * a link, but that is an operator's audit trail for catching abuse — no client can read
 * it, and it is not ownership: a link is shared by everyone who shortened that layout,
 * so there is no such thing as "my short links". Creation is idempotent because
 * `short_links.hash` is a unique index on sha256(payload), so pressing the button twice
 * finds the first call's row and returns its id.
 *
 * See supabase/migrations/20260816120000_short_links.sql.
 */

export const SHORT_LINK_TOO_LARGE = 'This layout is too large to share as a short link.'

/** Turn a PostgREST error into something the user can act on. */
function describeError(error: unknown, fallback: string): string {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : error instanceof Error
        ? error.message
        : ''

  // Raised by create_short_link when auth.uid() is null. Reachable when the session
  // expires between the menu item rendering and the click.
  if (message.includes('short_link_auth_required')) {
    return 'Your session has expired. Sign in again to create a short link.'
  }
  if (message.includes('short_links_payload_length')) {
    return SHORT_LINK_TOO_LARGE
  }
  // Raised by create_short_link's windowed per-user counter. Only new links are
  // charged, so a user who keeps re-sharing the same layout never reaches this.
  if (message.includes('short_link_rate_limit_exceeded')) {
    return 'You have created a lot of short links recently. Please try again later.'
  }
  // Should be unreachable short of a full sha256 collision, but a raw Postgres string
  // in a toast is worse than a vague one.
  if (message.includes('short_link_id_collision')) {
    return 'Could not create a short link for this layout. Please try again.'
  }
  // PGRST202: the RPC does not exist. Migrations are pushed to hosted projects by hand,
  // so "client deployed, migration not pushed" is a live possibility.
  if (message.includes('PGRST202') || message.includes('Could not find the function')) {
    return 'Short links are not available on this server yet.'
  }
  // 42501: the EXECUTE grant is missing, or the request went out as anon.
  if (message.includes('permission denied for function')) {
    return 'You need to be signed in to create a short link.'
  }
  return message || fallback
}

export const useShortLinksStore = defineStore('shortLinks', () => {
  const busy = ref(false)
  const errorMessage = ref<string | null>(null)

  const client = async () => {
    if (!isAuthConfigured()) throw new Error('Accounts are not configured')
    return getSupabaseClient()
  }

  /**
   * Get-or-create a short link id for a compressed payload.
   *
   * @returns the id, or null when it could not be created (see errorMessage)
   */
  const create = async (payload: string): Promise<string | null> => {
    // Cleared before the busy guard: the caller renders errorMessage for any null, so a
    // previous attempt's message must not be reported as the reason a re-entrant call
    // returned nothing.
    errorMessage.value = null
    if (busy.value) return null

    // Fast path only — short_links_payload_length is the real limit, and describeError()
    // still translates it if the two ever drift apart.
    if (payload.length > MAX_SHORT_LINK_PAYLOAD_LENGTH) {
      errorMessage.value = SHORT_LINK_TOO_LARGE
      return null
    }

    busy.value = true
    try {
      const supabase = await client()
      const { data, error } = await supabase.rpc('create_short_link', { payload })
      if (error) throw error
      if (typeof data !== 'string') {
        throw new Error('Unexpected response from create_short_link')
      }
      return data
    } catch (error) {
      console.error('Error creating short link:', error)
      errorMessage.value = describeError(error, 'Could not create a short link')
      return null
    } finally {
      busy.value = false
    }
  }

  /** Called on sign-out so the next user starts clean. */
  const reset = () => {
    busy.value = false
    errorMessage.value = null
  }

  return {
    busy,
    errorMessage,
    create,
    reset,
  }
})
