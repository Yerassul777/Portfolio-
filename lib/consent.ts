"use client"

import { useCallback } from "react"
import useSWR, { useSWRConfig } from "swr"
import { useAuth } from "@/components/auth-provider"
import { loadSupabase } from "@/lib/supabase-browser"
import { ageOn, todayInKazakhstan } from "@/lib/profile"
import { AI_MIN_AGE, POLICY_VERSION, bracketForAge, type AgeBracket } from "@/lib/policy"

export { POLICY_VERSION, type AgeBracket }
export type ConsentKind = "terms" | "ai_processing" | "notes_to_ai" | "push" | "certificate_scan"

type ConsentRow = { kind: string; version: string; age_bracket: AgeBracket | null; granted: boolean }

export interface Consents {
  /** Agreed to the current policy (with a parent's agreement under 18). */
  terms: boolean
  ageBracket: AgeBracket | null
  notesToAi: boolean
  /** Agreed that certificate photos go to OpenAI to be read. */
  certificateScan: boolean
}

const NONE: Consents = { terms: false, ageBracket: null, notesToAi: false, certificateScan: false }

async function fetchConsents(): Promise<Consents> {
  const { data, error } = await (await loadSupabase()).rpc("my_consents")
  if (error) throw error
  const latest = new Map((data as ConsentRow[]).map((row) => [row.kind, row]))
  const terms = latest.get("terms")
  return {
    terms: !!terms?.granted && terms.version === POLICY_VERSION,
    ageBracket: terms?.granted ? terms.age_bracket : null,
    notesToAi: !!latest.get("notes_to_ai")?.granted,
    certificateScan: !!latest.get("certificate_scan")?.granted,
  }
}

// What the sign-in form collected, kept until the sign-in completes (the
// email link and the Google redirect both reload the page).
const PENDING_KEY = "portfolio-pending-consent"
export type PendingConsent = { birthDate: string; parentOk: boolean; version: string }

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
    return parsed && parsed.version === POLICY_VERSION && /^\d{4}-\d{2}-\d{2}$/.test(parsed.birthDate) ? parsed : null
  } catch {
    return null
  }
}

export function useConsents() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const key = userId ? (["consents", userId] as const) : null
  const { mutate: mutateKey } = useSWRConfig()
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

  /**
   * Registration's last step, once the account exists: the date of birth goes
   * into the profile (once; an existing one wins), the agreement into the
   * consent log. The policy covers the assistant, so from 13 its consent is
   * recorded with it and the chat opens without another question.
   */
  const register = useCallback(
    async ({ birthDate, parentOk }: { birthDate: string; parentOk: boolean }) => {
      if (!userId) return
      const supabase = await loadSupabase()
      const { data: profile } = await supabase.from("profiles").select("birth_date").maybeSingle()
      const known = (profile as { birth_date: string | null } | null)?.birth_date ?? null
      if (!known) {
        const { error: profileError } = await supabase.from("profiles").update({ birth_date: birthDate }).eq("id", userId)
        if (profileError) throw profileError
      }
      const age = ageOn(known ?? birthDate, todayInKazakhstan())
      const ageBracket = bracketForAge(age)
      const rows = [
        { kind: "terms", granted: true, version: POLICY_VERSION, age_bracket: ageBracket, parent_ok: parentOk },
        ...(age >= AI_MIN_AGE ? [{ kind: "ai_processing", granted: true, version: POLICY_VERSION, age_bracket: null, parent_ok: false }] : []),
      ]
      const { error: insertError } = await supabase.from("consents").insert(rows)
      if (insertError) throw insertError
      await Promise.all([mutate(), mutateKey(["profile", userId])])
    },
    [userId, mutate, mutateKey]
  )

  /** Records what the sign-in form collected, if anything. Returns whether it did. */
  const recordPending = useCallback(async () => {
    const pending = takePendingConsent()
    if (!pending) return false
    await register(pending)
    return true
  }, [register])

  return {
    consents: data ?? NONE,
    ready: !user || data !== undefined || !!error,
    loadFailed: !!error && data === undefined,
    record,
    register,
    recordPending,
  }
}
