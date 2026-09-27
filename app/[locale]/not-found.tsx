"use client"

import Link from "next/link"
import { useI18n } from "@/components/i18n-provider"
import { SiteShell } from "@/components/site-shell"
import { StatusPage, statusButtonClass } from "@/components/status-page"

// notFound() from any page or layout under /[locale]: an unknown category or
// a removed opportunity. Unmatched URLs go to app/global-not-found.tsx instead.
export default function NotFound() {
  const { locale, t } = useI18n()
  return (
    <SiteShell locale={locale}>
      <StatusPage code="404" title={t.notFound.title} text={t.notFound.text}>
        <Link href={`/${locale}`} className={statusButtonClass}>
          {t.notFound.home}
        </Link>
      </StatusPage>
    </SiteShell>
  )
}
