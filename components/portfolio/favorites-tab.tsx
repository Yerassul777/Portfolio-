"use client"

import { Heart } from "lucide-react"
import { DeadlineBadge, DeadlineBar } from "@/components/deadline-badge"
import { FavoriteButton } from "@/components/favorite-button"
import { useI18n } from "@/components/i18n-provider"
import { catalogueHref, currentCatalogueQuery } from "@/lib/catalogue"
import { daysUntil } from "@/lib/deadline"
import { useFavorites, type Favorite } from "@/lib/favorites"
import { opportunityPath } from "@/lib/site"
import { AccountOnly, EmptyState, LoadError, Spinner } from "./common"
import { RemindersCard } from "./reminders-card"

/** Soonest open deadline first, then the rest, newest saved first. */
function bySoonest(a: Favorite, b: Favorite) {
  const da = a.opportunity?.deadline ? daysUntil(a.opportunity.deadline) : null
  const db = b.opportunity?.deadline ? daysUntil(b.opportunity.deadline) : null
  const ka = da !== null && da >= 0 ? da : Number.POSITIVE_INFINITY
  const kb = db !== null && db >= 0 ? db : Number.POSITIVE_INFINITY
  return ka - kb || b.createdAt.localeCompare(a.createdAt)
}

export function FavoritesTab({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useI18n()
  return (
    <AccountOnly title={t.favorites.signInTitle} text={t.favorites.signInText}>
      <FavoritesList onNavigate={onNavigate} />
    </AccountOnly>
  )
}

function FavoritesList({ onNavigate }: { onNavigate: () => void }) {
  const { locale, t } = useI18n()
  const favorites = useFavorites()

  if (!favorites.ready) return <Spinner />
  if (favorites.loadFailed) return <LoadError text={t.favorites.loadError} onRetry={favorites.retry} />

  const items = [...favorites.favorites].sort(bySoonest)

  return (
    <div className="space-y-4 p-4">
      <RemindersCard />
      {items.length === 0 ? (
        <EmptyState icon={Heart} title={t.favorites.emptyTitle} text={t.favorites.emptyText} />
      ) : (
        <ul className="space-y-3">
          {items.map((favorite) => {
            const item = favorite.opportunity
            if (!item) {
              return (
                <li key={favorite.opportunityId} className="rounded-xl border border-gray-800 bg-[#141a17] p-4 text-sm text-gray-400">
                  {t.favorites.unavailable}
                </li>
              )
            }
            const days = item.deadline ? daysUntil(item.deadline) : null
            return (
              <li key={item.id} className="relative flex items-start gap-3 rounded-xl border border-gray-800 bg-[#141a17] p-4 transition-colors hover:border-gray-700">
                <div className="min-w-0 flex-1 space-y-2">
                  <span className="text-xs text-emerald-300/80">{t.categories[item.kind].label}</span>
                  <a
                    href={opportunityPath(locale, item.slug)}
                    onClick={(event) => {
                      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                      // Only pages with the catalogue can open its dialog; elsewhere the link navigates.
                      if (!document.getElementById("catalogue")) return
                      event.preventDefault()
                      // Opens the catalogue's dialog in place (the ?o= URL).
                      window.history.pushState(null, "", catalogueHref(locale, { ...currentCatalogueQuery(), open: item.slug }))
                      onNavigate()
                    }}
                    className="block font-medium leading-snug text-white outline-none after:absolute after:inset-0 after:content-[''] hover:text-emerald-300 focus-visible:underline"
                  >
                    {item.title}
                  </a>
                  <div className="flex flex-wrap items-center gap-2">
                    {item.deadline ? <DeadlineBadge deadline={item.deadline} /> : <span className="text-xs text-gray-400">{t.card.noDeadline}</span>}
                  </div>
                  {days !== null && days >= 0 && <DeadlineBar days={days} />}
                </div>
                <FavoriteButton opportunity={item} className="relative z-10 border-0 bg-transparent" />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
