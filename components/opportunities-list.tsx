"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { Search, X } from "lucide-react"
import { OpportunityCard } from "@/components/opportunity-card"
import { CategoryTabs } from "@/components/category-tabs"
import { FilterDialog } from "@/components/filter-dialog"
import { QuickFilters } from "@/components/quick-filters"
import type { Filters } from "@/components/filter-panel"
import { Skeleton } from "@/components/ui/skeleton"
import { QUICK_FILTERS, type Category, type Opportunity } from "@/lib/types"
import { matchesSearch, searchTokens } from "@/lib/search"

async function fetchOpportunities(category: Category): Promise<Opportunity[]> {
  const res = await fetch(`/api/sessions?category=${category}`)
  if (!res.ok) throw new Error(`Failed to fetch ${category}`)
  const { data } = await res.json()
  return data || []
}

export function OpportunitiesList() {
  const [category, setCategory] = useState<Category>("olympiads")
  const [filters, setFilters] = useState<Filters>({})
  const [query, setQuery] = useState("")

  // Filters belong to a category; the search text is the user's intent and
  // carries over when they switch tabs.
  useEffect(() => {
    setFilters({})
  }, [category])

  const {
    data: opportunities,
    isLoading,
    error,
  } = useSWR(["opportunities", category], () => fetchOpportunities(category), { revalidateOnFocus: false })

  const quickFilterKeys = useMemo(
    () => new Set(QUICK_FILTERS[category].map(({ key, value }) => `${key}:${value}`)),
    [category]
  )

  const filteredOpportunities = useMemo(() => {
    if (!opportunities) return []

    const tokens = searchTokens(query)
    const activeFilters = Object.entries(filters).filter(([_, values]) => values.length > 0)

    return opportunities.filter((opp) => {
      if (!matchesSearch(opp, category, tokens)) return false

      return activeFilters.every(([key, values]) => {
        // Special handling for grant_available (boolean)
        if (key === 'grant_available') {
          const grantValue = opp.grant_available
          if (values.includes('true') && grantValue === true) return true
          if (values.includes('false') && grantValue === false) return true
          return false
        }

        const oppValue = opp[key as keyof Opportunity]
        if (oppValue === null || oppValue === undefined) return false
        return values.includes(oppValue as string)
      })
    })
  }, [opportunities, filters, query, category])

  const hasFilters = Object.values(filters).flat().length > 0
  const hasQuery = query.trim().length > 0

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-4">
        <CategoryTabs activeCategory={category} onCategoryChange={setCategory} />
        <QuickFilters category={category} filters={filters} onFiltersChange={setFilters} />
      </div>

      <FilterDialog
        category={category}
        filters={filters}
        onFiltersChange={setFilters}
        hiddenBadges={quickFilterKeys}
      >
        <div className="relative min-w-0 flex-1 basis-56">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск: физика, Алматы, онлайн…"
            aria-label="Поиск по возможностям"
            className="h-10 w-full rounded-full border-2 border-border bg-card pl-11 pr-10 text-sm text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </FilterDialog>

      {isLoading ? (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-16 px-4">
          <div className="text-muted-foreground text-base">
            Не удалось загрузить данные. Попробуйте обновить страницу.
          </div>
        </div>
      ) : filteredOpportunities.length > 0 ? (
        <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredOpportunities.map((opp) => (
            <OpportunityCard key={opp.id} opportunity={opp} category={category} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 px-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔍</span>
          </div>
          <div className="text-muted-foreground text-base">
            {hasQuery || hasFilters
              ? "Ничего не найдено. Попробуйте изменить запрос или фильтры."
              : "В этой категории пока нет записей. Проверьте позже!"}
          </div>
          {(hasQuery || hasFilters) && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setFilters({})
              }}
              className="mt-4 text-sm font-medium text-primary hover:underline"
            >
              Сбросить поиск и фильтры
            </button>
          )}
        </div>
      )}
    </div>
  )
}
