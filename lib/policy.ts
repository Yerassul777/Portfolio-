// Shared by the browser (lib/consent.ts) and the server (the AI route).

/** Date of the privacy policy text (components/privacy-policy.tsx). A new date asks everyone again. */
export const POLICY_VERSION = "2026-10-08"

export type AgeBracket = "18plus" | "13to17" | "under13"

/** The assistant is closed under this age (OpenAI's terms). */
export const AI_MIN_AGE = 13

/** Full years on `today` (YYYY-MM-DD dates, no time zones involved). */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number)
  const [ty, tm, td] = today.split("-").map(Number)
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

export function bracketForAge(age: number): AgeBracket {
  return age >= 18 ? "18plus" : age >= AI_MIN_AGE ? "13to17" : "under13"
}
