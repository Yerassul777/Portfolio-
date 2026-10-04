import type { ReactNode } from "react"
import { notFound } from "next/navigation"
import { SiteShell } from "@/components/site-shell"
import { isEnabledLocale } from "@/lib/i18n/config"
import { getOpportunity } from "@/lib/server-data"

// The existence check lives here, above loading.tsx, so an unknown slug is a
// real 404 response. getOpportunity is cached, so the page reuses this read.
export default async function OpportunityLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string; slug: string }>
}) {
  const { locale, slug } = await params
  if (!isEnabledLocale(locale)) notFound()
  if (!(await getOpportunity(slug))) notFound()
  return <SiteShell>{children}</SiteShell>
}
