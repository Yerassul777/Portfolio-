"use client"

import type { ReactNode, RefObject } from "react"
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
  Trophy,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/components/i18n-provider"
import { FILTER_CONFIGS, type Category, type Filters } from "@/lib/types"
import { cn } from "@/lib/utils"

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

interface FilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category
  filters: Filters
  count: number
  onToggle: (key: string, value: string) => void
  onReset: () => void
  /** The "Filters" button, which gets focus back when the sheet closes. */
  returnFocusRef: RefObject<HTMLButtonElement | null>
}

/**
 * Every filter for a category. Loaded on demand by FilterDialog, so the dialog
 * machinery is not part of the page's initial JavaScript.
 */
export function FilterSheet({ open, onOpenChange, category, filters, count, onToggle, onReset, returnFocusRef }: FilterSheetProps) {
  const { t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        sheetOnMobile
        closeLabel={t.details.close}
        className="flex max-h-[85dvh] flex-col gap-0 p-0 sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current?.focus()
        }}
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
                        onClick={() => onToggle(key, option.value)}
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
            onClick={onReset}
            disabled={count === 0}
            className="h-11 text-muted-foreground hover:text-foreground sm:h-9"
          >
            <X className="h-4 w-4" />
            {t.catalogue.resetAll}
          </Button>
          <Button onClick={() => onOpenChange(false)} className="h-11 rounded-full px-6 sm:h-9">
            {t.catalogue.showResults}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
