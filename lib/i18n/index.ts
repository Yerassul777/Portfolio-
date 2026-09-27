import type { Locale } from "./config"
import { ru, type Dictionary } from "./dictionaries/ru"

export type { Dictionary }

// Static imports: the dictionaries are small, and a client component that
// needs one gets it from I18nProvider rather than importing it.
const dictionaries: Partial<Record<Locale, Dictionary>> = { ru }

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? ru
}
