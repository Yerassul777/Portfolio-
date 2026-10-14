"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { BrandMark } from "@/components/brand-mark"
import { HeaderTools } from "@/components/header-tools"
import { InstallAppButton } from "@/components/install-app"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useI18n } from "@/components/i18n-provider"
import { useToday } from "@/components/today-provider"
import { format } from "@/lib/i18n/format"

function Logo({ small = false }: { small?: boolean }) {
  return (
    <span
      // The launch screen's coin lands here (lib/launch-screen.ts); globals.css
      // draws the socket it flies into.
      data-brand-logo={small ? undefined : ""}
      className={`brand-logo shrink-0 ${small ? "size-8" : "size-10"}`}
    >
      <BrandMark id={small ? "brand-mark-footer" : "brand-mark-header"} />
    </span>
  )
}

/**
 * Header, background and footer shared by every public page.
 *
 * A client component on purpose: app/[locale]/not-found.tsx is a client
 * boundary that wraps itself in this shell, and a shell that called
 * getDictionary() pulled every interface string into the JavaScript of every
 * page. Here the strings come from I18nProvider, which already has them.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  const { locale, t } = useI18n()
  const today = useToday()

  return (
    // overflow-x: clip — nothing can make a phone page wider than the screen
    // (and slide sideways), without breaking the sticky header as "hidden" would.
    <div className="relative min-h-svh overflow-x-clip bg-[#0a0f0d]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-emerald-950"
      >
        {t.header.skipToContent}
      </a>

      {/*
        Static background: one soft glow, top right, no animation and no grid.
        The glows are radial gradients, not blurred circles: a CSS blur filter
        this size has to be re-rasterised on phones whenever the viewport
        changes, which showed up as stutter on the first scroll. The layer is
        100lvh tall, so it does not resize when the mobile URL bar hides.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-lvh"
        style={{
          backgroundImage: [
            "radial-gradient(circle at 100% 0%, rgba(16,185,129,0.08), transparent 480px)",
            "linear-gradient(to bottom, #0a0f0d, #0d1a14, #0a0f0d)",
          ].join(","),
        }}
      />

      {/* backdrop-blur only from sm up: on phones it re-blurs the page under the header on every scroll frame. */}
      <header className="sticky top-[var(--app-titlebar-height)] z-40 border-b border-emerald-500/10 bg-[#0a0f0d] pt-[env(safe-area-inset-top)] sm:bg-[#0a0f0d]/80 sm:backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={`/${locale}`} title={t.header.home} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            <Logo />
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold text-white sm:text-xl">{t.meta.siteName}</span>
              <span className="hidden text-xs text-gray-400 sm:block">{t.header.tagline}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <HeaderTools />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="relative z-10 outline-none">
        {children}
      </main>

      <footer className="relative z-10 border-t border-emerald-500/10 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] app:pb-10">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <Logo small />
            <div>
              <div className="text-sm font-semibold text-white">{t.meta.siteName}</div>
              <div className="text-xs text-gray-400">{format(t.footer.rights, { year: today.slice(0, 4) })}</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 md:items-end">
            <p className="text-center text-sm text-gray-400 md:text-right">{t.footer.tagline}</p>
            <p className="text-center text-xs uppercase tracking-[0.2em] text-gray-400 md:text-right">
              {t.footer.madeBy} <span className="font-semibold text-emerald-300/90">Team KAYA</span>
            </p>
            <InstallAppButton />
          </div>
        </div>
      </footer>
    </div>
  )
}
