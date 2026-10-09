import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AdminReview } from "@/components/admin-review"
import { Button } from "@/components/ui/button"
import { isEnabledLocale } from "@/lib/i18n/config"

export const metadata: Metadata = {
  title: "Находки автопоиска",
  robots: { index: false, follow: false },
}

export default async function AdminReviewPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isEnabledLocale(locale)) notFound()

  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href={`/${locale}/admin`} aria-label="В админ-панель">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground">Автопоиск</h1>
            <p className="text-sm text-muted-foreground">Проверка находок, прогоны и источники</p>
          </div>
        </div>
      </header>
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <AdminReview locale={locale} />
      </div>
    </main>
  )
}
