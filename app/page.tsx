import { OpportunitiesList } from "@/components/opportunities-list"
import { HeroSection } from "@/components/hero-section"
import { NotesWorkspace } from "@/components/notes-workspace"
import { AIAssistant } from "@/components/ai-assistant"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen relative bg-[#0a0f0d]">
      {/* Global gradient background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f0d] via-[#0d1a14] to-[#0a0f0d]" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/[0.04] rounded-full blur-[200px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-600/[0.03] rounded-full blur-[180px]" />
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-emerald-500/10 bg-[#0a0f0d]/80 backdrop-blur-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <span className="text-white font-bold text-lg">P+</span>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white">Portfolio+</h1>
              <p className="text-xs text-gray-400 hidden sm:block">Возможности для молодёжи</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AIAssistant />
            <NotesWorkspace />
            <Button asChild variant="outline" size="sm" className="rounded-full border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800/50 hover:text-white hover:border-emerald-500/50">
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
      <section id="opportunities" className="relative z-10 py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <OpportunitiesList />
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-emerald-500/10 py-12">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">P+</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Portfolio+</div>
                <div className="text-xs text-gray-400">© 2026 Все права защищены</div>
              </div>
            </div>
            <div className="text-sm text-gray-400 text-center md:text-right">
              Платформа возможностей для молодёжи Казахстана
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
