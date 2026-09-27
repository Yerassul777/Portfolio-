"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useI18n } from "@/components/i18n-provider"
import { StatusPage, statusButtonClass, statusSecondaryClass } from "@/components/status-page"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { locale, t } = useI18n()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <StatusPage code=":(" title={t.error.title} text={t.error.text}>
      <button type="button" onClick={reset} className={statusButtonClass}>
        {t.error.retry}
      </button>
      <Link href={`/${locale}`} className={statusSecondaryClass}>
        {t.error.home}
      </Link>
    </StatusPage>
  )
}
