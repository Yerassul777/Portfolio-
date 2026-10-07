"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { useConsents, type AgeBracket } from "@/lib/consent"
import { cn } from "@/lib/utils"

export type ConsentValue = { ageBracket: AgeBracket | null; parentOk: boolean; agreed: boolean }

export const EMPTY_CONSENT: ConsentValue = { ageBracket: null, parentOk: false, agreed: false }

export function consentComplete(value: ConsentValue): value is ConsentValue & { ageBracket: AgeBracket } {
  return value.agreed && value.ageBracket !== null && (value.ageBracket === "18plus" || value.parentOk)
}

const AGES: AgeBracket[] = ["18plus", "13to17", "under13"]

/** Age, a parent's agreement under 18, and the policy checkbox. */
export function ConsentFields({ value, onChange }: { value: ConsentValue; onChange: (value: ConsentValue) => void }) {
  const { locale, t } = useI18n()
  const [before, after] = t.consent.agree.split("{policy}")
  return (
    <div className="space-y-3 text-left">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-foreground">{t.consent.ageLabel}</legend>
        <div className="grid grid-cols-3 gap-2" role="radiogroup">
          {AGES.map((age) => (
            <button
              key={age}
              type="button"
              role="radio"
              aria-checked={value.ageBracket === age}
              onClick={() => onChange({ ...value, ageBracket: age, parentOk: age === "18plus" ? false : value.parentOk })}
              className={cn(
                "min-h-11 rounded-xl border-2 px-2 text-sm font-medium transition-colors",
                value.ageBracket === age
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50"
              )}
            >
              {t.consent.ages[age]}
            </button>
          ))}
        </div>
      </fieldset>
      {value.ageBracket && value.ageBracket !== "18plus" && (
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={value.parentOk}
            onChange={(e) => onChange({ ...value, parentOk: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
          />
          {t.consent.parent}
        </label>
      )}
      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={value.agreed}
          onChange={(e) => onChange({ ...value, agreed: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
        />
        <span>
          {before}
          <a href={`/${locale}/privacy`} target="_blank" rel="noopener" className="text-primary underline underline-offset-2">
            {t.consent.policy}
          </a>
          {after}
        </span>
      </label>
    </div>
  )
}

/**
 * Wraps what a signed-in user may only use after agreeing to the current
 * policy. Users who agreed in the sign-in form pass straight through (the
 * form's answer is recorded here, once the session exists); everyone else,
 * including accounts made before consent existed, answers once.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { consents, ready, record, recordPending } = useConsents()
  const [value, setValue] = useState<ConsentValue>(EMPTY_CONSENT)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const triedPending = useRef(false)

  useEffect(() => {
    if (!user || !ready || consents.terms || triedPending.current) return
    triedPending.current = true
    setBusy(true)
    recordPending()
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }, [user, ready, consents.terms, recordPending])

  if (!user) return <>{children}</>
  if (!ready || (busy && !consents.terms)) {
    return (
      <div role="status" className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    )
  }
  if (consents.terms) return <>{children}</>

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        if (!consentComplete(value)) return
        setBusy(true)
        setFailed(false)
        try {
          await record("terms", true, { ageBracket: value.ageBracket, parentOk: value.parentOk })
        } catch {
          setFailed(true)
        } finally {
          setBusy(false)
        }
      }}
      className="mx-auto max-w-sm space-y-4 px-6 py-8"
    >
      <div className="space-y-2 text-center">
        <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
        </span>
        <h3 className="text-lg font-semibold text-foreground">{t.consent.title}</h3>
        <p className="text-sm text-muted-foreground">{t.consent.text}</p>
      </div>
      <ConsentFields value={value} onChange={setValue} />
      {failed && (
        <p role="alert" className="text-sm text-red-300">
          {t.consent.saveFailed}
        </p>
      )}
      <Button type="submit" disabled={!consentComplete(value) || busy} className="h-11 w-full rounded-xl">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.consent.continue}
      </Button>
    </form>
  )
}
