"use client"

import { Calendar, GraduationCap, MapPin, Monitor } from "lucide-react"
import { isPlainClick } from "@/components/category-nav"
import { DeadlineBadge } from "@/components/deadline-badge"
import { useI18n } from "@/components/i18n-provider"
import { opportunityPath } from "@/lib/site"
import { getFilterLabel, type Opportunity } from "@/lib/types"

interface OpportunityCardProps {
  opportunity: Opportunity
  onOpen: (opportunity: Opportunity) => void
  /** Cards in the first row load their image right away; the rest lazily. */
  priority?: boolean
}

// The whole card is one link to the opportunity's own page, so it can be
// opened in a new tab, shared or crawled. A plain click opens it in place.
export function OpportunityCard({ opportunity, onOpen, priority = false }: OpportunityCardProps) {
  const { locale, t } = useI18n()
  const { kind, image_url: image } = opportunity
  const city = opportunity.city ? getFilterLabel(kind, "city", opportunity.city) : null
  const mode = opportunity.format ? getFilterLabel(kind, "format", opportunity.format) : null

  return (
    <a
      href={opportunityPath(locale, opportunity.slug)}
      onClick={(event) => {
        if (!isPlainClick(event)) return
        event.preventDefault()
        onOpen(opportunity)
      }}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-emerald-500/10 bg-[#0d1a14]/60 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {image && (
        <div className="relative h-44 shrink-0 overflow-hidden bg-emerald-950/40">
          {/* eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary hosts and data: URLs */}
          <img
            src={image}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
          {opportunity.grant_available && (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-lg">
              <GraduationCap aria-hidden="true" className="h-3 w-3" />
              {t.card.grant}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-balance text-lg font-semibold leading-tight text-foreground transition-colors group-hover:text-emerald-300">
            {opportunity.title}
          </h3>
          {!image && opportunity.grant_available && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <GraduationCap aria-hidden="true" className="h-3 w-3" />
              {t.card.grant}
            </span>
          )}
        </div>

        {(city || mode) && (
          <div className="flex flex-wrap gap-1.5">
            {city && (
              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                <MapPin aria-hidden="true" className="h-3 w-3" />
                {city}
              </span>
            )}
            {mode && (
              <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
                <Monitor aria-hidden="true" className="h-3 w-3" />
                {mode}
              </span>
            )}
          </div>
        )}

        <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">{opportunity.description}</p>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {opportunity.deadline ? (
            <DeadlineBadge deadline={opportunity.deadline} />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground">
              <Calendar aria-hidden="true" className="h-3 w-3" />
              {t.card.noDeadline}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}
