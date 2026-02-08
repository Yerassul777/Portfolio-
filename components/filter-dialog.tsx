"use client"

import React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { 
  SlidersHorizontal, 
  X,
  Book,
  Trophy,
  Users,
  Monitor,
  MapPin,
  Zap,
  Heart,
  Clock,
  GraduationCap,
  Building,
  Wallet,
  ClipboardList
} from "lucide-react"
import { FILTER_CONFIGS, type Category } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { Filters } from "@/components/filter-panel"

interface FilterDialogProps {
  category: Category
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

const iconMap: Record<string, React.ReactNode> = {
  'book': <Book className="h-4 w-4" />,
  'trophy': <Trophy className="h-4 w-4" />,
  'users': <Users className="h-4 w-4" />,
  'monitor': <Monitor className="h-4 w-4" />,
  'map-pin': <MapPin className="h-4 w-4" />,
  'zap': <Zap className="h-4 w-4" />,
  'heart': <Heart className="h-4 w-4" />,
  'clock': <Clock className="h-4 w-4" />,
  'graduation-cap': <GraduationCap className="h-4 w-4" />,
  'building': <Building className="h-4 w-4" />,
  'wallet': <Wallet className="h-4 w-4" />,
  'clipboard': <ClipboardList className="h-4 w-4" />,
}

export function FilterDialog({ category, filters, onFiltersChange }: FilterDialogProps) {
  const [open, setOpen] = useState(false)
  const filterConfigs = FILTER_CONFIGS[category]
  const activeFilterCount = Object.values(filters).flat().length

  const handleFilterChange = (key: string, value: string) => {
    const currentValues = filters[key] || []
    const isSelected = currentValues.includes(value)
    const newValues = isSelected
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value]
    
    onFiltersChange({
      ...filters,
      [key]: newValues,
    })
  }

  const clearAllFilters = () => {
    onFiltersChange({})
  }

  const clearFilter = (key: string, value: string) => {
    const currentValues = filters[key] || []
    onFiltersChange({
      ...filters,
      [key]: currentValues.filter((v) => v !== value),
    })
  }

  const getFilterLabel = (key: string, value: string): string => {
    const config = filterConfigs.find((c) => c.key === key)
    const option = config?.options.find((o) => o.value === value)
    return option?.label || value
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="lg"
              className={cn(
                "gap-2 rounded-full border-2 px-6 transition-all duration-300 shadow-sm hover:shadow-md",
                activeFilterCount > 0 
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" 
                  : "border-border bg-card hover:border-primary/50"
              )}
            >
              <SlidersHorizontal className="h-5 w-5" />
              <span className="font-medium">Фильтры</span>
              {activeFilterCount > 0 && (
                <Badge 
                  variant="secondary" 
                  className="ml-1 h-6 min-w-6 px-2 rounded-full bg-primary-foreground text-primary text-xs font-bold"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl">Фильтры</DialogTitle>
              <DialogDescription>
                Настройте параметры поиска для более точных результатов
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {filterConfigs.map((config) => (
                  <div key={config.key} className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      {config.icon && iconMap[config.icon]}
                      <h3 className="font-semibold text-lg">{config.label}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {config.options.map((option) => {
                        const isSelected = (filters[config.key as string] || []).includes(option.value)
                        return (
                          <button
                            type="button"
                            key={option.value}
                            onClick={() => handleFilterChange(config.key as string, option.value)}
                            className={cn(
                              "flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 border-2",
                              isSelected 
                                ? "bg-primary border-primary text-primary-foreground shadow-md" 
                                : "bg-card border-border hover:border-primary/50 hover:bg-accent"
                            )}
                          >
                            <div className={cn(
                              "h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200",
                              isSelected 
                                ? "border-primary-foreground bg-primary-foreground" 
                                : "border-muted-foreground/50"
                            )}>
                              {isSelected && (
                                <svg className="h-4 w-4 text-primary" viewBox="0 0 12 12">
                                  <path 
                                    fill="currentColor" 
                                    d="M10.28 2.28a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 1 1 1.06-1.06L4.25 7.2l4.97-4.92a.75.75 0 0 1 1.06 0z"
                                  />
                                </svg>
                              )}
                            </div>
                            <span className="text-sm font-medium">{option.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                disabled={activeFilterCount === 0}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-2" />
                Сбросить всё
              </Button>
              <Button onClick={() => setOpen(false)} className="rounded-full px-6">
                Применить
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            Сбросить всё
          </Button>
        )}
      </div>

      {/* Active filters badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
          {Object.entries(filters).map(([key, values]) =>
            values.map((value) => (
              <Badge
                key={`${key}-${value}`}
                variant="secondary"
                className="gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all duration-200 group border border-primary/20"
              >
                <span className="text-sm font-medium">{getFilterLabel(key, value)}</span>
                <button
                  type="button"
                  onClick={() => clearFilter(key, value)}
                  className="ml-1 rounded-full p-1 hover:bg-primary/30 transition-colors duration-200"
                >
                  <X className="h-3 w-3" />
                  <span className="sr-only">Удалить фильтр</span>
                </button>
              </Badge>
            ))
          )}
        </div>
      )}
    </div>
  )
}
