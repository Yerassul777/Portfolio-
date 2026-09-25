"use client"

import { useEffect, useState } from "react"
import { Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

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

function describeAuthError(message: string): string {
  if (/rate limit|too many|security purposes/i.test(message)) {
    return "Слишком много попыток. Подождите минуту и попробуйте снова."
  }
  if (/expired|invalid/i.test(message)) {
    return "Код неверный или устарел. Запросите новый."
  }
  if (/signups not allowed/i.test(message)) {
    return "Регистрация временно закрыта."
  }
  return "Не получилось войти. Попробуйте ещё раз."
}

interface AuthFormProps {
  title: string
  description?: string
}

export function AuthForm({ title, description }: AuthFormProps) {
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
    const { error } = await getSupabaseBrowserClient().auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    })
    setBusy(false)
    if (error) {
      setError(describeAuthError(error.message))
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
    const { error } = await getSupabaseBrowserClient().auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    })
    setBusy(false)
    if (error) setError(describeAuthError(error.message))
    // On success AuthProvider receives the new session and the parent re-renders.
  }

  const signInWithGoogle = async () => {
    setBusy(true)
    setError(null)
    const { error } = await getSupabaseBrowserClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    })
    if (error) {
      setBusy(false)
      setError(describeAuthError(error.message))
    }
  }

  const inputClass =
    "h-11 w-full rounded-xl border-2 border-border bg-card px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60"

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
            aria-label="Email"
            className={inputClass}
          />
          <Button type="submit" disabled={busy || !email.trim()} className="h-11 w-full rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Получить код на почту
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
          <p className="text-center text-sm text-muted-foreground">
            Мы отправили письмо на <span className="font-medium text-foreground">{email.trim()}</span>.
            Введите код из письма или просто перейдите по ссылке в нём.
          </p>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Код из письма"
            aria-label="Код из письма"
            className={`${inputClass} text-center text-lg tracking-[0.3em]`}
          />
          <Button type="submit" disabled={busy || !code.trim()} className="h-11 w-full rounded-xl">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Войти
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => {
                setStep("email")
                setCode("")
                setError(null)
              }}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Изменить email
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy || cooldown > 0}
              className="text-primary transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              {cooldown > 0 ? `Отправить снова через ${cooldown} с` : "Отправить снова"}
            </button>
          </div>
        </form>
      )}

      {googleEnabled && step === "email" && (
        <>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            или
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
            Войти через Google
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
