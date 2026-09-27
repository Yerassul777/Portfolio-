"use client"

import { useState, type ReactNode } from "react"
import {
  Book,
  Building,
  Check,
  ClipboardList,
  Clock,
  GraduationCap,
  Heart,
  MapPin,
  Monitor,
  SlidersHorizontal,
  Trophy,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useI18n } from "@/components/i18n-provider"
import { activeFilterCount } from "@/lib/catalogue"
import { format } from "@/lib/i18n/format"
import { FILTER_CONFIGS, getFilterLabel, type Category, type Filters } from "@/lib/types"
import { cn } from "@/lib/utils"

interface FilterDialogProps {
  category: Category
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  /** Rendered first in the toolbar row, e.g. the search input. */
  children?: ReactNode
  /** "key:value" pairs already visible elsewhere (quick chips) — no duplicate badge. */
  hiddenBadges?: Set<string>
}

const ICONS: Record<string, ReactNode> = {
  book: <Book className="h-4 w-4" />,
  trophy: <Trophy className="h-4 w-4" />,
  users: <Users className="h-4 w-4" />,
  monitor: <Monitor className="h-4 w-4" />,
  "map-pin": <MapPin className="h-4 w-4" />,
  zap: <Zap className="h-4 w-4" />,
  heart: <Heart className="h-4 w-4" />,
  clock: <Clock className="h-4 w-4" />,
  "graduation-cap": <GraduationCap className="h-4 w-4" />,
  building: <Building className="h-4 w-4" />,
  wallet: <Wallet className="h-4 w-4" />,
  clipboard: <ClipboardList className="h-4 w-4" />,
}

export function FilterDialog({ category, filters, onFiltersChange, children, hiddenBadges }: FilterDialogProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
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
          </DialogTrigger>
          <DialogContent
            sheetOnMobile
            closeLabel={t.details.close}
            className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-2xl"
          >
            <DialogHeader className="border-b px-6 pb-4 pt-6 text-left">
              <DialogTitle className="text-2xl">{t.catalogue.filtersTitle}</DialogTitle>
              <DialogDescription>{t.catalogue.filtersDescription}</DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5">
              {FILTER_CONFIGS[category].map((config) => {
                const key = config.key as string
                return (
                  <fieldset key={key} className="space-y-3">
                    <legend className="mb-3 flex w-full items-center gap-2 border-b pb-2 text-lg font-semibold">
                      {config.icon && ICONS[config.icon]}
                      {config.label}
                    </legend>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {config.options.map((option) => {
                        const selected = (filters[key] || []).includes(option.value)
                        return (
                          <button
                            type="button"
                            key={option.value}
                            aria-pressed={selected}
                            onClick={() => toggle(key, option.value)}
                            className={cn(
                              "flex min-h-12 items-center gap-3 rounded-xl border-2 px-4 py-2.5 text-left transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                              selected
                                ? "border-primary bg-primary text-primary-foreground shadow-md"
                                : "border-border bg-card hover:border-primary/50 hover:bg-accent"
                            )}
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200",
                                selected ? "border-primary-foreground bg-primary-foreground" : "border-muted-foreground/50"
                              )}
                            >
                              {selected && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />}
                            </span>
                            <span className="text-sm font-medium">{option.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                )
              })}
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
              <Button
                variant="ghost"
                onClick={() => onFiltersChange({})}
                disabled={count === 0}
                className="h-11 text-muted-foreground hover:text-foreground sm:h-9"
              >
                <X className="h-4 w-4" />
                {t.catalogue.resetAll}
              </Button>
              <Button onClick={() => setOpen(false)} className="h-11 rounded-full px-6 sm:h-9">
                {t.catalogue.showResults}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
            const label = getFilterLabel(category, key, value)
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
