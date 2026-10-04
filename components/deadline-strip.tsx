"use client"

import { CalendarClock } from "lucide-react"
import { isPlainClick } from "@/components/category-nav"
import { DeadlineBar } from "@/components/deadline-badge"
import { useI18n } from "@/components/i18n-provider"
import { catalogueHref, currentCatalogueQuery } from "@/lib/catalogue"
import { daysUntil, formatDeadline } from "@/lib/deadline"
import { HTML_LANG } from "@/lib/i18n/config"
import { plural } from "@/lib/i18n/format"
import { opportunityPath } from "@/lib/site"
import type { Opportunity } from "@/lib/types"
import { cn } from "@/lib/utils"

// Same threshold as the "N days left" chip on cards.
const URGENT_DAYS = 14

/**
 * The nearest deadlines across every category, on the home page's first
 * screen. Each one is a link to its own page; a plain click opens it in the
 * catalogue's dialog instead (the ?o= URL), so Back closes it.
 */
export function DeadlineStrip({ items }: { items: Opportunity[] }) {
  const { locale, t } = useI18n()
  if (items.length === 0) return null

  return (
    <section aria-labelledby="soon-heading" className="mx-auto w-full max-w-5xl space-y-3 text-left">
      <h2 id="soon-heading" className="flex items-center justify-center gap-2 text-sm font-medium uppercase tracking-wider text-emerald-300/90">
        <CalendarClock aria-hidden="true" className="h-4 w-4" />
        {t.hero.soonTitle}
      </h2>
      <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        {items.map((item) => {
          const days = item.deadline ? daysUntil(item.deadline) : null
          return (
            <li key={item.id} className="sm:w-[calc((100%-1.5rem)/3)]">
              <a
                href={opportunityPath(locale, item.slug)}
                onClick={(event) => {
                  if (!isPlainClick(event)) return
                  event.preventDefault()
                  window.history.pushState(null, "", catalogueHref(locale, { ...currentCatalogueQuery(), open: item.slug }))
                }}
                className="flex h-full flex-col gap-2 rounded-xl border border-emerald-500/15 bg-[#0d1a14]/70 p-4 transition-[transform,border-color] duration-200 hover:border-emerald-500/35 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <span className="text-xs text-emerald-300/80">{t.categories[item.kind].label}</span>
                <span className="line-clamp-2 font-semibold leading-snug text-white">{item.title}</span>
                {item.deadline && days !== null && (
                  <span className="mt-auto space-y-2 pt-1">
                    <span className="flex items-baseline justify-between gap-2 text-xs">
                      <span className={cn("font-medium", days <= URGENT_DAYS ? "text-amber-300" : "text-emerald-300")}>
                        {days === 0 ? t.card.lastDay : plural(locale, days, t.card.daysLeft)}
                      </span>
                      <span className="text-gray-400">{formatDeadline(item.deadline, "short", HTML_LANG[locale])}</span>
                    </span>
                    <DeadlineBar days={days} />
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
