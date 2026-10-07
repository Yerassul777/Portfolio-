"use client"

import { Heart } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { haptic, openPanel } from "@/lib/app-mode"
import { useFavorites } from "@/lib/favorites"
import type { Opportunity } from "@/lib/types"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  opportunity: Opportunity
  /** "overlay": on a card's image; "plain": in a list or the detail view. */
  look?: "overlay" | "plain"
  withLabel?: boolean
  className?: string
}

/**
 * The heart. Signed in it saves to the account (and the deadline reminders
 * follow the favorites); signed out it opens the Favorites tab, which asks to
 * sign in — saving needs an account.
 */
export function FavoriteButton({ opportunity, look = "plain", withLabel = false, className }: FavoriteButtonProps) {
  const { t } = useI18n()
  const favorites = useFavorites()
  const active = favorites.isFavorite(opportunity.id)
  const label = active ? t.favorites.remove : t.favorites.add

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={withLabel ? undefined : label}
      title={withLabel ? undefined : label}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!favorites.signedIn) {
          openPanel({ panel: "portfolio", tab: "favorites" })
          return
        }
        haptic()
        favorites.toggle(opportunity).catch(() => {})
      }}
      className={cn(
        "group/heart relative z-10 inline-flex shrink-0 items-center justify-center gap-2 transition-[transform,background-color,color] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        look === "overlay"
          ? "size-11 rounded-full bg-black/45 text-white hover:bg-black/60"
          : "min-h-11 min-w-11 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 text-emerald-300 hover:bg-emerald-500/15",
        active && look === "plain" && "border-rose-400/30 bg-rose-500/10 text-rose-300",
        className
      )}
    >
      <Heart
        aria-hidden="true"
        className={cn(
          "h-5 w-5 transition-transform duration-200",
          active && "fill-rose-500 text-rose-500 motion-safe:animate-[heart-pop_320ms_ease-out]"
        )}
      />
      {withLabel && <span className="text-sm font-medium">{label}</span>}
    </button>
  )
}
