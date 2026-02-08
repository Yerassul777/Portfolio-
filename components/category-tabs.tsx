"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trophy, Medal, Heart, GraduationCap } from "lucide-react"
import type { Category } from "@/lib/types"

interface CategoryTabsProps {
  activeCategory: Category
  onCategoryChange: (category: Category) => void
}

export function CategoryTabs({ activeCategory, onCategoryChange }: CategoryTabsProps) {
  return (
    <Tabs value={activeCategory} onValueChange={(v) => onCategoryChange(v as Category)}>
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1">
        <TabsTrigger value="olympiads" className="gap-1.5 text-xs sm:text-sm py-2.5 px-2 sm:px-3">
          <Trophy className="h-4 w-4 shrink-0" />
          <span className="truncate">Олимпиады</span>
        </TabsTrigger>
        <TabsTrigger value="competitions" className="gap-1.5 text-xs sm:text-sm py-2.5 px-2 sm:px-3">
          <Medal className="h-4 w-4 shrink-0" />
          <span className="truncate">Соревнования</span>
        </TabsTrigger>
        <TabsTrigger value="volunteering" className="gap-1.5 text-xs sm:text-sm py-2.5 px-2 sm:px-3">
          <Heart className="h-4 w-4 shrink-0" />
          <span className="truncate">Волонтёрство</span>
        </TabsTrigger>
        <TabsTrigger value="universities" className="gap-1.5 text-xs sm:text-sm py-2.5 px-2 sm:px-3">
          <GraduationCap className="h-4 w-4 shrink-0" />
          <span className="truncate">Университеты</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
