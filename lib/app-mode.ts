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
    // A desktop app window whose title bar the app draws itself.
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

/**
 * The script in the root layout's <head>. Kept tiny and dependency-free. In
 * the app it also
 * - asks for the launch screen on a cold start (once per app session), and
 * - turns off pinch zoom in the viewport (the meta may come after this
 *   script, so it runs again once the document is parsed).
 */
export const APP_MODE_SCRIPT =
  // Weak device (≤ 2 GB of memory or ≤ 2 cores): data-lite turns off decorative motion (globals.css).
  "try{var d=document.documentElement,n=navigator;if((n.hardwareConcurrency&&n.hardwareConcurrency<=2)||(n.deviceMemory&&n.deviceMemory<=2))d.dataset.lite='1'}catch(e){}" +
  "try{var d=document.documentElement;if(matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: window-controls-overlay)').matches||navigator.standalone===true){d.dataset.app='1';" +
  "try{if(!sessionStorage.getItem('app-launched')){sessionStorage.setItem('app-launched','1');d.dataset.splash='1'}}catch(e){d.dataset.splash='1'}" +
  "var z=function(){var m=document.querySelector('meta[name=viewport]');if(m&&m.content.indexOf('user-scalable')<0)m.content+=',maximum-scale=1,user-scalable=no'};z();document.addEventListener('DOMContentLoaded',z)}}catch(e){}"

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
export type PortfolioTab = "favorites" | "achievements" | "notes" | "account"
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
