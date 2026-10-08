import { createHmac } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createUserClient } from "@/lib/supabase-server"
import { todayInAlmaty } from "@/lib/deadline"
import { AI_MIN_AGE, POLICY_VERSION, ageOn } from "@/lib/policy"

// The gates every OpenAI-backed route shares (scanner, trajectory): signed
// in, registered under the current policy, 13 or older. Server only.

export type AccessProfile = {
  display_name: string | null
  nickname: string | null
  grade: string | null
  city: string | null
  interests: string | null
  birth_date: string | null
}

export type AiAccess =
  | {
      ok: true
      supabase: SupabaseClient
      userId: string
      profile: AccessProfile | null
      consents: Map<string, { kind: string; version: string; age_bracket: string | null; granted: boolean }>
    }
  | { ok: false; response: Response }

const deny = (error: string, code: string, status: number): AiAccess => ({ ok: false, response: Response.json({ error, code }, { status }) })

export async function checkAiAccess(req: Request, what: string): Promise<AiAccess> {
  const header = req.headers.get("authorization") ?? ""
  const token = header.startsWith("Bearer ") ? header.slice(7) : null
  const supabase = token ? createUserClient(token) : null
  const { data: auth } = supabase && token ? await supabase.auth.getUser(token) : { data: null }
  if (!supabase || !auth?.user) return deny(`Войдите, чтобы ${what}.`, "auth_required", 401)

  const [{ data: rows, error: consentError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.rpc("my_consents"),
    supabase.from("profiles").select("display_name, nickname, grade, city, interests, birth_date").maybeSingle(),
  ])
  if (consentError || profileError) {
    console.error("AI access check failed:", (consentError ?? profileError)?.code)
    return deny("Не получилось. Попробуйте ещё раз.", "failed", 500)
  }
  const consents = new Map(((rows ?? []) as { kind: string; version: string; age_bracket: string | null; granted: boolean }[]).map((r) => [r.kind, r]))
  const terms = consents.get("terms")
  if (!terms?.granted || terms.version !== POLICY_VERSION) return deny("Сначала завершите регистрацию.", "consent_required", 403)
  const p = profile as AccessProfile | null
  const tooYoung = p?.birth_date ? ageOn(p.birth_date, todayInAlmaty()) < AI_MIN_AGE : terms.age_bracket === "under13"
  if (tooYoung) return deny("Доступно с 13 лет.", "age_restricted", 403)
  return { ok: true, supabase, userId: auth.user.id, profile: p, consents }
}

/** OpenAI's per-user abuse signal: a keyed hash, never the user id itself. */
export function safetyIdentifier(userId: string, apiKey: string): string {
  return createHmac("sha256", process.env.AI_SAFETY_SALT || apiKey).update(userId).digest("hex")
}

/** What the user chose to tell about themselves, as data for the model. No date of birth, no email. */
export function describeProfile(profile: AccessProfile | null): string {
  if (!profile) return ""
  const clean = (value: string | null, max: number) => (value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, max)
  const study: Record<string, string> = { college: "учится в колледже", student: "студент" }
  const lines = [
    clean(profile.display_name, 80) && `Имя: ${clean(profile.display_name, 80)}`,
    clean(profile.nickname, 32) && `Никнейм: ${clean(profile.nickname, 32)}`,
    profile.grade && (/^\d+$/.test(profile.grade) ? `Класс: ${profile.grade}` : study[profile.grade] && `Учёба: ${study[profile.grade]}`),
    clean(profile.city, 60) && `Город: ${clean(profile.city, 60)}`,
    clean(profile.interests, 300) && `Интересы: ${clean(profile.interests, 300)}`,
  ].filter(Boolean)
  return lines.join("\n")
}
