"use client"

import type { RefObject } from "react"
import { Briefcase, Heart, StickyNote, Trophy, UserRound, type LucideIcon } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { PanelFrame, type PanelVariant } from "@/components/panel-frame"
import type { PortfolioTab } from "@/lib/app-mode"
import { cn } from "@/lib/utils"
import { AccountTab } from "./portfolio/account-tab"
import { AchievementsTab } from "./portfolio/achievements-tab"
import { FavoritesTab } from "./portfolio/favorites-tab"
import { NotesTab } from "./portfolio/notes-tab"

export type PortfolioPanelTab = PortfolioTab | "account"

const TABS: { id: PortfolioPanelTab; icon: LucideIcon }[] = [
  { id: "favorites", icon: Heart },
  { id: "achievements", icon: Trophy },
  { id: "notes", icon: StickyNote },
  { id: "account", icon: UserRound },
]

interface PortfolioPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  variant: PanelVariant
  returnFocusRef: RefObject<HTMLElement | null>
  tab: PortfolioPanelTab
  onTabChange: (tab: PortfolioPanelTab) => void
}

/**
 * The user's own space: favorites (with deadline reminders), what they take
 * part in and have achieved, notes, and the account. One panel behind one
 * header button, so the site keeps its two entry points (plan, rule 0).
 */
export function PortfolioPanel({ open, onOpenChange, variant, returnFocusRef, tab, onTabChange }: PortfolioPanelProps) {
  const { t } = useI18n()

  const tabs = (
    <div role="tablist" aria-label={t.portfolio.title} className="mt-4 grid grid-cols-4 gap-1 rounded-xl bg-[#141a17] p-1">
      {TABS.map(({ id, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`portfolio-tab-${id}`}
          aria-selected={tab === id}
          aria-controls="portfolio-tabpanel"
          onClick={() => onTabChange(id)}
          className={cn(
            "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition-colors sm:flex-row sm:gap-1.5 sm:text-xs",
            tab === id ? "bg-emerald-500/15 text-emerald-300" : "text-gray-400 hover:text-gray-200"
          )}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          {t.portfolio.tabs[id]}
        </button>
      ))}
    </div>
  )

  return (
    <PanelFrame
      open={open}
      onOpenChange={onOpenChange}
      variant={variant}
      returnFocusRef={returnFocusRef}
      icon={Briefcase}
      title={t.portfolio.title}
      description={t.portfolio.subtitle}
      closeLabel={t.portfolio.close}
      headerExtra={tabs}
    >
      <div id="portfolio-tabpanel" role="tabpanel" aria-labelledby={`portfolio-tab-${tab}`}>
        {tab === "favorites" && <FavoritesTab onNavigate={() => onOpenChange(false)} />}
        {tab === "achievements" && <AchievementsTab />}
        {/* Notes stay mounted, so a half-written note survives a tab switch. */}
        <div hidden={tab !== "notes"}>
          <NotesTab active={open && tab === "notes"} />
        </div>
        {tab === "account" && <AccountTab />}
      </div>
    </PanelFrame>
  )
}
