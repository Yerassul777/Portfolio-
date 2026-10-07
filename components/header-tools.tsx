"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Bot, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { onOpenPanel, useAppMode, type PanelName } from "@/lib/app-mode"
import type { PortfolioPanelTab } from "@/components/portfolio-panel"
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

type Open = { panel: PanelName; tab: PortfolioPanelTab } | null

export function HeaderTools() {
  const { t } = useI18n()
  const appMode = useAppMode()
  const [open, setOpen] = useState<Open>(null)
  const [tab, setTab] = useState<PortfolioPanelTab>("favorites")
  // A panel stays mounted after its first opening: it keeps its state (a
  // half-typed message) and can play its closing animation.
  const [mounted, setMounted] = useState<Record<PanelName, boolean>>({ ai: false, portfolio: false })
  const aiRef = useRef<HTMLButtonElement>(null)
  const portfolioRef = useRef<HTMLButtonElement>(null)
  const appFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
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

  const show = useCallback((panel: PanelName, nextTab?: PortfolioPanelTab) => {
    setMounted((current) => (current[panel] ? current : { ...current, [panel]: true }))
    if (nextTab) setTab(nextTab)
    setOpen({ panel, tab: nextTab ?? "favorites" })
  }, [])

  // Hearts, "I'm taking part" and the like open a panel from anywhere.
  useEffect(() => onOpenPanel(({ panel, tab: requested }) => show(panel, requested)), [show])

  const close = () => setOpen(null)
  const variant = appMode ? "screen" : "sheet"

  // The app's tab bar maps onto the same two panels.
  const activeTab: AppTab =
    open?.panel === "ai" ? "ai" : open?.panel === "portfolio" ? (tab === "favorites" ? "favorites" : "portfolio") : "catalogue"
  const selectTab = (next: AppTab) => {
    if (next === "catalogue") close()
    else if (next === "ai") show("ai")
    else if (next === "favorites") show("portfolio", "favorites")
    else show("portfolio", tab === "favorites" ? "achievements" : tab)
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
          onClick={() => show("portfolio", tab)}
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
          returnFocusRef={appMode ? appFocusRef : aiRef}
          variant={variant}
        />
      )}
      {mounted.portfolio && (
        <PortfolioPanel
          open={open?.panel === "portfolio"}
          onOpenChange={(next) => (next ? show("portfolio", tab) : close())}
          returnFocusRef={appMode ? appFocusRef : portfolioRef}
          variant={variant}
          tab={tab}
          onTabChange={setTab}
        />
      )}
      {appMode && <AppShell active={activeTab} onSelect={selectTab} focusRef={appFocusRef} />}
    </>
  )
}
