"use client"

import { useState } from "react"
import { Loader2, Search } from "lucide-react"
import { useI18n } from "@/components/i18n-provider"
import { bestCategory, catalogueHref, countByCategory, currentCatalogueQuery } from "@/lib/catalogue"
import { MAX_QUERY_LENGTH } from "@/lib/search"
import { loadSupabase } from "@/lib/supabase-browser"

function scrollToCatalogue() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  document.getElementById("catalogue")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
}

/**
 * The search box on the home page's first screen. Search works inside one
 * category, so before showing results it checks where the words match: the
 * current category if anything matches there, otherwise the one with the most
 * matches. Then it writes the URL, which the catalogue below follows.
 */
export function HeroSearch() {
  const { locale, t } = useI18n()
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const q = value.trim().slice(0, MAX_QUERY_LENGTH)
    const current = currentCatalogueQuery()
    if (!q) {
      scrollToCatalogue()
      return
    }
    setBusy(true)
    let category = current.category
    try {
      category = bestCategory(await countByCategory(await loadSupabase(), q), current.category)
    } catch {
      // Offline or a failed request: search where we are.
    }
    const sameCategory = category === current.category
    window.history.pushState(
      null,
      "",
      catalogueHref(locale, {
        ...current,
        category,
        q,
        // Filters belong to a category; switching drops them.
        filters: sameCategory ? current.filters : {},
        page: 1,
        open: null,
      })
    )
    setBusy(false)
    // Let the catalogue render the new results before scrolling to them.
    requestAnimationFrame(scrollToCatalogue)
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      className="mx-auto flex w-full max-w-xl items-center gap-2 rounded-full border-2 border-emerald-500/25 bg-[#0d1a14]/80 p-1.5 pl-5 shadow-lg shadow-emerald-500/10 transition-colors focus-within:border-emerald-400/60"
    >
      <Search aria-hidden="true" className="h-5 w-5 shrink-0 text-emerald-400/80" />
      <label htmlFor="hero-search" className="sr-only">
        {t.catalogue.searchLabel}
      </label>
      <input
        id="hero-search"
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        maxLength={MAX_QUERY_LENGTH}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t.hero.searchPlaceholder}
        className="h-11 min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-gray-400"
      />
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 px-5 text-sm font-medium text-white transition-[transform,opacity] hover:from-emerald-600 hover:to-green-700 active:scale-[0.97] disabled:opacity-70 sm:px-7"
      >
        {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {t.hero.searchButton}
      </button>
    </form>
  )
}
