"use client"

import { Calendar, Flame } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { daysUntil, formatDeadline } from "@/lib/deadline"
import { HTML_LANG } from "@/lib/i18n/config"
import { plural } from "@/lib/i18n/format"
import { cn } from "@/lib/utils"

// Deadlines within this many days get an "N days left" chip.
const URGENT_DAYS = 14
// The bar starts filling this many days before a deadline.
const BAR_WINDOW_DAYS = 30

/**
 * How close an open deadline is, as a bar that fills up as it nears: green,
 * amber within URGENT_DAYS, red in the last three days. Decorative: the same
 * information is always in the text next to it.
 */
export function DeadlineBar({ days }: { days: number }) {
  const fill = Math.min(1, Math.max(0.04, 1 - days / BAR_WINDOW_DAYS))
  const color = days <= 3 ? "bg-red-400" : days <= URGENT_DAYS ? "bg-amber-400" : "bg-emerald-400"
  return (
    <span aria-hidden="true" className="block h-1 overflow-hidden rounded-full bg-white/10">
      <span className={cn("block h-full rounded-full", color)} style={{ width: `${Math.round(fill * 100)}%` }} />
    </span>
  )
}

export function DeadlineBadge({ deadline, long = false }: { deadline: string; long?: boolean }) {
  const { locale, t } = useI18n()
  const days = daysUntil(deadline)
  const date = formatDeadline(deadline, long ? "long" : "short", HTML_LANG[locale])
  const closed = days !== null && days < 0
  const urgent = days !== null && days >= 0 && days <= URGENT_DAYS

  return (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
          closed ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-primary/20 bg-primary/10 text-primary"
        )}
      >
        <Calendar aria-hidden="true" className="h-3 w-3" />
        {closed ? `${t.card.closed} · ${date}` : date}
      </span>
      {urgent && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-300">
          <Flame aria-hidden="true" className="h-3 w-3" />
          {days === 0 ? t.card.lastDay : plural(locale, days, t.card.daysLeft)}
        </span>
      )}
    </>
  )
}
