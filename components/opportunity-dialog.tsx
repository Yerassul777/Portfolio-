"use client"

import Link from "next/link"
import { ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useI18n } from "@/components/i18n-provider"
import { OpportunityDetails } from "@/components/opportunity-details"
import { opportunityPath } from "@/lib/site"
import type { Opportunity } from "@/lib/types"

interface OpportunityDialogProps {
  open: boolean
  /** undefined while loading, null when the slug matched nothing. */
  opportunity: Opportunity | null | undefined
  onClose: () => void
}

export function OpportunityDialog({ open, opportunity, onClose }: OpportunityDialogProps) {
  const { locale, t } = useI18n()

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        sheetOnMobile
        closeLabel={t.details.close}
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden rounded-2xl border-gray-800 bg-[#0d1210] p-0 shadow-2xl shadow-emerald-500/5 sm:max-w-2xl"
      >
        <DialogDescription className="sr-only">{t.details.dialogDescription}</DialogDescription>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pt-14 sm:p-8 sm:pt-12">
          {opportunity ? (
            <OpportunityDetails
              opportunity={opportunity}
              titleAs={DialogTitle}
              actions={
                <Button asChild variant="ghost" className="h-12 gap-2 rounded-xl text-muted-foreground">
                  <Link href={opportunityPath(locale, opportunity.slug)}>
                    <ExternalLink className="h-4 w-4" />
                    {t.details.openPage}
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-sm text-muted-foreground">
              <DialogTitle className="sr-only">{t.details.dialogDescription}</DialogTitle>
              {opportunity === undefined ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                  {t.details.loading}
                </>
              ) : (
                t.details.notFound
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
