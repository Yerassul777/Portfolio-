"use client"

import { Globe } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { ENABLED_LOCALES, LOCALE_NAMES, LOCALE_SHORT, type Locale } from "@/lib/i18n/config"

/** How long the choice is remembered (the "/" redirect reads it; next.config.mjs). */
const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * RU / KZ / EN. A native select: on a phone it opens the system picker, and
 * it costs no extra JavaScript. The same page opens in the other language,
 * with its filters and search kept; the choice is remembered in a cookie so
 * that the next visit to "/" (and the installed app) starts there.
 */
export function LanguageSwitcher() {
  const { locale, t } = useI18n()
  return (
    <label className="relative flex size-11 shrink-0 items-center justify-center rounded-full border border-gray-700 text-gray-300 transition-colors focus-within:ring-2 focus-within:ring-primary/60 hover:border-emerald-500/50 hover:text-white sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3">
      <Globe aria-hidden="true" className="h-4 w-4 sm:hidden" />
      <span aria-hidden="true" className="hidden text-xs font-semibold sm:inline">
        {LOCALE_SHORT[locale]}
      </span>
      <span className="sr-only">{t.language.label}</span>
      <select
        value={locale}
        onChange={(event) => {
          const next = event.target.value as Locale
          document.cookie = `locale=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`
          const { pathname, search, hash } = window.location
          const rest = pathname.replace(/^\/[^/]+/, "")
          window.location.assign(`/${next}${rest}${search}${hash}`)
        }}
        className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
      >
        {ENABLED_LOCALES.map((code) => (
          <option key={code} value={code} lang={code === "kz" ? "kk" : code}>
            {LOCALE_NAMES[code]}
          </option>
        ))}
      </select>
    </label>
  )
}
