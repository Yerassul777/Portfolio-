"use client"

import { useState } from "react"
import { CalendarPlus, Check, Loader2, Trophy } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { haptic, openPanel } from "@/lib/app-mode"
import { isDeadlinePassed } from "@/lib/deadline"
import { usePortfolio } from "@/lib/portfolio"
import type { Opportunity } from "@/lib/types"
import { cn } from "@/lib/utils"

const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium transition-[transform,background-color] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"

/**
 * "I'm taking part": a portfolio entry filled in from the catalogue. After the
 * deadline the Achievements tab asks how it went.
 */
export function ParticipateButton({ opportunity }: { opportunity: Opportunity }) {
  const { t } = useI18n()
  const portfolio = usePortfolio(true)
  const [busy, setBusy] = useState(false)
  const entry = portfolio.entryFor(opportunity.id)

  if (entry) {
    return (
      <button
        type="button"
        onClick={() => openPanel({ panel: "portfolio", tab: "achievements" })}
        className={cn(actionClass, "border-emerald-400/30 bg-emerald-500/15 text-emerald-300")}
        title={t.portfolio.participatingHint}
      >
        <Check aria-hidden="true" className="h-4 w-4" />
        {t.portfolio.participating}
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={busy || (portfolio.signedIn && !portfolio.ready)}
      onClick={async () => {
        if (!portfolio.signedIn) {
          openPanel({ panel: "portfolio", tab: "achievements" })
          return
        }
        haptic()
        setBusy(true)
        try {
          await portfolio.participate(opportunity)
        } catch {
          // Already there (another device) or offline: a refresh shows the truth.
          portfolio.retry()
        } finally {
          setBusy(false)
        }
      }}
      className={cn(actionClass, "border-emerald-500/20 bg-emerald-500/5 text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60")}
    >
      {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Trophy aria-hidden="true" className="h-4 w-4" />}
      {t.portfolio.participate}
    </button>
  )
}

/** An .ics file with the deadline and two alerts; opens the calendar app on phones. */
export function CalendarLink({ opportunity }: { opportunity: Opportunity }) {
  const { t } = useI18n()
  if (!opportunity.deadline || isDeadlinePassed(opportunity.deadline)) return null
  return (
    <a
      href={`/api/ics/${encodeURIComponent(opportunity.slug)}`}
      className={cn(actionClass, "border-gray-700 text-gray-300 hover:bg-gray-800")}
    >
      <CalendarPlus aria-hidden="true" className="h-4 w-4" />
      {t.reminders.calendar}
    </a>
  )
}
