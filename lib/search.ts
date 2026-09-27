import { FILTER_CONFIGS, type Category } from "@/lib/types"

export const MAX_SEARCH_WORDS = 10
export const MAX_WORD_LENGTH = 100
export const MAX_QUERY_LENGTH = 200

// Same folding as public.search_normalize: lower case, "ё" reads as "е".
export function normalize(text: string): string {
  return text.toLocaleLowerCase("ru").replace(/ё/g, "е")
}

export type SearchWord = { t: string; f?: Record<string, string[]> }

/**
 * Splits a query into words for search_opportunities. Every word must match
 * the title or description — or a filter value whose human label contains it,
 * so "Алматы" finds cards stored as city=almaty and "грант" finds
 * grant_available=true. Labels live here, in FILTER_CONFIGS; the database
 * only ever compares codes.
 */
export function buildSearchWords(query: string, category: Category): SearchWord[] {
  const words = normalize(query.slice(0, MAX_QUERY_LENGTH))
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.slice(0, MAX_WORD_LENGTH))

  return [...new Set(words)].slice(0, MAX_SEARCH_WORDS).map((word) => {
    const matches: Record<string, string[]> = {}
    for (const config of FILTER_CONFIGS[category]) {
      const values = config.options.filter((o) => normalize(o.label).includes(word)).map((o) => o.value)
      if (values.length > 0) matches[config.key as string] = values
    }
    return Object.keys(matches).length > 0 ? { t: word, f: matches } : { t: word }
  })
}
