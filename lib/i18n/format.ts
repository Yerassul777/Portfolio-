import { HTML_LANG, type Locale } from "./config"

/** "Найдено {n}" + { n: 3 } -> "Найдено 3". Unknown placeholders stay as they are. */
export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  )
}

/**
 * Forms follow Intl.PluralRules categories. Russian needs three:
 * [one, few, many] -> 1 заметка, 3 заметки, 5 заметок (21 -> one, 11 -> many).
 * Languages with fewer forms repeat the last one.
 */
export type PluralForms = readonly [one: string, few: string, many: string]

export function plural(locale: Locale, n: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(HTML_LANG[locale]).select(n)
  const form = category === "one" ? forms[0] : category === "few" ? forms[1] : forms[2]
  return format(form, { n })
}
