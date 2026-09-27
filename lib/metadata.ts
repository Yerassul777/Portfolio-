import type { Metadata } from "next"
import type { Locale } from "@/lib/i18n/config"
import { OG_LOCALE } from "@/lib/i18n/config"
import { getDictionary } from "@/lib/i18n"
import { opportunityPath } from "@/lib/site"
import type { Opportunity } from "@/lib/types"

const DESCRIPTION_LENGTH = 160

export function excerpt(text: string, length = DESCRIPTION_LENGTH): string {
  const flat = text.replace(/\s+/g, " ").trim()
  if (flat.length <= length) return flat
  const cut = flat.slice(0, length - 1)
  return `${cut.slice(0, cut.lastIndexOf(" ") > length * 0.6 ? cut.lastIndexOf(" ") : cut.length)}…`
}

/** Title, description, canonical and link-preview card for one opportunity. */
export function opportunityMetadata(locale: Locale, opportunity: Opportunity): Metadata {
  const t = getDictionary(locale)
  const path = opportunityPath(locale, opportunity.slug)
  const description = excerpt(opportunity.description || t.categories[opportunity.kind].description)
  return {
    title: opportunity.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: path,
      title: opportunity.title,
      description,
      locale: OG_LOCALE[locale],
      siteName: t.meta.siteName,
      // Rendered by app/[locale]/o/[slug]/opengraph-image.tsx. Named explicitly so
      // the catalogue's ?o=<slug> URLs preview the same card.
      images: [{ url: `${path}/opengraph-image`, width: 1200, height: 630, alt: opportunity.title }],
    },
    twitter: { card: "summary_large_image", title: opportunity.title, description },
  }
}
