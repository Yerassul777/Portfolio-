"use client"

import type { ReactNode } from "react"
import { Loader2, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthForm } from "@/components/auth-form"
import { useAuth } from "@/components/auth-provider"
import { ConsentGate } from "@/components/consent"
import { useI18n } from "@/components/i18n-provider"

/**
 * What every account tab needs before its content: a sign-in for visitors,
 * a spinner while the session restores, and the consent gate.
 */
export function AccountOnly({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) {
    return (
      <div className="px-6 py-10">
        <AuthForm title={title} description={text} />
      </div>
    )
  }
  return <ConsentGate>{children}</ConsentGate>
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-gray-400">
      <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-emerald-400" />
      {label}
    </div>
  )
}

export function LoadError({ text, onRetry }: { text: string; onRetry: () => void }) {
  const { t } = useI18n()
  return (
    <div className="space-y-3 py-12 text-center">
      <p role="alert" className="text-sm text-gray-300">
        {text}
      </p>
      <Button variant="outline" className="h-11" onClick={onRetry}>
        {t.portfolio.retry}
      </Button>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800/50">
        <Icon aria-hidden="true" className="h-8 w-8 text-gray-400" />
      </div>
      <p className="text-sm text-gray-300">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-xs text-gray-400">{text}</p>
    </div>
  )
}
