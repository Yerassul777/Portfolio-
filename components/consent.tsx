"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { FileText, Loader2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { useConsents } from "@/lib/consent"
import { ageOn, todayInKazakhstan, useProfile } from "@/lib/profile"

// The policy text is long and only needed when someone opens it.
const PolicyText = dynamic(() => import("@/components/privacy-policy").then((m) => m.PrivacyPolicyBody), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
    </div>
  ),
})

export type ConsentValue = { day: string; month: string; year: string; parentOk: boolean; agreed: boolean }

export const EMPTY_CONSENT: ConsentValue = { day: "", month: "", year: "", parentOk: false, agreed: false }

/** YYYY-MM-DD if the three selects make a real date in the past, else null. */
export function birthDateOf(value: Pick<ConsentValue, "day" | "month" | "year">): string | null {
  const y = Number(value.year)
  const m = Number(value.month)
  const d = Number(value.day)
  if (!y || !m || !d) return null
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCMonth() !== m - 1) return null // 31 February
  const iso = date.toISOString().slice(0, 10)
  return iso <= todayInKazakhstan() ? iso : null
}

/** Ages that make sense for a user; anything else is a slip of the finger. */
const MIN_AGE = 5
const MAX_AGE = 100

export function consentState(value: ConsentValue, knownBirthDate: string | null = null) {
  const birthDate = knownBirthDate ?? birthDateOf(value)
  const age = birthDate ? ageOn(birthDate, todayInKazakhstan()) : null
  const plausible = age !== null && age >= MIN_AGE && age <= MAX_AGE
  const minor = plausible && age < 18
  const complete = plausible && value.agreed && (!minor || value.parentOk)
  return { birthDate, age, plausible, minor, complete }
}

const selectClass =
  "h-11 min-w-0 rounded-xl border-2 border-border bg-card px-2 text-base text-foreground outline-none transition-colors focus-visible:border-primary/60 sm:text-sm"

/**
 * Date of birth, a parent's agreement under 18, and the policy — readable
 * right here, before agreeing. With `knownBirthDate` (already in the
 * profile) the date is not asked again.
 */
export function ConsentFields({
  value,
  onChange,
  knownBirthDate = null,
}: {
  value: ConsentValue
  onChange: (value: ConsentValue) => void
  knownBirthDate?: string | null
}) {
  const { t } = useI18n()
  const [policyOpen, setPolicyOpen] = useState(false)
  const state = consentState(value, knownBirthDate)
  const thisYear = Number(todayInKazakhstan().slice(0, 4))
  const years = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => String(thisYear - MIN_AGE - i))
  const set = (patch: Partial<ConsentValue>) => onChange({ ...value, ...patch })
  const dateChosen = value.day && value.month && value.year

  return (
    <div className="space-y-3 text-left">
      {!knownBirthDate && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-foreground">{t.consent.birthLabel}</legend>
          <div className="grid grid-cols-[5.25rem_1fr_6rem] gap-2">
            <select aria-label={t.consent.day} value={value.day} onChange={(e) => set({ day: e.target.value })} className={selectClass}>
              <option value="">{t.consent.day}</option>
              {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select aria-label={t.consent.month} value={value.month} onChange={(e) => set({ month: e.target.value })} className={selectClass}>
              <option value="">{t.consent.month}</option>
              {t.consent.months.map((name, i) => (
                <option key={name} value={String(i + 1)}>
                  {name}
                </option>
              ))}
            </select>
            <select aria-label={t.consent.year} value={value.year} onChange={(e) => set({ year: e.target.value })} className={selectClass}>
              <option value="">{t.consent.year}</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {dateChosen && !state.plausible && (
            <p role="alert" className="text-xs text-amber-300">
              {t.consent.badDate}
            </p>
          )}
        </fieldset>
      )}
      {state.minor && (
        <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={value.parentOk}
            onChange={(e) => set({ parentOk: e.target.checked })}
            className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
          />
          {t.consent.parent}
        </label>
      )}
      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={value.agreed}
          onChange={(e) => set({ agreed: e.target.checked })}
          className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-500"
        />
        <span>{t.consent.agree}</span>
      </label>
      <button
        type="button"
        onClick={() => setPolicyOpen(true)}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/10"
      >
        <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
        {t.consent.readPolicy}
      </button>
      <PolicyDialog
        open={policyOpen}
        onOpenChange={setPolicyOpen}
        onAccept={() => {
          set({ agreed: true })
          setPolicyOpen(false)
        }}
      />
    </div>
  )
}

/** The privacy policy in a window over the current screen; `onAccept` adds an "I agree" button. */
export function PolicyDialog({ open, onOpenChange, onAccept }: { open: boolean; onOpenChange: (open: boolean) => void; onAccept?: () => void }) {
  const { t } = useI18n()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85svh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden border-gray-800 bg-[#0d1210] p-0">
        <DialogHeader className="shrink-0 border-b border-gray-800 px-5 py-4 text-left">
          <DialogTitle className="pr-8 text-white">{t.consent.policy}</DialogTitle>
          <DialogDescription className="text-xs text-gray-400">{t.consent.policyHint}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{open && <PolicyText />}</div>
        {onAccept && (
          <div className="shrink-0 border-t border-gray-800 p-3">
            <Button className="h-11 w-full rounded-xl" onClick={onAccept}>
              {t.consent.acceptPolicy}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Wraps what a signed-in user may only use after registering: date of birth
 * and agreement to the current policy. Users who answered in the sign-in form
 * pass straight through (the form's answer is recorded here, once the session
 * exists); everyone else — accounts from before, or after a policy change —
 * answers once.
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const { consents, ready, register, recordPending } = useConsents()
  const { profile, ready: profileReady } = useProfile()
  const [value, setValue] = useState<ConsentValue>(EMPTY_CONSENT)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const triedPending = useRef(false)
  const knownBirthDate = profile?.birthDate ?? null
  const state = consentState(value, knownBirthDate)

  useEffect(() => {
    if (!user || !ready || consents.terms || triedPending.current) return
    triedPending.current = true
    setBusy(true)
    recordPending()
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }, [user, ready, consents.terms, recordPending])

  if (!user) return <>{children}</>
  if (!ready || !profileReady || (busy && !consents.terms)) {
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
        if (!state.complete || !state.birthDate) return
        setBusy(true)
        setFailed(false)
        try {
          await register({ birthDate: state.birthDate, parentOk: value.parentOk })
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
        <h3 className="text-lg font-semibold text-foreground">{knownBirthDate ? t.consent.updatedTitle : t.consent.title}</h3>
        <p className="text-sm text-muted-foreground">{knownBirthDate ? t.consent.updatedText : t.consent.text}</p>
      </div>
      <ConsentFields value={value} onChange={setValue} knownBirthDate={knownBirthDate} />
      {failed && (
        <p role="alert" className="text-sm text-red-300">
          {t.consent.saveFailed}
        </p>
      )}
      <Button type="submit" disabled={!state.complete || busy} className="h-11 w-full rounded-xl">
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {t.consent.continue}
      </Button>
    </form>
  )
}
