"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  SlidersHorizontal, 
  X, 
  ChevronDown,
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
import { FILTER_CONFIGS, type Category, type FilterConfig } from "@/lib/types"
import { cn } from "@/lib/utils"

export type Filters = Record<string, string[]>

interface FilterPanelProps {
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

export function FilterPanel({ category, filters, onFiltersChange }: FilterPanelProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const filterConfigs = FILTER_CONFIGS[category]
  const containerRef = useRef<HTMLDivElement>(null)
  
  const activeFilterCount = Object.values(filters).flat().length

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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
    setActiveDropdown(null)
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

  const getSelectedCount = (key: string): number => {
    return (filters[key] || []).length
  }

  return (
    <div className="space-y-3" ref={containerRef}>
      {/* Filter buttons row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* Main filter icon button */}
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "h-10 w-10 shrink-0 rounded-full border-2 transition-all duration-300",
            activeFilterCount > 0 
              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" 
              : "border-muted-foreground/30 bg-transparent hover:border-foreground/50 hover:bg-accent"
          )}
          onClick={() => activeFilterCount > 0 ? clearAllFilters() : setActiveDropdown(activeDropdown ? null : filterConfigs[0]?.key as string)}
        >
          {activeFilterCount > 0 ? (
            <X className="h-4 w-4" />
          ) : (
            <SlidersHorizontal className="h-4 w-4" />
          )}
        </Button>

        {/* Filter category buttons */}
        {filterConfigs.map((config) => {
          const selectedCount = getSelectedCount(config.key as string)
          const isActive = activeDropdown === config.key
          
          return (
            <div key={config.key} className="relative">
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 rounded-full border-2 px-3 transition-all duration-300 whitespace-nowrap bg-transparent",
                  isActive && "border-foreground bg-accent",
                  selectedCount > 0 && !isActive && "border-primary/50 bg-primary/10",
                  !isActive && selectedCount === 0 && "border-muted-foreground/30 hover:border-foreground/50"
                )}
                onClick={() => setActiveDropdown(isActive ? null : config.key as string)}
              >
                {config.icon && iconMap[config.icon]}
                <span className="text-sm">{config.label}</span>
                {selectedCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-0.5 h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs"
                  >
                    {selectedCount}
                  </Badge>
                )}
                <ChevronDown className={cn(
                  "h-3.5 w-3.5 transition-transform duration-300",
                  isActive && "rotate-180"
                )} />
              </Button>

              {/* Dropdown */}
              <div className={cn(
                "absolute left-0 top-full mt-2 z-50 min-w-[200px] origin-top transition-all duration-300",
                isActive 
                  ? "opacity-100 scale-100 translate-y-0" 
                  : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
              )}>
                <div className="rounded-xl border bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                  <ScrollArea className="max-h-[300px]">
                    <div className="p-2">
                      {config.options.map((option) => {
                        const isSelected = (filters[config.key as string] || []).includes(option.value)
                        return (
                          <button
                            type="button"
                            key={option.value}
                            onClick={() => handleFilterChange(config.key as string, option.value)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200",
                              isSelected 
                                ? "bg-primary text-primary-foreground" 
                                : "hover:bg-accent"
                            )}
                          >
                            <div className={cn(
                              "h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-200",
                              isSelected 
                                ? "border-primary-foreground bg-primary-foreground" 
                                : "border-muted-foreground/50"
                            )}>
                              {isSelected && (
                                <svg className="h-3 w-3 text-primary" viewBox="0 0 12 12">
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
                  </ScrollArea>
                </div>
              </div>
            </div>
          )
        })}

        {/* Clear all button */}
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-9 rounded-full text-muted-foreground hover:text-foreground shrink-0"
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
                className="gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-accent hover:bg-accent/80 transition-all duration-200 group"
              >
                <span className="text-sm">{getFilterLabel(key, value)}</span>
                <button
                  type="button"
                  onClick={() => clearFilter(key, value)}
                  className="ml-1 rounded-full p-1 hover:bg-destructive/20 transition-colors duration-200 group-hover:bg-muted-foreground/20"
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
