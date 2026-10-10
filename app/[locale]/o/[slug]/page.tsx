import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { JsonLd } from "@/components/json-ld"
import { OpportunityDetails } from "@/components/opportunity-details"
import { getDictionary } from "@/lib/i18n"
import { isEnabledLocale } from "@/lib/i18n/config"
import { format } from "@/lib/i18n/format"
import { opportunityMetadata } from "@/lib/metadata"
import { getOpportunity } from "@/lib/server-data"
import { SITE_URL, categoryPath, opportunityPath } from "@/lib/site"

type Props = { params: Promise<{ locale: string; slug: string }> }

// Not prebuilt at deploy (the list changes); each page is rendered on its
// first visit, then cached at the edge and refreshed at most once a minute.
export function generateStaticParams() {
  return []
}
export const revalidate = 60

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isEnabledLocale(locale)) return {}
  const opportunity = await getOpportunity(slug, locale)
  return opportunity ? opportunityMetadata(locale, opportunity) : {}
}

export default async function OpportunityPage({ params }: Props) {
  const { locale, slug } = await params
  if (!isEnabledLocale(locale)) notFound()
  const opportunity = await getOpportunity(slug, locale)
  if (!opportunity) notFound()

  const t = getDictionary(locale)
  const category = t.categories[opportunity.kind]
  const listPath = categoryPath(locale, opportunity.kind)

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href={listPath}
        className="inline-flex min-h-11 items-center gap-2 rounded-full pr-3 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {format(t.details.backTo, { category: category.label.toLowerCase() })}
      </Link>

      <div className="mt-4 rounded-2xl border border-emerald-500/10 bg-[#0d1210]/80 p-5 shadow-2xl shadow-emerald-500/5 sm:p-8">
        <OpportunityDetails opportunity={opportunity} />
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: t.meta.siteName, item: `${SITE_URL}/${locale}` },
            { "@type": "ListItem", position: 2, name: category.label, item: `${SITE_URL}${listPath}` },
            { "@type": "ListItem", position: 3, name: opportunity.title, item: `${SITE_URL}${opportunityPath(locale, slug)}` },
          ],
        }}
      />
    </div>
  )
}
