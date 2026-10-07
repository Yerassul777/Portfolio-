"use client"

import { useSyncExternalStore } from "react"
import { isIOS, isStandalone } from "@/lib/app-mode"

// Installing the site as an app (PWA): the service worker, and the browser's
// install prompt, which fires once and early, so it is captured at start-up
// and kept until the install button asks for it.

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

let deferredPrompt: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

let started = false

/** Registers the service worker and starts listening for the install prompt. Idempotent. */
export function startPwa() {
  if (started || typeof window === "undefined") return
  started = true

  window.addEventListener("beforeinstallprompt", (event) => {
    // Our own button offers the install; the browser's menu still does too.
    event.preventDefault()
    deferredPrompt = event as InstallPromptEvent
    notify()
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    installed = true
    notify()
  })

  // Development builds change on every save; a cache there only gets in the way.
  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.error("Service worker registration failed:", error)
      })
    }
    // After load, so the worker's own downloads never compete with the page.
    if (document.readyState === "complete") register()
    else window.addEventListener("load", register, { once: true })
  }
}

/**
 * - "prompt": the browser offered an install (Android, Windows, desktop Chrome/Edge)
 * - "ios": iPhone/iPad, installed by hand through the Share menu
 * - "none": already installed, or the browser cannot install sites
 */
export type InstallState = "prompt" | "ios" | "none"

function getState(): InstallState {
  if (installed || isStandalone()) return "none"
  if (deferredPrompt) return "prompt"
  if (isIOS()) return "ios"
  return "none"
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getState, () => "none")
}

/** Shows the browser's install dialog. Resolves to whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = deferredPrompt
  if (!event) return false
  deferredPrompt = null
  notify()
  await event.prompt()
  const { outcome } = await event.userChoice
  return outcome === "accepted"
}
