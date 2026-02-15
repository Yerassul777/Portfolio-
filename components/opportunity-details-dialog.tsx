"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  ExternalLink, 
  FileText, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Filter,
  Calendar,
  MapPin,
  Monitor,
  GraduationCap,
  Trophy,
  Users,
  Clock,
  Heart,
  Zap,
  Building,
  Wallet,
  Clipboard,
  BookOpen
} from "lucide-react"
import type { Opportunity, Category } from "@/lib/types"
import { KAZAKHSTAN_CITIES, FILTER_CONFIGS } from "@/lib/types"

interface OpportunityDetailsDialogProps {
  opportunity: Opportunity
  category: Category
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OpportunityDetailsDialog({ 
  opportunity, 
  category,
  open, 
  onOpenChange 
}: OpportunityDetailsDialogProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const getFilterLabel = (key: keyof Opportunity, value: string | null | undefined | boolean) => {
    if (!value) return null
    
    const config = FILTER_CONFIGS[category].find(f => f.key === key)
    if (!config) return null

    // Handle boolean values (grant_available)
    if (typeof value === 'boolean') {
      return value ? 'Да' : 'Нет'
    }

    const option = config.options.find(o => o.value === String(value))
    return option?.label || String(value)
  }

  const getCityLabel = (cityValue: string | null | undefined) => {
    if (!cityValue) return null
    const city = KAZAKHSTAN_CITIES.find(c => c.value === cityValue)
    return city?.label || cityValue
  }

  const getIconForKey = (key: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      subject: <BookOpen className="h-4 w-4" />,
      level: <Trophy className="h-4 w-4" />,
      type: <Zap className="h-4 w-4" />,
      age_group: <Users className="h-4 w-4" />,
      format: <Monitor className="h-4 w-4" />,
      duration: <Clock className="h-4 w-4" />,
      city: <MapPin className="h-4 w-4" />,
      field: <GraduationCap className="h-4 w-4" />,
      requirements: <Clipboard className="h-4 w-4" />,
      grant_available: <Wallet className="h-4 w-4" />,
    }
    return iconMap[key] || <Filter className="h-4 w-4" />
  }

  // Collect all active filters
  const activeFilters = FILTER_CONFIGS[category]
    .map(config => ({
      key: config.key,
      label: config.label,
      value: opportunity[config.key],
      displayValue: config.key === 'city' 
        ? getCityLabel(opportunity[config.key] as string)
        : getFilterLabel(config.key, opportunity[config.key])
    }))
    .filter(f => f.value !== null && f.value !== undefined)

  const isExpired = opportunity.deadline ? new Date(opportunity.deadline) < new Date() : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-2xl font-bold leading-tight pr-8 text-balance">
            {opportunity.title}
          </DialogTitle>
          <div className="flex flex-wrap gap-2 mt-3">
            {opportunity.grant_available && (
              <Badge className="bg-primary/90 text-primary-foreground">
                <GraduationCap className="h-3 w-3 mr-1" />
                Грант доступен
              </Badge>
            )}
            {opportunity.deadline && (
              <Badge 
                variant={isExpired ? "destructive" : "secondary"}
                className={`gap-1 ${!isExpired && "bg-primary/10 text-primary border-primary/20"}`}
              >
                <Calendar className="h-3 w-3" />
                {formatDate(opportunity.deadline)}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="description" className="flex-1">
          <div className="border-b px-6">
            <TabsList className="grid w-full grid-cols-4 h-12">
              <TabsTrigger value="description" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Описание</span>
              </TabsTrigger>
              {opportunity.image_url && (
                <TabsTrigger value="image" className="gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Фото</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="link" className="gap-2">
                <LinkIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Ссылка</span>
              </TabsTrigger>
              <TabsTrigger value="filters" className="gap-2">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">Детали</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="h-[50vh]">
            <TabsContent value="description" className="px-6 py-6 m-0">
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                  {opportunity.description}
                </p>
              </div>
            </TabsContent>

            {opportunity.image_url && (
              <TabsContent value="image" className="px-6 py-6 m-0">
                <div className="flex flex-col items-center gap-4">
                  <img 
                    src={opportunity.image_url} 
                    alt={opportunity.title}
                    className="w-full max-w-2xl rounded-lg shadow-lg object-cover"
                  />
                </div>
              </TabsContent>
            )}

            <TabsContent value="link" className="px-6 py-6 m-0">
              <div className="flex flex-col items-center justify-center gap-6 py-8">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <ExternalLink className="h-8 w-8 text-primary" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">Перейти на сайт</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Нажмите кнопку ниже, чтобы открыть внешнюю ссылку в новой вкладке
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3 w-full max-w-md">
                  <Button asChild size="lg" className="w-full gap-2">
                    <a href={opportunity.link} target="_blank" rel="noopener noreferrer">
                      Открыть ссылку
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <div className="text-xs text-muted-foreground break-all px-4">
                    {opportunity.link}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="filters" className="px-6 py-6 m-0">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                  <Filter className="h-5 w-5 text-primary" />
                  Параметры и характеристики
                </h3>
                <div className="grid gap-3">
                  {activeFilters.map((filter) => (
                    <div 
                      key={filter.key} 
                      className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border"
                    >
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        {getIconForKey(filter.key)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-muted-foreground mb-1">
                          {filter.label}
                        </div>
                        <div className="text-base font-semibold">
                          {filter.displayValue}
                        </div>
                      </div>
                    </div>
                  ))}
                  {activeFilters.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      Дополнительные параметры не указаны
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
