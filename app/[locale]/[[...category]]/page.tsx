import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Catalogue } from "@/components/catalogue"
import { HeroSection } from "@/components/hero-section"
import { JsonLd } from "@/components/json-ld"
import { isCategory, isRefined, parseCatalogueQuery, type CatalogueQuery } from "@/lib/catalogue"
import { getDictionary } from "@/lib/i18n"
import { isEnabledLocale, type Locale } from "@/lib/i18n/config"
import { opportunityMetadata } from "@/lib/metadata"
import { getCataloguePage, getHighlights, getOpportunity } from "@/lib/server-data"
import { DEFAULT_CATEGORY, SITE_URL, categoryPath, opportunityPath } from "@/lib/site"

type Props = {
  params: Promise<{ locale: string; category?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function resolve({ params, searchParams }: Props): Promise<{ locale: Locale; query: CatalogueQuery }> {
  const { locale, category: segments } = await params
  if (!isEnabledLocale(locale)) notFound()
  const category = segments?.[0] && isCategory(segments[0]) ? segments[0] : DEFAULT_CATEGORY
  return { locale, query: parseCatalogueQuery(category, await searchParams) }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, query } = await resolve(props)
  const t = getDictionary(locale)

  // ?o=<slug> is the in-page dialog: a copied URL should preview that item.
  if (query.open) {
    const opportunity = await getOpportunity(query.open)
    if (opportunity) return opportunityMetadata(locale, opportunity)
  }

  const isHome = query.category === DEFAULT_CATEGORY
  const copy = t.categories[query.category]
  const path = categoryPath(locale, query.category)
  return {
    title: isHome ? { absolute: t.meta.title } : copy.title,
    description: isHome ? t.meta.description : copy.description,
    // Filtered, searched and paged views are the same page for search engines.
    alternates: { canonical: path },
    robots: isRefined(query) ? { index: false, follow: true } : undefined,
    openGraph: {
      url: path,
      title: isHome ? t.meta.title : copy.title,
      description: isHome ? t.meta.description : copy.description,
      // A page-level openGraph object replaces the inherited one, image included.
      images: [{ url: `/${locale}/opengraph-image`, width: 1200, height: 630, alt: t.meta.title }],
    },
  }
}

export default async function CataloguePage(props: Props) {
  const { locale, query } = await resolve(props)
  const t = getDictionary(locale)
  const compact = query.category !== DEFAULT_CATEGORY || isRefined(query) || query.open !== null
  const [page, open, highlights] = await Promise.all([
    getCataloguePage(query),
    query.open ? getOpportunity(query.open) : Promise.resolve(null),
    compact ? Promise.resolve(null) : getHighlights(),
  ])

  return (
    <>
      <HeroSection locale={locale} t={t} compact={compact} highlights={highlights} />
      <Catalogue initialQuery={query} initialPage={page} initialOpen={open} />
      {page && page.items.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: t.categories[query.category].title,
            itemListElement: page.items.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              url: `${SITE_URL}${opportunityPath(locale, item.slug)}`,
              name: item.title,
            })),
          }}
        />
      )}
    </>
  )
}
