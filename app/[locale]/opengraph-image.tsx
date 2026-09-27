import { getDictionary } from "@/lib/i18n"
import { DEFAULT_LOCALE, isEnabledLocale } from "@/lib/i18n/config"
import { OG_SIZE, renderOgCard } from "@/lib/og"

export const size = OG_SIZE
export const contentType = "image/png"
export const alt = "Portfolio+"

// The site-wide link preview: home and category pages.
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params
  const t = getDictionary(isEnabledLocale(raw) ? raw : DEFAULT_LOCALE)
  return renderOgCard({
    eyebrow: t.hero.badge,
    title: `${t.hero.titleLine1} ${t.hero.titleLine2}`,
    footer: Object.values(t.categories).map((c) => c.label).join(" · "),
    site: t.meta.siteName,
  })
}
