import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PrivacyPolicyBody, policyEdition, policyTitle } from "@/components/privacy-policy"
import { SiteShell } from "@/components/site-shell"
import { HTML_LANG, isEnabledLocale } from "@/lib/i18n/config"
import { localeAlternates } from "@/lib/metadata"

type Props = { params: Promise<{ locale: string }> }

const DESCRIPTION = {
  ru: "Какие данные собирает Portfolio+, зачем, где они хранятся и как их удалить.",
  kz: "Portfolio+ қандай деректер жинайды, не үшін, олар қайда сақталады және оларды қалай жоюға болады.",
  en: "What data Portfolio+ collects, why, where it is stored and how to delete it.",
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  if (!isEnabledLocale(locale)) return {}
  return {
    title: policyTitle(locale),
    description: DESCRIPTION[locale],
    alternates: localeAlternates(locale, (l) => `/${l}/privacy`),
  }
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params
  if (!isEnabledLocale(locale)) notFound()

  return (
    <SiteShell>
      <article className="mx-auto w-full max-w-3xl min-w-0 space-y-10 px-4 py-12 sm:px-6 sm:py-16">
        <header className="space-y-3">
          <h1 lang={HTML_LANG[locale]} className="hyphens-auto break-words text-[1.75rem] font-bold leading-tight text-white sm:text-4xl">
            {policyTitle(locale)}
          </h1>
          <p className="text-sm text-gray-400">{policyEdition(locale)}</p>
        </header>
        <PrivacyPolicyBody locale={locale} />
      </article>
    </SiteShell>
  )
}
