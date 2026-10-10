"use client"

import { useId, useState } from "react"
import { Check, Target, X } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { ENT_MAX, entFit, setEntScore, useEntScore } from "@/lib/ent"
import { format, plural } from "@/lib/i18n/format"
import type { Opportunity } from "@/lib/types"

// Last year's grant pass score of a university, and how the student's ENT
// score (kept on the device, lib/ent.ts) compares with it.

/** On a card: "ENT from 85" and, once the student has a score, whether it is enough. */
export function EntBadge({ opportunity }: { opportunity: Opportunity }) {
  const { locale, t } = useI18n()
  const score = useEntScore()
  const pass = opportunity.pass_score
  if (pass === null || pass === undefined) return null
  const fit = entFit(score, pass)
  return (
    <>
      <span className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs text-muted-foreground">
        <Target aria-hidden="true" className="h-3 w-3" />
        {format(t.ent.from, { n: pass })}
      </span>
      {fit && (
        <span
          className={
            fit.fits
              ? "inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-300"
              : "inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-300"
          }
        >
          {fit.fits ? t.ent.fits : plural(locale, fit.missing, t.ent.missing)}
        </span>
      )}
    </>
  )
}

/** The student's score: a number field that saves as it is typed. */
export function EntScoreField({ className = "" }: { className?: string }) {
  const { t } = useI18n()
  const id = useId()
  const saved = useEntScore()
  // What is typed; null = show the saved score.
  const [typed, setTyped] = useState<string | null>(null)
  const text = typed ?? (saved === null ? "" : String(saved))
  const valid = text === "" || (/^\d{1,3}$/.test(text) && Number(text) <= ENT_MAX)

  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm text-gray-300">
        {t.ent.yourScore}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          placeholder={`0–${ENT_MAX}`}
          value={text}
          aria-invalid={!valid}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            const next = event.target.value.trim()
            setTyped(next)
            // Saved as it is typed; while the text is not a score (empty, "150"),
            // there is none, so no card shows a verdict the field contradicts.
            setEntScore(/^\d{1,3}$/.test(next) && Number(next) <= ENT_MAX ? Number(next) : null)
          }}
          onBlur={() => valid && setTyped(null)}
          className="h-11 w-28 rounded-md border border-gray-700 bg-[#0d1210] px-3 text-base text-white outline-none focus-visible:border-emerald-500/60 aria-[invalid=true]:border-amber-500/60 sm:text-sm"
        />
        {text !== "" && (
          <button
            type="button"
            onClick={() => {
              setTyped(null)
              setEntScore(null)
            }}
            className="inline-flex h-11 items-center gap-1 rounded-md px-3 text-sm text-gray-400 hover:bg-gray-800/60 hover:text-gray-200"
          >
            <X aria-hidden="true" className="h-4 w-4" />
            {t.ent.clear}
          </button>
        )}
      </div>
      <p id={`${id}-hint`} className={`mt-1.5 text-xs ${valid ? "text-gray-500" : "text-amber-300"}`}>
        {valid ? t.ent.deviceOnly : t.ent.invalid}
      </p>
    </div>
  )
}

/** On a university's page: the pass score, the student's score, the verdict. */
export function EntPanel({ opportunity }: { opportunity: Opportunity }) {
  const { locale, t } = useI18n()
  const score = useEntScore()
  const pass = opportunity.pass_score
  const year = opportunity.pass_score_year
  if (pass === null || pass === undefined || !year) return null
  const fit = entFit(score, pass)

  return (
    <section aria-labelledby="details-ent" className="space-y-4 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="details-ent" className="text-sm font-medium text-gray-300">
          {format(t.ent.passScore, { year })}
        </h2>
        <p className="text-2xl font-bold text-white">{format(t.ent.passScoreValue, { n: pass })}</p>
      </div>
      <p className="text-xs leading-relaxed text-gray-400">{t.ent.passScoreHint}</p>
      <EntScoreField />
      {/* Always there, so a screen reader announces the verdict as the score is typed. */}
      <p role="status" className={`flex items-center gap-2 text-sm font-medium empty:hidden ${fit?.fits ? "text-emerald-300" : "text-amber-300"}`}>
        {fit && (fit.fits ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Target aria-hidden="true" className="h-4 w-4 shrink-0" />)}
        {fit && (fit.fits ? t.ent.fitsLong : plural(locale, fit.missing, t.ent.missingLong))}
      </p>
    </section>
  )
}
