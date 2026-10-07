import type { SupabaseClient } from "@supabase/supabase-js"

let clientPromise: Promise<SupabaseClient> | null = null
const loadedListeners = new Set<(client: SupabaseClient) => void>()

/**
 * One client per tab, loaded on first use. supabase-js is ~60 KB gzipped and
 * nothing on first paint needs it (the server renders the catalogue), so it is
 * a separate chunk rather than part of every page's initial JavaScript.
 *
 * The session lives in localStorage rather than cookies so the same code keeps
 * working inside a future app shell (WebView), where cookies are unreliable.
 */
export function loadSupabase(): Promise<SupabaseClient> {
  clientPromise ??= import("@supabase/supabase-js")
    .then(({ createClient }) => {
      const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      })
      for (const listener of loadedListeners) listener(client)
      loadedListeners.clear()
      return client
    })
    .catch((error) => {
      // A failed chunk download (flaky network) must not poison every later call.
      clientPromise = null
      throw error
    })
  return clientPromise
}

/** Runs `listener` once the client exists, whoever loads it. Returns an unsubscribe. */
export function whenSupabaseLoaded(listener: (client: SupabaseClient) => void): () => void {
  loadedListeners.add(listener)
  return () => loadedListeners.delete(listener)
}

/** Whether a sign-in may be stored on this device (supabase-js keeps it under sb-<ref>-auth-token). */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && /^sb-.+-auth-token$/.test(key)) return true
    }
  } catch {}
  return false
}
