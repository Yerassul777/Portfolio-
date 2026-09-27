"use client"

import { Calendar, Flame } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { daysUntil, formatDeadline } from "@/lib/deadline"
import { HTML_LANG } from "@/lib/i18n/config"
import { plural } from "@/lib/i18n/format"
import { cn } from "@/lib/utils"

// Deadlines within this many days get an "N days left" chip.
const URGENT_DAYS = 14

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
