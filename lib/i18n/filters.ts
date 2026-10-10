import type { Dictionary } from "./index"
import { FILTER_CONFIGS, getFilterLabel, type Category } from "@/lib/types"

// Filter names and values in the reader's language. FILTER_CONFIGS holds the
// Russian labels (the admin form, the AI tool and the database share them);
// a dictionary's `filters` adds the other languages, keyed "category.key"
// and "category.key.value" (cities are shared: "city.value"). Anything
// missing falls back to Russian, so a new option never shows up blank.

export function filterName(t: Dictionary, category: Category, key: string): string {
  return t.filters.names[`${category}.${key}`] ?? FILTER_CONFIGS[category].find((c) => c.key === key)?.label ?? key
}

export function filterValue(t: Dictionary, category: Category, key: string, value: string): string {
  return t.filters.values[`${category}.${key}.${value}`] ?? t.filters.values[`${key}.${value}`] ?? getFilterLabel(category, key, value)
}
