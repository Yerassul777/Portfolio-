"use client"

import { useEffect, useState } from "react"
import { Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { loadSupabase } from "@/lib/supabase-browser"
import { useI18n } from "@/components/i18n-provider"
import type { Dictionary } from "@/lib/i18n"
import { format } from "@/lib/i18n/format"

const RESEND_COOLDOWN_SECONDS = 60

// Checks the project's public Auth settings, so the Google button only appears
// once the provider is actually configured — never a button that fails.
async function isGoogleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    })
    if (!res.ok) return false
    const settings = await res.json()
    return settings?.external?.google === true
  } catch {
    return false
  }
}

function describeAuthError(message: string, t: Dictionary): string {
  if (/rate limit|too many|security purposes/i.test(message)) return t.auth.errors.rateLimit
  if (/expired|invalid/i.test(message)) return t.auth.errors.invalidCode
  if (/signups not allowed/i.test(message)) return t.auth.errors.signupsClosed
  return t.auth.errors.generic
}

interface AuthFormProps {
  title: string
  description?: string
}

export function AuthForm({ title, description }: AuthFormProps) {
  const { t } = useI18n()
  const [step, setStep] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    isGoogleEnabled().then(setGoogleEnabled)
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const sendCode = async () => {
    const address = email.trim()
    if (!address) return
    setBusy(true)
    setError(null)
    const { error } = await (await loadSupabase()).auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    })
    setBusy(false)
    if (error) {
      setError(describeAuthError(error.message, t))
      return
    }
    setStep("code")
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const verifyCode = async () => {
    const token = code.replace(/\s/g, "")
    if (!token) return
    setBusy(true)
    setError(null)
    const { error } = await (await loadSupabase()).auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    })
    setBusy(false)
    if (error) setError(describeAuthError(error.message, t))
    // On success AuthProvider receives the new session and the parent re-renders.
  }

  const signInWithGoogle = async () => {
    setBusy(true)
    setError(null)
    const { error } = await (await loadSupabase()).auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    })
    if (error) {
      setBusy(false)
      setError(describeAuthError(error.message, t))
    }
  }

  const inputClass =
    "h-11 w-full rounded-xl border-2 border-border bg-card px-4 text-base sm:text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60"

  return (
    <div className="mx-auto w-full max-w-sm space-y-5">
      <div className="space-y-1.5 text-center">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>

      {step === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            sendCode()
          }}
          className="space-y-3"
        >
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label={t.auth.emailLabel}
            className={inputClass}
          />
          <Button type="submit" disabled={busy || !email.trim()} className="h-11 w-full rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {t.auth.getCode}
          </Button>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            verifyCode()
          }}
          className="space-y-3"
        >
          <p className="text-center text-sm text-muted-foreground">{format(t.auth.sentTo, { email: email.trim() })}</p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t.auth.codePlaceholder}
            aria-label={t.auth.codePlaceholder}
            className={`${inputClass} text-center text-lg tracking-[0.3em]`}
          />
          <Button type="submit" disabled={busy || !code.trim()} className="h-11 w-full rounded-xl">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.auth.signIn}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email")
                setCode("")
                setError(null)
              }}
              className="min-h-11 text-muted-foreground transition-colors hover:text-foreground"
            >
              {t.auth.changeEmail}
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy || cooldown > 0}
              className="min-h-11 text-primary transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {cooldown > 0 ? format(t.auth.resendIn, { s: cooldown }) : t.auth.resend}
            </button>
          </div>
        </form>
      )}

      {googleEnabled && step === "email" && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            {t.auth.or}
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={signInWithGoogle}
            disabled={busy}
            className="h-11 w-full rounded-xl border-2"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            {t.auth.google}
          </Button>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
