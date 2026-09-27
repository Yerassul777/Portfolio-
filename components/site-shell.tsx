import Link from "next/link"
import type { ReactNode } from "react"
import { AIAssistant } from "@/components/ai-assistant"
import { NotesWorkspace } from "@/components/notes-workspace"
import { getDictionary } from "@/lib/i18n"
import { format } from "@/lib/i18n/format"
import type { Locale } from "@/lib/i18n/config"

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-emerald-500 to-green-600 font-bold text-white shadow-lg shadow-emerald-500/20 ${
        small ? "h-8 w-8 rounded-lg text-sm" : "h-10 w-10 rounded-xl text-lg"
      }`}
    >
      P+
    </span>
  )
}

/** Header, background and footer shared by every public page. */
export function SiteShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = getDictionary(locale)

  return (
    <div className="relative min-h-dvh bg-[#0a0f0d]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-emerald-950"
      >
        {t.header.skipToContent}
      </a>

      {/* Static background: two soft glows and a faint grid, no animation. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f0d] via-[#0d1a14] to-[#0a0f0d]" />
        <div className="absolute -right-40 -top-40 h-[640px] w-[640px] rounded-full bg-emerald-500/[0.05] blur-[140px]" />
        <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-emerald-600/[0.04] blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-emerald-500/10 bg-[#0a0f0d]/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={`/${locale}`} title={t.header.home} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            <Logo />
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold text-white sm:text-xl">{t.meta.siteName}</span>
              <span className="hidden text-xs text-gray-400 sm:block">{t.header.tagline}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <AIAssistant />
            <NotesWorkspace />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="relative z-10 outline-none">
        {children}
      </main>

      <footer className="relative z-10 border-t border-emerald-500/10 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Logo small />
            <div>
              <div className="text-sm font-semibold text-white">{t.meta.siteName}</div>
              <div className="text-xs text-gray-400">{format(t.footer.rights, { year: new Date().getFullYear() })}</div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-400 md:text-right">{t.footer.tagline}</p>
        </div>
      </footer>
    </div>
  )
}
