"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { useAuth } from "@/components/auth-provider"
import { loadSupabase } from "@/lib/supabase-browser"

import { POLICY_VERSION, type AgeBracket } from "@/lib/policy"

export { POLICY_VERSION, type AgeBracket }
export type ConsentKind = "terms" | "ai_processing" | "notes_to_ai" | "push"

type ConsentRow = { kind: string; version: string; age_bracket: AgeBracket | null; granted: boolean }

export interface Consents {
  /** Agreed to the current policy (with a parent's agreement under 18). */
  terms: boolean
  ageBracket: AgeBracket | null
  /** Read the notice that messages go to OpenAI. */
  aiNotice: boolean
  notesToAi: boolean
}

const NONE: Consents = { terms: false, ageBracket: null, aiNotice: false, notesToAi: false }

async function fetchConsents(): Promise<Consents> {
  const { data, error } = await (await loadSupabase()).rpc("my_consents")
  if (error) throw error
  const latest = new Map((data as ConsentRow[]).map((row) => [row.kind, row]))
  const terms = latest.get("terms")
  return {
    terms: !!terms?.granted && terms.version === POLICY_VERSION,
    ageBracket: terms?.granted ? terms.age_bracket : null,
    aiNotice: !!latest.get("ai_processing")?.granted,
    notesToAi: !!latest.get("notes_to_ai")?.granted,
  }
}

// What the sign-in form collected, kept until the sign-in completes (the
// email link and the Google redirect both reload the page).
const PENDING_KEY = "portfolio-pending-consent"
export type PendingConsent = { ageBracket: AgeBracket; parentOk: boolean; version: string }

export function savePendingConsent(consent: PendingConsent) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(consent))
  } catch {}
}

function takePendingConsent(): PendingConsent | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    const parsed = raw ? (JSON.parse(raw) as PendingConsent) : null
    return parsed && parsed.version === POLICY_VERSION ? parsed : null
  } catch {
    return null
  }
}

export function useConsents() {
  const { user } = useAuth()
  const key = user ? (["consents", user.id] as const) : null
  const { data, error, mutate } = useSWR(key, fetchConsents, { revalidateOnFocus: false, dedupingInterval: 30_000 })

  const record = useCallback(
    async (kind: ConsentKind, granted: boolean, extra: { ageBracket?: AgeBracket; parentOk?: boolean } = {}) => {
      const supabase = await loadSupabase()
      const { error: insertError } = await supabase.from("consents").insert({
        kind,
        granted,
        version: POLICY_VERSION,
        age_bracket: extra.ageBracket ?? null,
        parent_ok: extra.parentOk ?? false,
      })
      if (insertError) throw insertError
      await mutate()
    },
    [mutate]
  )

  /** Records what the sign-in form collected, if anything. Returns whether it did. */
  const recordPending = useCallback(async () => {
    const pending = takePendingConsent()
    if (!pending) return false
    await record("terms", true, { ageBracket: pending.ageBracket, parentOk: pending.parentOk })
    return true
  }, [record])

  return {
    consents: data ?? NONE,
    ready: !user || data !== undefined || !!error,
    loadFailed: !!error && data === undefined,
    record,
    recordPending,
  }
}
