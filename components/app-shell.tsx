"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { useRouter } from "next/navigation"
import { useSWRConfig } from "swr"
import { ArrowDown, Bot, Briefcase, Heart, LayoutGrid, Loader2, type LucideIcon } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { haptic } from "@/lib/app-mode"
import { daysUntil } from "@/lib/deadline"
import { useFavorites } from "@/lib/favorites"
import { cn } from "@/lib/utils"

// The installed app's frame: a tab bar instead of header buttons, pull-to-
// refresh (a home-screen app on iOS has no reload at all), and the number on
// the app icon. Loaded only in standalone mode (HeaderTools), so none of this
// is in the website's JavaScript.

export type AppTab = "catalogue" | "favorites" | "portfolio" | "ai"

const TABS: { id: AppTab; icon: LucideIcon }[] = [
  { id: "catalogue", icon: LayoutGrid },
  { id: "favorites", icon: Heart },
  { id: "portfolio", icon: Briefcase },
  { id: "ai", icon: Bot },
]

/** Days ahead that count towards the number on the app icon. */
const BADGE_DAYS = 3

interface AppShellProps {
  active: AppTab
  onSelect: (tab: AppTab) => void
  /** Gets focus when a screen closes. */
  focusRef: RefObject<HTMLElement | null>
}

export function AppShell({ active, onSelect, focusRef }: AppShellProps) {
  const { t } = useI18n()
  return (
    <>
      <nav
        aria-label={t.app.tabsLabel}
        className="fixed inset-x-0 bottom-0 z-[60] border-t border-emerald-500/10 bg-[#0a0f0d] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid h-16 max-w-xl grid-cols-4">
          {TABS.map(({ id, icon: Icon }) => {
            const selected = active === id
            return (
              <li key={id}>
                <button
                  type="button"
                  ref={id === "catalogue" ? (node) => void (focusRef.current = node) : undefined}
                  aria-current={selected ? "page" : undefined}
                  onClick={() => {
                    if (!selected) haptic()
                    onSelect(id)
                  }}
                  className={cn(
                    "flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95",
                    selected ? "text-emerald-300" : "text-gray-400"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                      selected && "bg-emerald-500/15"
                    )}
                  >
                    <Icon aria-hidden="true" className={cn("h-5 w-5", selected && id === "favorites" && "fill-current")} />
                  </span>
                  {t.app.tabs[id]}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
      {active === "catalogue" && <PullToRefresh />}
      <IconBadge />
    </>
  )
}

// Indicator travel, in px; the finger moves twice as far (resistance 0.5).
const PULL_TRIGGER = 48
const PULL_MAX = 90

/**
 * Pull down at the top of the catalogue to refresh its data. Listeners are
 * passive and the indicator moves with transform only, so scrolling is
 * never blocked.
 */
function PullToRefresh() {
  const { t } = useI18n()
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const start = useRef<number | null>(null)
  const pullRef = useRef(0)

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      start.current = window.scrollY <= 0 && event.touches.length === 1 ? event.touches[0].clientY : null
    }
    const onMove = (event: TouchEvent) => {
      if (start.current === null) return
      const dy = event.touches[0].clientY - start.current
      // Resistance: the further you pull, the slower it follows.
      const next = dy > 0 ? Math.min(PULL_MAX, dy * 0.5) : 0
      pullRef.current = next
      setPull(next)
    }
    const onEnd = async () => {
      if (start.current === null) return
      start.current = null
      const reached = pullRef.current >= PULL_TRIGGER
      pullRef.current = 0
      setPull(0)
      if (!reached) return
      haptic()
      setRefreshing(true)
      try {
        // Every cached list (catalogue, favorites, portfolio…) and the server-rendered page.
        await mutate(() => true)
        router.refresh()
      } finally {
        setTimeout(() => setRefreshing(false), 400)
      }
    }
    window.addEventListener("touchstart", onStart, { passive: true })
    window.addEventListener("touchmove", onMove, { passive: true })
    window.addEventListener("touchend", onEnd, { passive: true })
    window.addEventListener("touchcancel", onEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", onStart)
      window.removeEventListener("touchmove", onMove)
      window.removeEventListener("touchend", onEnd)
      window.removeEventListener("touchcancel", onEnd)
    }
  }, [mutate, router])

  const visible = pull > 4 || refreshing
  const ready = pull >= PULL_TRIGGER
  return (
    <div
      aria-live="polite"
      className={cn(
        "pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-50 flex justify-center transition-opacity",
        visible ? "opacity-100" : "opacity-0"
      )}
      style={{ transform: `translateY(${refreshing ? PULL_TRIGGER / 2 : pull / 2}px)` }}
    >
      <span className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-[#0d1a14] px-4 py-2 text-xs text-emerald-200 shadow-lg">
        {refreshing ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowDown aria-hidden="true" className={cn("h-4 w-4 transition-transform", ready && "rotate-180")} />
        )}
        {refreshing ? t.app.refreshing : ready ? t.app.release : t.app.pull}
      </span>
    </div>
  )
}

/** The number on the app icon: favorites whose deadline is within BADGE_DAYS. */
function IconBadge() {
  const favorites = useFavorites()
  const count = favorites.favorites.filter((f) => {
    const days = f.opportunity?.deadline ? daysUntil(f.opportunity.deadline) : null
    return days !== null && days >= 0 && days <= BADGE_DAYS
  }).length

  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    if (!nav.setAppBadge) return
    if (count > 0) nav.setAppBadge(count).catch(() => {})
    else nav.clearAppBadge?.().catch(() => {})
  }, [count])

  return null
}
