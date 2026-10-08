import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrivacyPolicyBody, formatPolicyVersion } from "@/components/privacy-policy"
import { SiteShell } from "@/components/site-shell"
import { isEnabledLocale } from "@/lib/i18n/config"

type Props = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "Политика конфиденциальности",
  description: "Какие данные собирает Portfolio+, зачем, где они хранятся и как их удалить.",
  alternates: { canonical: "/ru/privacy" },
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params
  if (!isEnabledLocale(locale)) notFound()

  return (
    <SiteShell>
      <article className="mx-auto w-full max-w-3xl min-w-0 space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <header className="space-y-3">
          <h1 lang="ru" className="hyphens-auto break-words text-[1.75rem] font-bold leading-tight text-white sm:text-4xl">Политика конфиденциальности</h1>
          <p className="text-sm text-gray-400">Редакция от {formatPolicyVersion()}</p>
        </header>
        <PrivacyPolicyBody />
      </article>
    </SiteShell>
  )
}
