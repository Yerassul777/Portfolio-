"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { OpportunityCard } from "@/components/opportunity-card"
import { CategoryTabs } from "@/components/category-tabs"
import { FilterDialog } from "@/components/filter-dialog"
import { FilterPanel } from "@/components/filter-panel"
import type { Filters } from "@/components/filter-panel"
import { Skeleton } from "@/components/ui/skeleton"
import type { Category, Opportunity } from "@/lib/types"

async function fetchOpportunities(category: Category): Promise<Opportunity[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase.from(category).select("*").order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export function OpportunitiesList() {
  const [category, setCategory] = useState<Category>("olympiads")
  const [filters, setFilters] = useState<Filters>({})

  // Reset filters when category changes
  useEffect(() => {
    setFilters({})
  }, [category])

  const {
    data: opportunities,
    isLoading,
    error,
  } = useSWR(["opportunities", category], () => fetchOpportunities(category), { revalidateOnFocus: false })

  const filteredOpportunities = useMemo(() => {
    if (!opportunities) return []
    
    const activeFilters = Object.entries(filters).filter(([_, values]) => values.length > 0)
    
    if (activeFilters.length === 0) return opportunities
    
    return opportunities.filter((opp) => {
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
  }, [opportunities, filters])

  return (
    <div className="space-y-6 sm:space-y-8">
      <CategoryTabs activeCategory={category} onCategoryChange={setCategory} />
      
      <FilterDialog category={category} filters={filters} onFiltersChange={setFilters} />

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
            {Object.values(filters).flat().length > 0 
              ? "Ничего не найдено по выбранным фильтрам. Попробуйте изменить критерии." 
              : "В этой категории пока нет записей. Проверьте позже!"}
          </div>
        </div>
      )}
    </div>
  )
}
