"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session, SupabaseClient, User } from "@supabase/supabase-js"
import { useSWRConfig } from "swr"
import { hasStoredSession, loadSupabase, whenSupabaseLoaded } from "@/lib/supabase-browser"
import { clearChatHistory } from "@/lib/local-store"

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Per-user data cached by SWR (lib/notes.ts, chat.ts, favorites.ts, portfolio.ts, consent.ts).
const ACCOUNT_KEYS = new Set(["notes", "ai_messages", "favorites", "portfolio", "consents"])

const AUTH_IN_URL = /[?&#](code|access_token|error_description)=/

/**
 * supabase-js is its own chunk. With a stored sign-in it loads once the
 * browser is idle, so it does not compete with the first render and scroll; a
 * page opened from a sign-in link or the Google redirect loads it at once.
 * Without one, the visitor is anonymous and it is not loaded at all until
 * something needs it (search, a panel, signing in).
 */
function whenIdle(run: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(run, 300)
  return () => window.clearTimeout(id)
}

/** Drops the offline copies of pages kept by the service worker (public/sw.js). */
function purgeOfflinePages() {
  navigator.serviceWorker?.controller?.postMessage({ type: "purge-pages" })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // "loading" on the server and during hydration, so the first client render
  // matches the HTML; an anonymous visitor leaves it right after.
  const [loading, setLoading] = useState(true)
  const { mutate } = useSWRConfig()

  const forgetAccountData = useCallback(async () => {
    clearChatHistory()
    purgeOfflinePages()
    await mutate((key) => Array.isArray(key) && ACCOUNT_KEYS.has(key[0]), undefined, { revalidate: false })
  }, [mutate])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const attach = (supabase: SupabaseClient) => {
      if (cancelled || unsubscribe) return
      const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
        setSession(nextSession)
        setLoading(false)
        // Signed out anywhere (another tab, an expired refresh): same cleanup as the button.
        if (event === "SIGNED_OUT") void forgetAccountData()
      })
      unsubscribe = () => data.subscription.unsubscribe()
      supabase.auth.getSession().then(({ data: current }) => {
        if (cancelled) return
        setSession(current.session)
        setLoading(false)
      })
    }

    const load = () =>
      loadSupabase()
        .then(attach)
        .catch((error) => {
          console.error("Loading auth failed:", error)
          if (!cancelled) setLoading(false)
        })

    let cancelLoad = () => {}
    if (AUTH_IN_URL.test(window.location.href)) {
      load()
    } else if (hasStoredSession()) {
      cancelLoad = whenIdle(load)
    } else {
      // Anonymous: nothing to restore. Listen in case something loads the client later.
      const stopListening = whenSupabaseLoaded(attach)
      const settled = window.setTimeout(() => setLoading(false), 0)
      cancelLoad = () => {
        stopListening()
        window.clearTimeout(settled)
      }
    }

    return () => {
      cancelled = true
      cancelLoad()
      unsubscribe?.()
    }
  }, [forgetAccountData])

  const signOut = async () => {
    // Before the session goes: removing the push subscription needs it. On a
    // shared device the next person must not get this account's reminders.
    try {
      const { unsubscribeThisDevice } = await import("@/lib/push")
      await unsubscribeThisDevice()
    } catch {}
    await (await loadSupabase()).auth.signOut()
    await forgetAccountData()
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>")
  return context
}

/** A fresh access token: getSession refreshes an expired one before returning. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await (await loadSupabase()).auth.getSession()
  return data.session?.access_token ?? null
}
