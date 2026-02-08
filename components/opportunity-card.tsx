import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ExternalLink, MapPin, Monitor, GraduationCap } from "lucide-react"
import type { Opportunity } from "@/lib/types"
import { KAZAKHSTAN_CITIES } from "@/lib/types"

interface OpportunityCardProps {
  opportunity: Opportunity
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const isExpired = opportunity.deadline ? new Date(opportunity.deadline) < new Date() : false
  const hasImage = !!opportunity.image_url

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const getCityLabel = (cityValue: string | null | undefined) => {
    if (!cityValue) return null
    const city = KAZAKHSTAN_CITIES.find(c => c.value === cityValue)
    return city?.label || cityValue
  }

  const getFormatLabel = (format: string | null | undefined) => {
    if (!format) return null
    const formats: Record<string, string> = {
      'online': 'Онлайн',
      'offline': 'Офлайн',
      'hybrid': 'Гибридный',
      'part-time': 'Заочное',
    }
    return formats[format] || format
  }

  const cityLabel = getCityLabel(opportunity.city)
  const formatLabel = getFormatLabel(opportunity.format)

  return (
    <Card className="group flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 border-2 hover:border-primary/20 overflow-hidden rounded-xl">
      {/* Image Section */}
      {hasImage && (
        <div className="relative h-48 overflow-hidden">
          <img 
            src={opportunity.image_url || ""} 
            alt={opportunity.title}
            className="object-cover w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />
          
          {/* Floating badges on image */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            {opportunity.grant_available && (
              <Badge className="bg-primary/90 text-primary-foreground border-0 shadow-lg backdrop-blur-sm">
                <GraduationCap className="h-3 w-3 mr-1" />
                Грант
              </Badge>
            )}
          </div>
          
          {/* Title overlay on image */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <CardTitle className="text-lg font-bold leading-tight text-foreground drop-shadow-sm line-clamp-2">
              {opportunity.title}
            </CardTitle>
          </div>
        </div>
      )}

      <CardHeader className={hasImage ? "pt-3 pb-2" : "pb-3"}>
        {!hasImage && (
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg font-semibold leading-tight text-balance line-clamp-2">
              {opportunity.title}
            </CardTitle>
            {opportunity.grant_available && (
              <Badge className="shrink-0 bg-primary/10 text-primary border-primary/20">
                <GraduationCap className="h-3 w-3 mr-1" />
                Грант
              </Badge>
            )}
          </div>
        )}
        
        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {cityLabel && (
            <Badge variant="outline" className="text-xs gap-1 font-normal bg-background/80 backdrop-blur-sm">
              <MapPin className="h-3 w-3" />
              {cityLabel}
            </Badge>
          )}
          {formatLabel && (
            <Badge variant="outline" className="text-xs gap-1 font-normal bg-background/80 backdrop-blur-sm">
              <Monitor className="h-3 w-3" />
              {formatLabel}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1">
        <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3">
          {opportunity.description}
        </p>
      </CardContent>
      
      <CardFooter className="flex items-center justify-between pt-4 border-t gap-2">
        {opportunity.deadline ? (
          <Badge 
            variant={isExpired ? "destructive" : "secondary"} 
            className={`gap-1 ${!isExpired && "bg-primary/10 text-primary border-primary/20"}`}
          >
            <Calendar className="h-3 w-3" />
            {formatDate(opportunity.deadline)}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Без дедлайна</Badge>
        )}
        <Button asChild size="sm" className="gap-1.5 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <a href={opportunity.link} target="_blank" rel="noopener noreferrer">
            Подробнее
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  )
}
