"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import { isPlainClick } from "@/components/category-nav"
import { useI18n } from "@/components/i18n-provider"
import { format } from "@/lib/i18n/format"
import { cn } from "@/lib/utils"

interface PaginationProps {
  page: number
  totalPages: number
  hrefFor: (page: number) => string
  onSelect: (page: number) => void
}

export function Pagination({ page, totalPages, hrefFor, onSelect }: PaginationProps) {
  const { t } = useI18n()
  if (totalPages <= 1) return null

  const link = (target: number, label: string, icon: "prev" | "next") => {
    const disabled = target < 1 || target > totalPages
    const className = cn(
      "inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-4 text-sm font-medium transition-colors",
      disabled
        ? "pointer-events-none border-transparent text-muted-foreground/40"
        : "border-border bg-card hover:border-primary/50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    )
    const content = (
      <>
        {icon === "prev" && <ChevronLeft aria-hidden="true" className="h-4 w-4" />}
        <span>{label}</span>
        {icon === "next" && <ChevronRight aria-hidden="true" className="h-4 w-4" />}
      </>
    )
    if (disabled) {
      return (
        <span aria-disabled="true" className={className}>
          {content}
        </span>
      )
    }
    return (
      <a
        href={hrefFor(target)}
        rel={icon}
        className={className}
        onClick={(event) => {
          if (!isPlainClick(event)) return
          event.preventDefault()
          onSelect(target)
        }}
      >
        {content}
      </a>
    )
  }

  return (
    <nav aria-label={t.pagination.label} className="flex items-center justify-center gap-3 pt-4">
      {link(page - 1, t.pagination.previous, "prev")}
      <span className="text-sm text-muted-foreground" aria-current="page">
        {format(t.pagination.status, { page, total: totalPages })}
      </span>
      {link(page + 1, t.pagination.next, "next")}
    </nav>
  )
}
