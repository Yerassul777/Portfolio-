"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Older than this, the page came from the offline copy rather than the network. */
const STALE_MS = 2 * 60_000

// Once per page load: the refreshed page renders again with a new time, which
// a phone whose clock is a few minutes off would also take for old.
let refreshed = false

/**
 * The app opens its home page from the offline copy for a quick start
 * (public/sw.js). Once the launch screen is gone, such a page is brought up to
 * date: the server renders it again and React swaps in what changed, in place.
 * Once per copy, and only online — a refresh that fails reloads the page, and
 * offline that would come back to the same copy.
 */
export function FreshPage({ renderedAt }: { renderedAt: number }) {
  const router = useRouter()

  useEffect(() => {
    if (refreshed || Date.now() - renderedAt < STALE_MS || !navigator.onLine) return
    const key = `refreshed:${renderedAt}`
    try {
      if (sessionStorage.getItem(key)) return
    } catch {
      return
    }
    const root = document.documentElement
    let timer = 0
    const refresh = () => {
      timer = window.setTimeout(() => {
        refreshed = true
        try {
          sessionStorage.setItem(key, "1")
        } catch {}
        router.refresh()
      }, 300)
    }
    if (!root.dataset.splash) {
      refresh()
      return () => window.clearTimeout(timer)
    }
    const observer = new MutationObserver(() => {
      if (root.dataset.splash) return
      observer.disconnect()
      refresh()
    })
    observer.observe(root, { attributes: true, attributeFilter: ["data-splash"] })
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
    }
  }, [renderedAt, router])

  return null
}
