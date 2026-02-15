"use client"

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  X,
  ArrowUpRight,
} from "lucide-react"
import type { Opportunity, Category } from "@/lib/types"
import { FILTER_CONFIGS, KAZAKHSTAN_CITIES } from "@/lib/types"
import { useState } from "react"

interface SessionDetailModalProps {
  opportunity: Opportunity | null
  category?: Category
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FILTER_ICONS: Record<string, React.ReactNode> = {
  subject: <BookOpen className="h-4 w-4" />,
  level: <Trophy className="h-4 w-4" />,
  age_group: <Users className="h-4 w-4" />,
  type: <Zap className="h-4 w-4" />,
  format: <Monitor className="h-4 w-4" />,
  duration: <Clock className="h-4 w-4" />,
  city: <MapPin className="h-4 w-4" />,
  field: <GraduationCap className="h-4 w-4" />,
  grant_available: <Building className="h-4 w-4" />,
  requirements: <Clipboard className="h-4 w-4" />,
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

type TabKey = "info" | "photo" | "filters" | "link"

const TABS: { key: TabKey; label: string; shortLabel: string; icon: React.ReactNode }[] = [
  { key: "info", label: "Информация", shortLabel: "Инфо", icon: <FileText className="h-4 w-4" /> },
  { key: "photo", label: "Фото", shortLabel: "Фото", icon: <ImageIcon className="h-4 w-4" /> },
  { key: "filters", label: "Параметры", shortLabel: "Теги", icon: <SlidersHorizontal className="h-4 w-4" /> },
  { key: "link", label: "Ссылка", shortLabel: "URL", icon: <ExternalLink className="h-4 w-4" /> },
]

export function SessionDetailModal({ opportunity, category, open, onOpenChange }: SessionDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("info")

  if (!opportunity) return null

  const isExpired = opportunity.deadline ? new Date(opportunity.deadline) < new Date() : false

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

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
      <DialogContent className="max-w-lg sm:max-w-2xl p-0 gap-0 overflow-hidden bg-[#0d1210] border-gray-800 max-h-[90vh] rounded-2xl shadow-2xl shadow-emerald-500/5 [&>button]:hidden">
        <DialogTitle className="sr-only">{opportunity.title}</DialogTitle>
        <DialogDescription className="sr-only">Подробная информация о сеансе</DialogDescription>

        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-b from-[#0a1a14] to-[#0d1210]">
          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-gray-800/80 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors z-10"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="pr-10">
            <h2 className="text-xl font-bold leading-tight text-white text-balance">
              {opportunity.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              {opportunity.deadline && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-gray-500" />
                  <span className={`text-sm ${isExpired ? "text-red-400" : "text-gray-400"}`}>
                    {isExpired ? "Истёк: " : "Дедлайн: "}
                    {formatDate(opportunity.deadline)}
                  </span>
                </div>
              )}
              {opportunity.grant_available && (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/15">
                  <GraduationCap className="h-3 w-3 mr-1" />
                  Грант
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-gray-800 px-6">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? "text-emerald-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {activeTab === tab.key && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="overflow-y-auto max-h-[50vh] min-h-[200px]">
          {/* Info Tab */}
          {activeTab === "info" && (
            <div className="p-6">
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {opportunity.description || "Описание не указано."}
              </p>
            </div>
          )}

          {/* Photo Tab */}
          {activeTab === "photo" && (
            <div className="p-6">
              {opportunity.image_url ? (
                <div className="rounded-xl overflow-hidden border border-gray-800">
                  <img
                    src={opportunity.image_url}
                    alt={opportunity.title}
                    className="w-full h-auto object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="h-16 w-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                    <ImageIcon className="h-8 w-8 text-gray-600" />
                  </div>
                  <p className="text-sm">Фото не добавлено</p>
                </div>
              )}
            </div>
          )}

          {/* Filters Tab */}
          {activeTab === "filters" && (
            <div className="p-6">
              {activeFilters.length > 0 ? (
                <div className="grid gap-2.5">
                  {activeFilters.map((filter) => (
                    <div
                      key={filter.key}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/40 border border-gray-800"
                    >
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                        {FILTER_ICONS[filter.key] || <SlidersHorizontal className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 uppercase tracking-wider">{filter.label}</p>
                        <p className="text-sm font-medium text-gray-200 truncate">{filter.valueLabel}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="h-16 w-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                    <SlidersHorizontal className="h-8 w-8 text-gray-600" />
                  </div>
                  <p className="text-sm">Параметры не указаны</p>
                </div>
              )}
            </div>
          )}

          {/* Link Tab */}
          {activeTab === "link" && (
            <div className="p-6">
              {opportunity.link ? (
                <div className="space-y-4">
                  <div className="px-4 py-3 rounded-xl bg-gray-800/40 border border-gray-800">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Ссылка на источник</p>
                    <p className="text-sm text-emerald-400 break-all font-mono">{opportunity.link}</p>
                  </div>
                  <Button
                    asChild
                    className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl h-12 text-base"
                  >
                    <a href={opportunity.link} target="_blank" rel="noopener noreferrer">
                      Перейти на сайт
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                  <div className="h-16 w-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-4">
                    <ExternalLink className="h-8 w-8 text-gray-600" />
                  </div>
                  <p className="text-sm">Ссылка не указана</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
