import type { ReactNode } from "react"
import { notFound, permanentRedirect } from "next/navigation"
import { SiteShell } from "@/components/site-shell"
import { isCategory } from "@/lib/catalogue"
import { isEnabledLocale } from "@/lib/i18n/config"
import { DEFAULT_CATEGORY, categoryPath } from "@/lib/site"

// Validation happens here, above loading.tsx, so a bad URL is a real 404 (or
// redirect) before any streaming starts rather than a 200 with an error page.
export default async function CategoryLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string; category?: string[] }>
}) {
  const { locale, category } = await params
  if (!isEnabledLocale(locale)) notFound()
  if (category && (category.length > 1 || !isCategory(category[0]))) notFound()
  // The default category is the home page: one URL per page.
  if (category?.[0] === DEFAULT_CATEGORY) permanentRedirect(categoryPath(locale, DEFAULT_CATEGORY))
  return <SiteShell>{children}</SiteShell>
}
