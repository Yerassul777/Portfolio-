"use client"

import { useI18n } from "@/components/i18n-provider"
import { QUICK_FILTERS, getFilterLabel, type Category, type Filters } from "@/lib/types"
import { cn } from "@/lib/utils"

interface QuickFiltersProps {
  category: Category
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

export function QuickFilters({ category, filters, onFiltersChange }: QuickFiltersProps) {
  const { t } = useI18n()
  const chips = QUICK_FILTERS[category]

  const toggle = (key: string, value: string) => {
    const current = filters[key] || []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    onFiltersChange({ ...filters, [key]: next })
  }

  return (
    // Scrolls sideways on phones instead of wrapping into a tall block.
    <div
      role="group"
      aria-label={t.catalogue.quickFiltersLabel}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {chips.map(({ key, value }) => {
        const active = (filters[key] || []).includes(value)
        return (
          <button
            key={`${key}-${value}`}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(key, value)}
            className={cn(
              "h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:h-9",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {getFilterLabel(category, key, value)}
          </button>
        )
      })}
    </div>
  )
}
