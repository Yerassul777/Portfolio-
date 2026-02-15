"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  FileText,
  ImageIcon,
  ExternalLink,
  SlidersHorizontal,
  Calendar,
  MapPin,
  Monitor,
  GraduationCap,
  Clock,
  BookOpen,
  Trophy,
  Users,
  Building,
  Clipboard,
  Zap,
  Heart,
} from "lucide-react"
import type { Opportunity, Category } from "@/lib/types"
import { FILTER_CONFIGS, KAZAKHSTAN_CITIES } from "@/lib/types"

interface SessionDetailModalProps {
  opportunity: Opportunity | null
  category?: Category
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FILTER_ICONS: Record<string, React.ReactNode> = {
  subject: <BookOpen className="h-3.5 w-3.5" />,
  level: <Trophy className="h-3.5 w-3.5" />,
  age_group: <Users className="h-3.5 w-3.5" />,
  type: <Zap className="h-3.5 w-3.5" />,
  format: <Monitor className="h-3.5 w-3.5" />,
  duration: <Clock className="h-3.5 w-3.5" />,
  city: <MapPin className="h-3.5 w-3.5" />,
  field: <GraduationCap className="h-3.5 w-3.5" />,
  grant_available: <Building className="h-3.5 w-3.5" />,
  requirements: <Clipboard className="h-3.5 w-3.5" />,
}

function getFilterLabel(category: Category, key: string, value: string): string {
  const configs = FILTER_CONFIGS[category]
  const config = configs.find((c) => c.key === key)
  if (!config) return value

  if (key === "city") {
    const city = KAZAKHSTAN_CITIES.find((c) => c.value === value)
    return city?.label || value
  }

  if (key === "grant_available") {
    return value === "true" ? "Есть гранты" : "Только платное"
  }

  const option = config.options.find((o) => o.value === value)
  return option?.label || value
}

function getFilterConfigLabel(category: Category, key: string): string {
  const configs = FILTER_CONFIGS[category]
  const config = configs.find((c) => c.key === key)
  return config?.label || key
}

export function SessionDetailModal({ opportunity, category, open, onOpenChange }: SessionDetailModalProps) {
  if (!opportunity) return null

  const isExpired = opportunity.deadline ? new Date(opportunity.deadline) < new Date() : false

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  // Collect active filters
  const activeFilters: { key: string; label: string; value: string; valueLabel: string }[] = []
  if (category) {
    const filterKeys = FILTER_CONFIGS[category].map((c) => c.key)
    for (const key of filterKeys) {
      const rawValue = opportunity[key as keyof Opportunity]
      if (rawValue !== null && rawValue !== undefined && rawValue !== "") {
        const strValue = String(rawValue)
        activeFilters.push({
          key: String(key),
          label: getFilterConfigLabel(category, String(key)),
          value: strValue,
          valueLabel: getFilterLabel(category, String(key), strValue),
        })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-2xl p-0 gap-0 overflow-hidden bg-card border-border/50 max-h-[90vh]">
        <DialogTitle className="sr-only">{opportunity.title}</DialogTitle>

        {/* Header with title */}
        <div className="px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold leading-tight text-foreground text-balance">
                {opportunity.title}
              </h2>
              {opportunity.deadline && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span
                    className={`text-sm ${isExpired ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {isExpired ? "Истёк: " : "Дедлайн: "}
                    {formatDate(opportunity.deadline)}
                  </span>
                </div>
              )}
            </div>
            {opportunity.grant_available && (
              <Badge className="shrink-0 bg-emerald-500/15 text-emerald-500 border-emerald-500/25 hover:bg-emerald-500/15">
                <GraduationCap className="h-3 w-3 mr-1" />
                Грант
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="info" className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent px-6 h-auto gap-0">
            <TabsTrigger
              value="info"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Информация</span>
              <span className="sm:hidden">Инфо</span>
            </TabsTrigger>
            <TabsTrigger
              value="photo"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Фото
            </TabsTrigger>
            <TabsTrigger
              value="filters"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Параметры</span>
              <span className="sm:hidden">Фильтры</span>
            </TabsTrigger>
            <TabsTrigger
              value="link"
              className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:text-emerald-500 data-[state=active]:shadow-none px-4 py-2.5 text-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ссылка
            </TabsTrigger>
          </TabsList>

          {/* Info Tab */}
          <TabsContent value="info" className="flex-1 m-0 min-h-0">
            <ScrollArea className="h-[40vh] sm:h-[45vh]">
              <div className="p-6">
                <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
                  {opportunity.description}
                </p>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Photo Tab */}
          <TabsContent value="photo" className="flex-1 m-0 min-h-0">
            <ScrollArea className="h-[40vh] sm:h-[45vh]">
              <div className="p-6">
                {opportunity.image_url ? (
                  <div className="rounded-xl overflow-hidden border border-border/50">
                    <img
                      src={opportunity.image_url}
                      alt={opportunity.title}
                      className="w-full h-auto object-cover"
                      crossOrigin="anonymous"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                    <p className="text-sm">Фото не добавлено</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Filters/Parameters Tab */}
          <TabsContent value="filters" className="flex-1 m-0 min-h-0">
            <ScrollArea className="h-[40vh] sm:h-[45vh]">
              <div className="p-6">
                {activeFilters.length > 0 ? (
                  <div className="grid gap-3">
                    {activeFilters.map((filter) => (
                      <div
                        key={filter.key}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30"
                      >
                        <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                          {FILTER_ICONS[filter.key] || <SlidersHorizontal className="h-3.5 w-3.5" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{filter.label}</p>
                          <p className="text-sm font-medium text-foreground truncate">
                            {filter.valueLabel}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <SlidersHorizontal className="h-8 w-8" />
                    </div>
                    <p className="text-sm">Параметры не указаны</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Link Tab */}
          <TabsContent value="link" className="flex-1 m-0 min-h-0">
            <ScrollArea className="h-[40vh] sm:h-[45vh]">
              <div className="p-6">
                {opportunity.link ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-border/50 bg-muted/30">
                      <p className="text-xs text-muted-foreground mb-2">Ссылка на источник</p>
                      <p className="text-sm text-foreground break-all font-mono">
                        {opportunity.link}
                      </p>
                    </div>
                    <Button asChild className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <a href={opportunity.link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Перейти на сайт
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                      <ExternalLink className="h-8 w-8" />
                    </div>
                    <p className="text-sm">Ссылка не указана</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
