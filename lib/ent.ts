"use client"

import { useSyncExternalStore } from "react"

// The student's ENT score, compared on a university's card with last year's
// grant pass score (opportunities.pass_score). It stays on this device: it is
// not part of the profile on the server, so it never leaves the browser and
// works without an account. Every open tab follows a change.

export const ENT_MAX = 140

const KEY = "entScore"
const listeners = new Set<() => void>()

function read(): number | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isInteger(n) && n >= 0 && n <= ENT_MAX ? n : null
  } catch {
    return null
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** The saved score, or null. Null on the server and during hydration, so the HTML matches. */
export function useEntScore(): number | null {
  return useSyncExternalStore(subscribe, read, () => null)
}

/** Saves (or with null, forgets) the score. Out-of-range values are not saved. */
export function setEntScore(score: number | null) {
  try {
    if (score === null) localStorage.removeItem(KEY)
    else if (Number.isInteger(score) && score >= 0 && score <= ENT_MAX) localStorage.setItem(KEY, String(score))
    else return
  } catch {
    // Storage off (private mode): the score just is not kept.
  }
  for (const listener of listeners) listener()
}

/** How the score compares with a pass score: null when either is unknown. */
export function entFit(score: number | null, passScore: number | null | undefined): { fits: true } | { fits: false; missing: number } | null {
  if (score === null || passScore === null || passScore === undefined) return null
  return score >= passScore ? { fits: true } : { fits: false, missing: passScore - score }
}
