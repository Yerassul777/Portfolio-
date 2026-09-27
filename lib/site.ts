import type { Locale } from "@/lib/i18n/config"
import type { Category } from "@/lib/types"

// Absolute origin for canonical links, Open Graph and the sitemap. On Vercel
// the production domain comes from the platform; elsewhere set NEXT_PUBLIC_SITE_URL.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
  "http://localhost:3000"
).replace(/\/+$/, "")

// The first category is the home page itself: /ru, not /ru/olympiads.
export const DEFAULT_CATEGORY: Category = "olympiads"

export function categoryPath(locale: Locale, category: Category): string {
  return category === DEFAULT_CATEGORY ? `/${locale}` : `/${locale}/${category}`
}

export function opportunityPath(locale: Locale, slug: string): string {
  return `/${locale}/o/${slug}`
}

export function adminPath(locale: Locale): string {
  return `/${locale}/admin`
}
