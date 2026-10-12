"use client"

import { useEffect, useRef, useState } from "react"
import { Check, Globe } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { ENABLED_LOCALES, LOCALE_NAMES, LOCALE_SHORT, type Locale } from "@/lib/i18n/config"

/** How long the choice is remembered (the "/" redirect reads it; next.config.mjs). */
const ONE_YEAR = 60 * 60 * 24 * 365

function choose(next: Locale) {
  document.cookie = `locale=${next}; path=/; max-age=${ONE_YEAR}; samesite=lax`
  const { pathname, search, hash } = window.location
  const rest = pathname.replace(/^\/[^/]+/, "")
  window.location.assign(`/${next}${rest}${search}${hash}`)
}

/**
 * RU / KZ / EN. A small menu in the site's own colours (the browser's
 * built-in list is white and cannot be styled). The same page opens in the
 * other language, with its filters and search kept; the choice is remembered
 * in a cookie so that the next visit to "/" (and the installed app) starts
 * there. Tab and arrow keys, Escape and a tap outside work as in any menu.
 */
export function LanguageSwitcher() {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const items = () => [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [])]
    items().find((item) => item.getAttribute("aria-checked") === "true")?.focus()
    const close = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        button.current?.focus()
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const list = items()
        const at = list.indexOf(document.activeElement as HTMLElement)
        const step = event.key === "ArrowDown" ? 1 : -1
        list[(at + step + list.length) % list.length]?.focus()
      }
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={button}
        type="button"
        aria-label={t.language.label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={`flex size-11 items-center justify-center rounded-full border text-gray-300 transition-colors hover:border-emerald-500/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:h-9 sm:w-auto sm:gap-1.5 sm:px-3 ${
          open ? "border-emerald-500/60 bg-emerald-500/10 text-white" : "border-gray-700"
        }`}
      >
        <Globe aria-hidden="true" className="h-4 w-4 sm:hidden" />
        <span aria-hidden="true" className="hidden text-xs font-semibold sm:inline">
          {LOCALE_SHORT[locale]}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={t.language.label}
          className="absolute right-0 top-full z-50 mt-2 min-w-40 overflow-hidden rounded-xl border border-emerald-500/20 bg-[#0d1a14] p-1 shadow-xl shadow-black/50"
        >
          {ENABLED_LOCALES.map((code) => {
            const selected = code === locale
            return (
              <button
                key={code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                lang={code === "kz" ? "kk" : code}
                onClick={() => (selected ? setOpen(false) : choose(code))}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm transition-colors focus-visible:outline-none ${
                  selected
                    ? "bg-emerald-500/15 font-medium text-emerald-300"
                    : "text-gray-200 hover:bg-emerald-500/10 hover:text-white focus-visible:bg-emerald-500/10 focus-visible:text-white"
                }`}
              >
                {LOCALE_NAMES[code]}
                {selected && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
