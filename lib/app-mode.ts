"use client"

import { useSyncExternalStore } from "react"

// The installed app (Home Screen, standalone window) and the website share
// one codebase but not one experience: the app gets a tab bar, full-screen
// tabs, pull-to-refresh and push reminders.
//
// <html data-app="1"> is set by an inline script in the root layout before
// the first paint, so CSS can switch layout (the `app:` Tailwind variant)
// without a flash; components read the same flag through useAppMode().

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/** The script in the root layout's <head>. Kept tiny and dependency-free. */
export const APP_MODE_SCRIPT =
  "try{if(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)document.documentElement.dataset.app='1'}catch(e){}"

const noop = () => () => {}
const read = () => document.documentElement.dataset.app === "1"

/** True in the installed app. False during server rendering and on the website. */
export function useAppMode(): boolean {
  return useSyncExternalStore(noop, read, () => false)
}

/** A light tap where the platform has one (Android); silent elsewhere. */
export function haptic() {
  if (read()) navigator.vibrate?.(8)
}

// --- opening a panel from anywhere (a heart on a card, "I'm taking part") ----

export type PanelName = "ai" | "portfolio"
export type PortfolioTab = "favorites" | "achievements" | "notes"
export type PanelRequest = { panel: PanelName; tab?: PortfolioTab }

const OPEN_EVENT = "portfolio:open-panel"

export function openPanel(request: PanelRequest) {
  window.dispatchEvent(new CustomEvent<PanelRequest>(OPEN_EVENT, { detail: request }))
}

export function onOpenPanel(listener: (request: PanelRequest) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<PanelRequest>).detail)
  window.addEventListener(OPEN_EVENT, handler)
  return () => window.removeEventListener(OPEN_EVENT, handler)
}
