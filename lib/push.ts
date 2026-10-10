"use client"

import { useCallback, useEffect, useState } from "react"
import { isIOS, isStandalone } from "@/lib/app-mode"
import { loadSupabase } from "@/lib/supabase-browser"

// Deadline reminders by Web Push. On iPhone and iPad, push exists only in the
// installed app (iOS 16.4+), which is the point: the app can do this, the
// website in Safari cannot.

/**
 * - "unsupported": this browser cannot receive push
 * - "install": iPhone/iPad in Safari; works once installed on the Home Screen
 * - "denied": the user blocked notifications for the site
 * - "off" / "on": can be switched
 */
export type PushState = "loading" | "unsupported" | "install" | "denied" | "off" | "on"

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function supported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && PUBLIC_KEY !== ""
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

async function detect(): Promise<PushState> {
  if (!supported()) return isIOS() && !isStandalone() ? "install" : "unsupported"
  if (Notification.permission === "denied") return "denied"
  return (await currentSubscription()) ? "on" : "off"
}

/** Removes this device's subscription, here and in the database. Used on sign-out too. */
export async function unsubscribeThisDevice(): Promise<void> {
  if (!supported()) return
  const subscription = await currentSubscription()
  if (!subscription) return
  const supabase = await loadSupabase()
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint)
  await subscription.unsubscribe()
}

export function usePush() {
  const [state, setState] = useState<PushState>("loading")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    detect()
      .then((next) => !cancelled && setState(next))
      .catch(() => !cancelled && setState("unsupported"))
    return () => {
      cancelled = true
    }
  }, [])

  /** Must run from a tap: browsers only ask for permission in response to one. */
  const enable = useCallback(async () => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off")
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }))
      const json = subscription.toJSON()
      const supabase = await loadSupabase()
      const { error } = await supabase.rpc("save_push_subscription", {
        p_endpoint: subscription.endpoint,
        p_p256dh: json.keys?.p256dh ?? "",
        p_auth: json.keys?.auth ?? "",
        // Reminders arrive in the language the user turned them on in.
        p_locale: document.documentElement.lang === "kk" ? "kz" : document.documentElement.lang === "en" ? "en" : "ru",
      })
      if (error) {
        await subscription.unsubscribe()
        throw error
      }
      setState("on")
    } finally {
      setBusy(false)
    }
  }, [])

  const disable = useCallback(async () => {
    setBusy(true)
    try {
      await unsubscribeThisDevice()
      setState("off")
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, busy, enable, disable }
}
