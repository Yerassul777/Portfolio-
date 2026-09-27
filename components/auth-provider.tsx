"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { loadSupabase } from "@/lib/supabase-browser"
import { clearChatHistory } from "@/lib/local-store"

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // supabase-js arrives as its own chunk after first paint. Loading it here
  // also completes a sign-in when the page was opened from the email link.
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined

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

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  const signOut = async () => {
    await (await loadSupabase()).auth.signOut()
    // The chat transcript is stored per device, not per account: drop it so the
    // next person on a shared computer does not see it.
    clearChatHistory()
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
