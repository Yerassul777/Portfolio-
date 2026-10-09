"use client"

import type { ElementType, ReactNode } from "react"
import {
  ArrowUpRight,
  BookOpen,
  Building,
  Clipboard,
  Clock,
  GraduationCap,
  MapPin,
  Monitor,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Users,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { DeadlineBadge } from "@/components/deadline-badge"
import { useI18n } from "@/components/i18n-provider"
import { ShareButton } from "@/components/share-button"
import { FavoriteButton } from "@/components/favorite-button"
import { CalendarLink, ParticipateButton } from "@/components/opportunity-actions"
import { formatDeadline } from "@/lib/deadline"
import { HTML_LANG } from "@/lib/i18n/config"
import { format } from "@/lib/i18n/format"
import { opportunityPath } from "@/lib/site"
import { FILTER_CONFIGS, getFilterLabel, type Opportunity } from "@/lib/types"

const ICONS: Record<string, ReactNode> = {
  subject: <BookOpen className="h-4 w-4" />,
  level: <Trophy className="h-4 w-4" />,
  age_group: <Users className="h-4 w-4" />,
  type: <Zap className="h-4 w-4" />,
  format: <Monitor className="h-4 w-4" />,
  duration: <Clock className="h-4 w-4" />,
  city: <MapPin className="h-4 w-4" />,
  field: <GraduationCap className="h-4 w-4" />,
  grant_available: <Building className="h-4 w-4" />,
  requirements: <Clipboard className="h-4 w-4" />,
}

// Only http(s) links are rendered as links; anything else in the column
// (there is one legacy row with free text) is not a destination.
export function isWebUrl(value: string | null | undefined): value is string {
  return !!value && /^https?:\/\//i.test(value)
}

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

interface OpportunityDetailsProps {
  opportunity: Opportunity
  /** The heading element: h1 on the page, DialogTitle inside the dialog. */
  titleAs?: ElementType
  /** Extra actions after "share", e.g. "open as a page" in the dialog. */
  actions?: ReactNode
}

/** Everything about one opportunity. Shared by the dialog and /[locale]/o/[slug]. */
export function OpportunityDetails({ opportunity, titleAs: Title = "h1", actions }: OpportunityDetailsProps) {
  const { locale, t } = useI18n()
  const { kind } = opportunity

  const parameters = FILTER_CONFIGS[kind].flatMap((config) => {
    const raw = opportunity[config.key]
    if (raw === null || raw === undefined || raw === "") return []
    const value = String(raw)
    return [{ key: config.key as string, label: config.label, value: getFilterLabel(kind, config.key as string, value) }]
  })

  return (
    <article className="space-y-6">
      {opportunity.image_url && (
        <div className="overflow-hidden rounded-xl border border-emerald-500/10 bg-emerald-950/40">
          {/* eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary hosts and data: URLs */}
          <img src={opportunity.image_url} alt="" decoding="async" className="aspect-video w-full object-cover" />
        </div>
      )}

      <header className="space-y-3">
        <Title className="text-balance text-2xl font-bold leading-tight text-white sm:text-3xl">{opportunity.title}</Title>
        <div className="flex flex-wrap items-center gap-2">
          {opportunity.deadline ? (
            <DeadlineBadge deadline={opportunity.deadline} long />
          ) : (
            <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">{t.details.noDeadline}</span>
          )}
          {opportunity.grant_available && (
            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
              <GraduationCap aria-hidden="true" className="h-3 w-3" />
              {t.details.grant}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <FavoriteButton opportunity={opportunity} withLabel />
        <ParticipateButton opportunity={opportunity} />
        <CalendarLink opportunity={opportunity} />
      </div>

      <section aria-labelledby="details-about" className="space-y-2">
        <h2 id="details-about" className="text-xs font-medium uppercase tracking-wider text-gray-400">
          {t.details.about}
        </h2>
        <p data-selectable className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-gray-300">
          {opportunity.description || t.details.noDescription}
        </p>
      </section>

      {parameters.length > 0 && (
        <section aria-labelledby="details-parameters" className="space-y-3">
          <h2 id="details-parameters" className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {t.details.parameters}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {parameters.map((p) => (
              <li key={p.key} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-800/40 px-4 py-3">
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  {ICONS[p.key] ?? <SlidersHorizontal className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs uppercase tracking-wider text-gray-400">{p.label}</span>
                  <span className="block truncate text-sm font-medium text-gray-200">{p.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {isWebUrl(opportunity.link) ? (
          <Button
            asChild
            className="h-12 flex-1 gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-base text-white hover:from-emerald-600 hover:to-green-700"
          >
            <a href={opportunity.link} target="_blank" rel="noopener noreferrer">
              {t.details.goToSite}
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </Button>
        ) : (
          <p className="flex-1 self-center text-sm text-gray-400">{t.details.noLink}</p>
        )}
        <ShareButton title={opportunity.title} path={opportunityPath(locale, opportunity.slug)} />
        {actions}
      </div>

      {isWebUrl(opportunity.source_url) && opportunity.reviewed_at ? (
        // Found by the nightly search and checked by a person: say where and when.
        <p className="flex items-start gap-1.5 break-words text-xs text-gray-400">
          <ShieldCheck aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <span>
            {format(t.details.checked, {
              site: hostname(opportunity.source_url) ?? "",
              date: formatDeadline(opportunity.reviewed_at.slice(0, 10), "long", HTML_LANG[locale]),
            })}
          </span>
        </p>
      ) : (
        isWebUrl(opportunity.link) &&
        hostname(opportunity.link) && (
          <p className="break-all text-xs text-gray-400">
            {t.details.source}: {hostname(opportunity.link)}
          </p>
        )
      )}
    </article>
  )
}
