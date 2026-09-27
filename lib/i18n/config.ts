// The site is served under /<locale>/... for a fixed list of locales, which
// also works for a static export inside the future app shells.
//
// Only locales in ENABLED_LOCALES get routes. Kazakh and English are Phase 7:
// add a dictionary in ./dictionaries, then add the code here.
export const LOCALES = ["ru", "kz", "en"] as const
export type Locale = (typeof LOCALES)[number]

export const ENABLED_LOCALES: readonly Locale[] = ["ru"]
export const DEFAULT_LOCALE: Locale = "ru"

export function isEnabledLocale(value: string): value is Locale {
  return (ENABLED_LOCALES as readonly string[]).includes(value)
}

// URL segment -> BCP 47 tag for <html lang> and Intl. "kz" reads better in a
// URL, but the language code for Kazakh is "kk".
export const HTML_LANG: Record<Locale, string> = { ru: "ru", kz: "kk", en: "en" }

export const OG_LOCALE: Record<Locale, string> = { ru: "ru_RU", kz: "kk_KZ", en: "en_US" }
