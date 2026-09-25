import { FILTER_CONFIGS, getFilterLabel, type Category, type Opportunity } from "@/lib/types"

// Russian users type "е" for "ё" and vice versa; fold both so either matches.
function normalize(text: string): string {
  return text.toLocaleLowerCase("ru").replace(/ё/g, "е")
}

export function searchTokens(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean)
}

/**
 * Every word of the query must appear somewhere in the opportunity. The
 * searchable text includes the human labels of its filter values, so "Алматы"
 * or "онлайн" match a card whose city is stored as the code "almaty".
 */
export function matchesSearch(opportunity: Opportunity, category: Category, tokens: string[]): boolean {
  if (tokens.length === 0) return true

  const parts: string[] = [opportunity.title, opportunity.description]
  for (const config of FILTER_CONFIGS[category]) {
    const value = opportunity[config.key]
    if (typeof value === "string" && value) {
      parts.push(getFilterLabel(category, config.key as string, value))
    }
  }

  const haystack = normalize(parts.join(" "))
  return tokens.every((token) => haystack.includes(token))
}
