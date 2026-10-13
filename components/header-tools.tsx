"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import dynamic from "next/dynamic"
import { Bot, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { onOpenPanel, useAppMode, type PanelName, type PortfolioTab } from "@/lib/app-mode"
import type { PortfolioSection } from "@/components/portfolio-panel"
import type { AppTab } from "@/components/app-shell"

// The panels (chat, portfolio, sign-in, their data layers) are a large part
// of the site's JavaScript and nothing on first paint needs them. The header
// renders only the buttons; each panel's code is fetched when the browser is
// idle, or as soon as a finger or pointer reaches its button. The app shell
// (tab bar, pull-to-refresh) loads only in the installed app.
const loadAI = () => import("@/components/ai-assistant")
const loadPortfolio = () => import("@/components/portfolio-panel")
const AIAssistantPanel = dynamic(() => loadAI().then((m) => m.AIAssistantPanel), { ssr: false })
const PortfolioPanel = dynamic(() => loadPortfolio().then((m) => m.PortfolioPanel), { ssr: false })
const AppShell = dynamic(() => import("@/components/app-shell").then((m) => m.AppShell), { ssr: false })

type Open = { panel: PanelName; section: PortfolioSection; tab: PortfolioTab }

// An open panel is a history entry, like a screen in an app: Back (the
// Android button, a mouse's side button, a swipe) closes it instead of
// leaving the page. The entry carries what was open, so going forward again
// reopens it.
const HISTORY_KEY = "portfolioScreen"

function openFromHistory(): Open | null {
  const value = (window.history.state as Record<string, unknown> | null)?.[HISTORY_KEY] as Open | undefined
  return value && (value.panel === "ai" || value.panel === "portfolio") ? value : null
}

function withScreen(open: Open | null) {
  const state = { ...((window.history.state as Record<string, unknown> | null) ?? {}) }
  if (open) state[HISTORY_KEY] = open
  else delete state[HISTORY_KEY]
  return state
}

// Behind the app's launch screen (lib/launch-screen.ts) every screen is
// rendered once — its code and its first render — so the first tap on a tab
// is as quick as the ones after it. None of it is seen. Their data starts
// loading then and goes on after the screen closes (SWR keeps it): the launch
// screen does not wait for the network.
const PREWARM_SCREENS: Open[] = [
  { panel: "portfolio", section: "favorites", tab: "favorites" },
  { panel: "portfolio", section: "portfolio", tab: "achievements" },
  { panel: "ai", section: "all", tab: "favorites" },
]
/** The longest wait for one screen to render. */
const PREWARM_SCREEN_MS = 400

const noop = () => {}
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/** The open screen has been rendered and painted (two frames on screen); or `max` ms. */
async function screenRendered(max: number) {
  const end = performance.now() + max
  let frames = 0
  while (frames < 2 && performance.now() < end) {
    await nextFrame()
    if (document.querySelector('[role="dialog"][data-state="open"]')) frames++
  }
}

export function HeaderTools() {
  const { t } = useI18n()
  const appMode = useAppMode()
  const [open, setOpenState] = useState<Open | null>(null)
  const openRef = useRef<Open | null>(null)
  const setOpen = (next: Open | null) => {
    openRef.current = next
    setOpenState(next)
  }
  // The Portfolio tab the user was last on, to come back to it. ("favorites"
  // only on the website; the app maps it to its first Portfolio tab.)
  const [portfolioTab, setPortfolioTab] = useState<PortfolioTab>("favorites")
  // A panel stays mounted after its first opening: it keeps its state (a
  // half-typed message) and can play its closing animation.
  const [mounted, setMounted] = useState<Record<PanelName, boolean>>({ ai: false, portfolio: false })
  const aiRef = useRef<HTMLButtonElement>(null)
  const portfolioRef = useRef<HTMLButtonElement>(null)
  const appFocusRef = useRef<HTMLElement | null>(null)
  // True while the launch screen renders the screens behind it (prewarm).
  const prewarming = useRef(false)
  // A closed screen gives focus back to the tab bar — but not the ones the
  // warm-up closes: iOS would ring the Catalogue tab in blue for no reason.
  const appReturnFocus = useMemo(
    () => ({ get current() { return prewarming.current ? null : appFocusRef.current } }) as RefObject<HTMLElement | null>,
    []
  )

  useEffect(() => {
    // The app's launch screen warms everything up itself (prewarm below).
    if (document.documentElement.dataset.splash === "1") return
    const warm = () => {
      loadAI().catch(() => {})
      loadPortfolio().catch(() => {})
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(warm, 3000)
    return () => window.clearTimeout(id)
  }, [])

  const show = useCallback(
    (panel: PanelName, requested?: PortfolioTab) => {
      // In the app, Favorites is a screen of its own; on the website it is a
      // tab of the Portfolio panel (two header buttons, plan rule 0).
      let next: Open
      if (panel === "ai") next = { panel, section: "all", tab: "favorites" }
      else if (!appMode) next = { panel, section: "all", tab: requested ?? portfolioTab }
      else if (requested === "favorites") next = { panel, section: "favorites", tab: "favorites" }
      else next = { panel, section: "portfolio", tab: requested ?? (portfolioTab === "favorites" ? "achievements" : portfolioTab) }
      if (panel === "portfolio" && next.section !== "favorites") setPortfolioTab(next.tab)
      setMounted((current) => (current[panel] ? current : { ...current, [panel]: true }))
      // Switching between screens replaces the entry; opening the first one adds it.
      if (openRef.current) window.history.replaceState(withScreen(next), "")
      else window.history.pushState(withScreen(next), "")
      setOpen(next)
    },
    [appMode, portfolioTab]
  )

  const prewarm = useCallback(async (signal: AbortSignal) => {
    const aborted = new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }))
    const until = (task: Promise<unknown>) => Promise.race([task.then(noop, noop), aborted])
    await until(Promise.all([loadAI(), loadPortfolio()]))
    prewarming.current = true
    setMounted({ ai: true, portfolio: true })
    // Straight to the state, not through show(): no history entries.
    for (const screen of PREWARM_SCREENS) {
      if (signal.aborted) break
      openRef.current = screen
      setOpenState(screen)
      await until(screenRendered(PREWARM_SCREEN_MS))
    }
    openRef.current = null
    setOpenState(null)
    await nextFrame()
    await nextFrame()
    // Radix hands focus back a tick after a screen unmounts.
    await new Promise((resolve) => window.setTimeout(resolve, 50))
    prewarming.current = false
  }, [])

  /** Back to the page: the same as pressing Back. */
  const close = useCallback(() => {
    if (openFromHistory()) window.history.back()
    else setOpen(null)
  }, [])
  /** The panel is leaving for a page or a dialog that adds its own history entry. */
  const leave = useCallback(() => setOpen(null), [])

  useEffect(() => {
    // A reload keeps history.state, but nothing is open after one.
    if (openFromHistory()) window.history.replaceState(withScreen(null), "")
    const onPopState = () => {
      const next = openFromHistory()
      if (next) {
        setMounted((current) => (current[next.panel] ? current : { ...current, [next.panel]: true }))
        if (next.panel === "portfolio" && next.section !== "favorites") setPortfolioTab(next.tab)
      }
      setOpen(next)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Hearts, "I'm taking part" and the like open a panel from anywhere.
  useEffect(() => onOpenPanel(({ panel, tab: requested }) => show(panel, requested)), [show])

  // In the app a screen covers the catalogue; the page under it must not
  // scroll (the wheel and the scrollbar belong to the screen). Not for the
  // warm-up's screens: switching the root's overflow makes iOS rebuild the
  // whole window, a visible flicker under the launch screen.
  useEffect(() => {
    if (!appMode || prewarming.current) return
    const root = document.documentElement
    if (open) root.dataset.screen = "1"
    else delete root.dataset.screen
  }, [appMode, open])

  const variant = appMode ? "screen" : "sheet"

  // The app's tab bar maps onto the same two panels.
  const activeTab: AppTab =
    open?.panel === "ai" ? "ai" : open?.panel === "portfolio" ? (open.section === "favorites" ? "favorites" : "portfolio") : "catalogue"
  const selectTab = (next: AppTab) => {
    if (next === "catalogue") close()
    else if (next === "ai") show("ai")
    else if (next === "favorites") show("portfolio", "favorites")
    else show("portfolio", portfolioTab === "favorites" ? "achievements" : portfolioTab)
  }

  return (
    <>
      <div className="flex items-center gap-2 app:hidden">
        <Button
          ref={aiRef}
          variant="outline"
          aria-label={t.ai.open}
          aria-haspopup="dialog"
          aria-expanded={open?.panel === "ai"}
          onPointerDown={() => void loadAI().catch(() => {})}
          onClick={() => show("ai")}
          className="group relative size-11 gap-2 overflow-hidden rounded-full border-emerald-600 bg-gradient-to-r from-emerald-500/10 to-green-600/10 p-0 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-300 sm:h-9 sm:w-auto sm:px-3"
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 transition-transform duration-1000 group-hover:translate-x-[100%]"
          />
          <Bot className="relative z-10 h-4 w-4" />
          <span className="relative z-10 hidden sm:inline">{t.ai.open}</span>
        </Button>
        <Button
          ref={portfolioRef}
          variant="outline"
          aria-label={t.portfolio.open}
          aria-haspopup="dialog"
          aria-expanded={open?.panel === "portfolio"}
          onPointerDown={() => void loadPortfolio().catch(() => {})}
          onClick={() => show("portfolio")}
          className="size-11 gap-2 rounded-full border-gray-700 bg-transparent p-0 text-gray-300 hover:border-emerald-500/50 hover:bg-gray-800/50 hover:text-white sm:h-9 sm:w-auto sm:px-3"
        >
          <Briefcase className="h-4 w-4" />
          <span className="hidden sm:inline">{t.portfolio.open}</span>
        </Button>
      </div>

      {mounted.ai && (
        <AIAssistantPanel
          open={open?.panel === "ai"}
          onOpenChange={(next) => (next ? show("ai") : close())}
          onLeave={leave}
          returnFocusRef={appMode ? appReturnFocus : aiRef}
          variant={variant}
        />
      )}
      {mounted.portfolio && (
        <PortfolioPanel
          open={open?.panel === "portfolio"}
          onOpenChange={(next) => (next ? show("portfolio") : close())}
          onLeave={leave}
          returnFocusRef={appMode ? appReturnFocus : portfolioRef}
          variant={variant}
          section={open?.panel === "portfolio" ? open.section : appMode ? "portfolio" : "all"}
          tab={open?.panel === "portfolio" ? open.tab : portfolioTab}
          onTabChange={(next) => show("portfolio", next)}
        />
      )}
      {appMode && <AppShell active={activeTab} onSelect={selectTab} focusRef={appFocusRef} prewarm={prewarm} />}
    </>
  )
}
