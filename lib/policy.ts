// Shared by the browser (lib/consent.ts) and the server (the AI route).

/** Date of the privacy policy text (app/[locale]/privacy). A new date asks everyone again. */
export const POLICY_VERSION = "2026-10-07"

export type AgeBracket = "18plus" | "13to17" | "under13"
