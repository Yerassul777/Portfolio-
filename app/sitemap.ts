import type { MetadataRoute } from "next"
import { ENABLED_LOCALES } from "@/lib/i18n/config"
import { SITE_URL, categoryPath, opportunityPath } from "@/lib/site"
import { createPublicClient } from "@/lib/supabase-server"
import { CATEGORIES } from "@/lib/types"

// Rebuilt at most hourly; new opportunities appear without a deploy.
export const revalidate = 3600

const BATCH = 1000

async function publishedOpportunities(): Promise<{ slug: string; updated_at: string }[]> {
  const client = createPublicClient()
  if (!client) return []
  const rows: { slug: string; updated_at: string }[] = []
  // RLS returns published rows only.
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await client
      .from("opportunities")
      .select("slug, updated_at")
      .order("created_at", { ascending: true })
      .range(from, from + BATCH - 1)
    if (error) {
      console.error("Sitemap: loading opportunities failed:", error)
      return rows
    }
    rows.push(...data)
    if (data.length < BATCH) return rows
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const opportunities = await publishedOpportunities()
  return ENABLED_LOCALES.flatMap((locale) => [
    ...CATEGORIES.map((category) => ({
      url: `${SITE_URL}${categoryPath(locale, category)}`,
      changeFrequency: "daily" as const,
      priority: category === CATEGORIES[0] ? 1 : 0.8,
    })),
    ...opportunities.map((o) => ({
      url: `${SITE_URL}${opportunityPath(locale, o.slug)}`,
      lastModified: new Date(o.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ])
}
