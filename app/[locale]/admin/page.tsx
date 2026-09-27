import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { AdminForm } from "@/components/admin-form"
import { Button } from "@/components/ui/button"
import { isEnabledLocale } from "@/lib/i18n/config"

// The admin panel is an internal tool and stays in Russian.
export const metadata: Metadata = {
  title: "Админ-панель",
  robots: { index: false, follow: false },
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (!isEnabledLocale(locale)) notFound()

  return (
    <main className="min-h-dvh bg-background">
      <header className="border-b bg-card pt-[env(safe-area-inset-top)]">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href={`/${locale}`} aria-label="На сайт">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Админ-панель</h1>
            <p className="text-sm text-muted-foreground">Добавление и удаление возможностей</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-lg px-4 py-8">
        <AdminForm locale={locale} />
      </div>
    </main>
  )
}
