"use client"

import Link from "next/link"
import type { ReactNode } from "react"
import { HeaderTools } from "@/components/header-tools"
import { InstallAppButton } from "@/components/install-app"
import { useI18n } from "@/components/i18n-provider"
import { format } from "@/lib/i18n/format"

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

  return (
    <div className="relative min-h-svh bg-[#0a0f0d]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-emerald-950"
      >
        {t.header.skipToContent}
      </a>

      {/*
        Static background: two soft glows and a faint grid, no animation.
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
            "radial-gradient(circle at 100% 0%, rgba(16,185,129,0.07), transparent 480px)",
            "radial-gradient(circle at 0% 100%, rgba(5,150,105,0.06), transparent 420px)",
            "linear-gradient(to bottom, #0a0f0d, #0d1a14, #0a0f0d)",
          ].join(","),
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* backdrop-blur only from sm up: on phones it re-blurs the page under the header on every scroll frame. */}
      <header className="sticky top-0 z-40 border-b border-emerald-500/10 bg-[#0a0f0d] pt-[env(safe-area-inset-top)] sm:bg-[#0a0f0d]/80 sm:backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={`/${locale}`} title={t.header.home} className="flex min-h-11 min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            <Logo />
            <span className="min-w-0">
              <span className="block truncate text-lg font-bold text-white sm:text-xl">{t.meta.siteName}</span>
              <span className="hidden text-xs text-gray-400 sm:block">{t.header.tagline}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
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
              <div className="text-xs text-gray-400">{format(t.footer.rights, { year: new Date().getFullYear() })}</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 md:items-end">
            <p className="text-center text-sm text-gray-400 md:text-right">{t.footer.tagline}</p>
            <InstallAppButton />
          </div>
        </div>
      </footer>
    </div>
  )
}
