"use client"

import { useEffect } from "react"
import { StatusPage, statusButtonClass } from "@/components/status-page"
import { ruError } from "@/lib/i18n/dictionaries/ru-error"
import "./globals.css"

// Last resort when the root layout itself fails: it replaces the whole
// document, so there is no i18n provider here and the default locale is used.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="ru" className="dark">
      <body className="font-sans antialiased">
        <main className="min-h-dvh bg-[#0a0f0d]">
          <StatusPage code=":(" title={ruError.title} text={ruError.text}>
            <button type="button" onClick={reset} className={statusButtonClass}>
              {ruError.retry}
            </button>
          </StatusPage>
        </main>
      </body>
    </html>
  )
}
