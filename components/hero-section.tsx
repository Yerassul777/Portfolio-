import type { Dictionary } from "@/lib/i18n"

interface HeroSectionProps {
  t: Dictionary
  /**
   * Short version for category pages and shared links with filters, so a
   * visitor arriving from a link lands on the results, not on a splash screen.
   */
  compact?: boolean
}

export function HeroSection({ t, compact = false }: HeroSectionProps) {
  return (
    <section
      className={`relative flex items-center justify-center overflow-hidden ${
        compact ? "py-12 sm:py-16" : "min-h-[calc(100dvh-4.5rem)] py-16"
      }`}
    >
      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0f0d] via-[#0d1a14] to-[#0f261c]" />
        <div className="absolute right-[10%] top-[15%] h-[420px] w-[420px] rounded-full bg-emerald-500/10 blur-[110px]" />
        <div className="absolute bottom-[10%] left-[10%] h-[360px] w-[360px] rounded-full bg-emerald-600/[0.07] blur-[110px]" />
      </div>

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`mx-auto max-w-5xl text-center ${compact ? "space-y-5" : "space-y-10"}`}>
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700">
            {t.hero.badge}
          </p>

          <div className={`motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-1000 ${compact ? "space-y-3" : "space-y-6"}`}>
            <h1
              className={`font-bold tracking-tight ${
                compact ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl lg:text-7xl xl:text-8xl"
              }`}
            >
              <span className="text-white">{t.hero.titleLine1}</span>
              {compact ? " " : <br />}
              <span className="bg-gradient-to-r from-emerald-400 via-green-400 to-emerald-500 bg-clip-text text-transparent">
                {t.hero.titleLine2}
              </span>
            </h1>
            <p
              className={`mx-auto max-w-3xl text-balance leading-relaxed text-gray-400 ${
                compact ? "text-base sm:text-lg" : "text-lg sm:text-xl lg:text-2xl"
              }`}
            >
              {t.hero.subtitle}
            </p>
          </div>

          {!compact && (
            <a
              href="#catalogue"
              className="inline-flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-8 text-base font-medium text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:scale-105 hover:shadow-emerald-500/40 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/40 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-1000"
            >
              {t.hero.cta}
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
