import { OpportunitiesList } from "@/components/opportunities-list"
import { HeroSection } from "@/components/hero-section"
import { NotesWorkspace } from "@/components/notes-workspace"
import { AIAssistant } from "@/components/ai-assistant"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Fixed Header - transparent on hero, solid on scroll */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-white font-bold text-lg">P+</span>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">Portfolio+</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Возможности для молодёжи</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AIAssistant />
            <NotesWorkspace />
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href="/admin" className="gap-2">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Админ</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <HeroSection />

      {/* Opportunities Section */}
      <section id="opportunities" className="py-16 sm:py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <OpportunitiesList />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">P+</span>
              </div>
              <div>
                <div className="text-sm font-semibold">Portfolio+</div>
                <div className="text-xs text-muted-foreground">© 2026 Все права защищены</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground text-center md:text-right">
              Платформа возможностей для молодёжи Казахстана
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
