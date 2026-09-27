"use client"

import type { MouseEvent } from "react"
import { GraduationCap, Heart, Medal, Trophy, type LucideIcon } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { CATEGORIES, type Category } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<Category, LucideIcon> = {
  olympiads: Trophy,
  competitions: Medal,
  volunteering: Heart,
  universities: GraduationCap,
}

/** A plain click on a link with no modifier keys, the only kind we handle in-page. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

interface CategoryNavProps {
  active: Category
  hrefFor: (category: Category) => string
  onSelect: (category: Category) => void
}

// Real links, so every category is crawlable and opens in a new tab on
// middle-click; a plain click switches in place without reloading.
export function CategoryNav({ active, hrefFor, onSelect }: CategoryNavProps) {
  const { t } = useI18n()

  return (
    <nav aria-label={t.catalogue.categoriesLabel}>
      <ul className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:grid-cols-4">
        {CATEGORIES.map((category) => {
          const Icon = ICONS[category]
          const current = category === active
          return (
            <li key={category}>
              <a
                href={hrefFor(category)}
                aria-current={current ? "page" : undefined}
                onClick={(event) => {
                  if (!isPlainClick(event)) return
                  event.preventDefault()
                  if (!current) onSelect(category)
                }}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-transparent px-2 text-sm font-medium transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  current
                    ? "border-input bg-input/30 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.categories[category].label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
