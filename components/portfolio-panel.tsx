"use client"

import type { RefObject } from "react"
import { Briefcase, Heart, StickyNote, Trophy, UserRound, type LucideIcon } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { PanelFrame, type PanelVariant } from "@/components/panel-frame"
import { UserAvatar } from "@/components/user-avatar"
import type { PortfolioTab } from "@/lib/app-mode"
import { shownName, useProfile } from "@/lib/profile"
import { cn } from "@/lib/utils"
import { AccountTab } from "./portfolio/account-tab"
import { AchievementsTab } from "./portfolio/achievements-tab"
import { FavoritesTab } from "./portfolio/favorites-tab"
import { NotesTab } from "./portfolio/notes-tab"

/**
 * - "all": the website's panel, every tab (one header button, plan rule 0);
 * - "favorites": the app's Favorites screen, its own tab in the tab bar;
 * - "portfolio": the app's Portfolio screen, everything but Favorites.
 */
export type PortfolioSection = "all" | "favorites" | "portfolio"

const TABS: { id: PortfolioTab; icon: LucideIcon }[] = [
  { id: "favorites", icon: Heart },
  { id: "achievements", icon: Trophy },
  { id: "notes", icon: StickyNote },
  { id: "account", icon: UserRound },
]

interface PortfolioPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Closes the panel without a history step: a link inside it is navigating. */
  onLeave: () => void
  variant: PanelVariant
  returnFocusRef: RefObject<HTMLElement | null>
  section: PortfolioSection
  tab: PortfolioTab
  onTabChange: (tab: PortfolioTab) => void
}

/**
 * The user's own space: favorites (with deadline reminders), what they take
 * part in and have achieved, notes, and the profile.
 */
export function PortfolioPanel({ open, onOpenChange, onLeave, variant, returnFocusRef, section, tab, onTabChange }: PortfolioPanelProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { profile } = useProfile()
  const tabs = TABS.filter(({ id }) => (section === "all" ? true : section === "favorites" ? id === "favorites" : id !== "favorites"))
  const current = section === "favorites" ? "favorites" : tab

  const tabList =
    tabs.length > 1 ? (
      <div
        role="tablist"
        aria-label={t.portfolio.title}
        className={cn("mt-4 grid gap-1 rounded-xl bg-[#141a17] p-1", tabs.length === 4 ? "grid-cols-4" : "grid-cols-3")}
      >
        {tabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`portfolio-tab-${id}`}
            aria-selected={current === id}
            aria-controls="portfolio-tabpanel"
            onClick={() => onTabChange(id)}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium transition-colors sm:flex-row sm:gap-1.5 sm:text-xs",
              current === id ? "bg-emerald-500/15 text-emerald-300" : "text-gray-400 hover:text-gray-200"
            )}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {t.portfolio.tabs[id]}
          </button>
        ))}
      </div>
    ) : null

  // The profile is one tap away from the header, like in any app.
  const profileButton =
    user && section !== "favorites" && current !== "account" ? (
      <button
        type="button"
        onClick={() => onTabChange("account")}
        aria-label={t.portfolio.tabs.account}
        className="flex size-11 items-center justify-center rounded-full transition-transform active:scale-95"
      >
        <UserAvatar name={shownName(profile, user.email)} color={profile?.avatarColor ?? 0} className="h-9 w-9 text-sm" />
      </button>
    ) : null

  const favorites = section === "favorites"
  return (
    <PanelFrame
      open={open}
      onOpenChange={onOpenChange}
      variant={variant}
      returnFocusRef={returnFocusRef}
      icon={favorites ? Heart : Briefcase}
      title={favorites ? t.favorites.screenTitle : t.portfolio.title}
      description={favorites ? t.favorites.screenSubtitle : section === "portfolio" ? t.portfolio.appSubtitle : t.portfolio.subtitle}
      closeLabel={t.portfolio.close}
      headerExtra={tabList}
      headerAction={profileButton}
    >
      <div id="portfolio-tabpanel" role={tabList ? "tabpanel" : undefined} aria-labelledby={tabList ? `portfolio-tab-${current}` : undefined}>
        {current === "favorites" && <FavoritesTab onNavigate={onLeave} />}
        {current === "achievements" && <AchievementsTab />}
        {/* Notes stay mounted, so a half-written note survives a tab switch. */}
        <div hidden={current !== "notes"}>
          <NotesTab active={open && current === "notes"} />
        </div>
        {current === "account" && <AccountTab />}
      </div>
    </PanelFrame>
  )
}
