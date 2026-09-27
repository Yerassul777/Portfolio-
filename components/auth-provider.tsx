"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { useSWRConfig } from "swr"
import { loadSupabase } from "@/lib/supabase-browser"
import { clearChatHistory } from "@/lib/local-store"

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

// Per-user data cached by SWR (lib/notes.ts, lib/chat.ts).
const ACCOUNT_KEYS = new Set(["notes", "ai_messages"])

/**
 * supabase-js is its own chunk. It loads once the browser is idle, so it does
 * not compete with the first render and the first scroll on a slow phone. A
 * page opened from a sign-in link or the Google redirect loads it at once.
 */
function whenIdle(run: () => void): () => void {
  if (/[?&#](code|access_token|error_description)=/.test(window.location.href)) {
    run()
    return () => {}
  }
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 2000 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(run, 300)
  return () => window.clearTimeout(id)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { mutate } = useSWRConfig()

  // Loading supabase-js also completes a sign-in when the page was opened
  // from the email link.
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    const cancelIdle = whenIdle(() => {
      loadSupabase()
        .then((supabase) => {
          if (cancelled) return
          const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession)
            setLoading(false)
          })
          unsubscribe = () => data.subscription.unsubscribe()
          return supabase.auth.getSession().then(({ data: current }) => {
            if (cancelled) return
            setSession(current.session)
            setLoading(false)
          })
        })
        .catch((error) => {
          console.error("Loading auth failed:", error)
          if (!cancelled) setLoading(false)
        })
    })

    return () => {
      cancelled = true
      cancelIdle()
      unsubscribe?.()
    }
  }, [])

  const signOut = async () => {
    await (await loadSupabase()).auth.signOut()
    // The account's notes and chat stay in memory until the page reloads: drop
    // them, and any chat an older version left on this device, so the next
    // person on a shared computer does not see them.
    clearChatHistory()
    await mutate((key) => Array.isArray(key) && ACCOUNT_KEYS.has(key[0]), undefined, { revalidate: false })
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
