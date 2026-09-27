import { formatDeadline } from "@/lib/deadline"
import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE, HTML_LANG, isEnabledLocale } from "@/lib/i18n/config"
import { OG_SIZE, renderOgCard } from "@/lib/og"
import { getOpportunity } from "@/lib/server-data"

export const size = OG_SIZE
export const contentType = "image/png"
export const alt = "Portfolio+"

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: raw, slug } = await params
  const locale = isEnabledLocale(raw) ? raw : DEFAULT_LOCALE
  const t = getDictionary(locale)
  const opportunity = await getOpportunity(slug)

  if (!opportunity) {
    return renderOgCard({ eyebrow: t.hero.badge, title: t.meta.title, site: t.meta.siteName })
  }

  return renderOgCard({
    eyebrow: t.categories[opportunity.kind].label,
    title: opportunity.title,
    footer: opportunity.deadline
      ? `${t.details.deadline}: ${formatDeadline(opportunity.deadline, "long", HTML_LANG[locale])}`
      : t.footer.tagline,
    site: t.meta.siteName,
  })
}
