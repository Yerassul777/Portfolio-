"use client"

import { useRef, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"
import { activeFilterCount } from "@/lib/catalogue"
import { format } from "@/lib/i18n/format"
import { filterValue } from "@/lib/i18n/filters"
import type { Category, Filters } from "@/lib/types"
import { cn } from "@/lib/utils"

const loadSheet = () => import("@/components/filter-sheet")
const FilterSheet = dynamic(() => loadSheet().then((m) => m.FilterSheet), { ssr: false })

interface FilterDialogProps {
  category: Category
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  /** Rendered first in the toolbar row, e.g. the search input. */
  children?: ReactNode
  /** "key:value" pairs already visible elsewhere (quick chips) — no duplicate badge. */
  hiddenBadges?: Set<string>
}

export function FilterDialog({ category, filters, onFiltersChange, children, hiddenBadges }: FilterDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  // The sheet's code loads on first use and it stays mounted afterwards.
  const [mounted, setMounted] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const count = activeFilterCount(filters)

  const toggle = (key: string, value: string) => {
    const current = filters[key] || []
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    onFiltersChange({ ...filters, [key]: next })
  }

  const badges = Object.entries(filters).flatMap(([key, values]) =>
    values.filter((value) => !hiddenBadges?.has(`${key}:${value}`)).map((value) => ({ key, value }))
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {children}
        <Button
          ref={buttonRef}
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded={open}
          onPointerDown={() => void loadSheet().catch(() => {})}
          onClick={() => {
            setMounted(true)
            setOpen(true)
          }}
          className={cn(
            "h-11 gap-2 rounded-full border-2 px-5 shadow-sm transition-all duration-300 hover:shadow-md sm:h-10",
            count > 0
              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
              : "border-border bg-card hover:border-primary/50"
          )}
        >
          <SlidersHorizontal className="h-5 w-5" />
          <span className="font-medium">{t.catalogue.filters}</span>
          {count > 0 && (
            <span className="ml-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-primary-foreground px-2 text-xs font-bold text-primary">
              {count}
            </span>
          )}
        </Button>
        {mounted && (
          <FilterSheet
            open={open}
            onOpenChange={setOpen}
            category={category}
            filters={filters}
            count={count}
            onToggle={toggle}
            onReset={() => onFiltersChange({})}
            returnFocusRef={buttonRef}
          />
        )}

        {count > 0 && (
          <Button
            variant="ghost"
            onClick={() => onFiltersChange({})}
            className="h-11 rounded-full text-muted-foreground hover:text-foreground sm:h-9"
          >
            {t.catalogue.resetAll}
          </Button>
        )}
      </div>

      {badges.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {badges.map(({ key, value }) => {
            const label = filterValue(t, category, key, value)
            return (
              <li
                key={`${key}-${value}`}
                className="flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-1 pl-3 pr-1 text-sm font-medium text-primary"
              >
                {label}
                <button
                  type="button"
                  onClick={() => toggle(key, value)}
                  aria-label={format(t.catalogue.removeFilter, { label })}
                  className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
