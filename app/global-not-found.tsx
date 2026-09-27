import type { Metadata } from "next"
import { StatusPage, statusButtonClass } from "@/components/status-page"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE, HTML_LANG } from "@/lib/i18n/config"
import { fontClassName } from "@/lib/fonts"
import "./globals.css"

// For URLs that match no route at all (e.g. /xyz or an unknown locale). It
// renders outside every layout, so it brings its own <html>, styles and fonts.
const t = getDictionary(DEFAULT_LOCALE)

export const metadata: Metadata = {
  title: `${t.notFound.title} — ${t.meta.siteName}`,
  robots: { index: false },
}

export default function GlobalNotFound() {
  return (
    <html lang={HTML_LANG[DEFAULT_LOCALE]} className={`dark ${fontClassName}`}>
      <body className="font-sans antialiased">
        <main className="min-h-dvh bg-[#0a0f0d]">
          <StatusPage code="404" title={t.notFound.title} text={t.notFound.text}>
            {/* A plain link: this page lives outside the app's router. */}
            <a href={`/${DEFAULT_LOCALE}`} className={statusButtonClass}>
              {t.notFound.home}
            </a>
          </StatusPage>
        </main>
      </body>
    </html>
  )
}
