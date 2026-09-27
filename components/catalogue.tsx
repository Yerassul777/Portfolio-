"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Search, SearchX, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { CategoryNav } from "@/components/category-nav"
import { FilterDialog } from "@/components/filter-dialog"
import { useI18n } from "@/components/i18n-provider"
import { OpportunityCard } from "@/components/opportunity-card"
import { OpportunityDialog } from "@/components/opportunity-dialog"
import { Pagination } from "@/components/pagination"
import { QuickFilters } from "@/components/quick-filters"
import {
  PAGE_SIZE,
  activeFilterCount,
  catalogueHref,
  catalogueKey,
  fetchCataloguePage,
  fetchOpportunityBySlug,
  isCategory,
  parseCatalogueQuery,
  type CatalogueQuery,
  type CataloguePage,
  type SortOrder,
} from "@/lib/catalogue"
import { plural } from "@/lib/i18n/format"
import { MAX_QUERY_LENGTH } from "@/lib/search"
import { DEFAULT_CATEGORY } from "@/lib/site"
import { loadSupabase } from "@/lib/supabase-browser"
import { QUICK_FILTERS, type Category, type Filters, type Opportunity } from "@/lib/types"
import { cn } from "@/lib/utils"

const SEARCH_DEBOUNCE_MS = 350

function categoryFromPath(pathname: string): Category {
  const segment = pathname.split("/")[2]
  return segment && isCategory(segment) ? segment : DEFAULT_CATEGORY
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

interface CatalogueProps {
  /** What the server rendered, so the first paint needs no request. */
  initialQuery: CatalogueQuery
  initialPage: CataloguePage | null
  initialOpen: Opportunity | null
}

/**
 * The catalogue. Its whole state lives in the URL (see CatalogueQuery), so
 * every view is a link and Back works. Changes go through history.pushState,
 * which Next.js syncs into usePathname/useSearchParams without a server round
 * trip; data then comes straight from Supabase in the browser.
 */
export function Catalogue({ initialQuery, initialPage, initialOpen }: CatalogueProps) {
  const { locale, t } = useI18n()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const category = categoryFromPath(pathname)
  const query = useMemo(() => parseCatalogueQuery(category, searchParams), [category, searchParams])
  const topRef = useRef<HTMLDivElement>(null)

  const go = useCallback(
    (next: CatalogueQuery, { replace = false, scroll = false } = {}) => {
      window.history[replace ? "replaceState" : "pushState"](null, "", catalogueHref(locale, next))
      if (scroll) topRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" })
    },
    [locale]
  )

  // Anything that changes the result set starts again from page 1.
  const refine = useCallback(
    (patch: Partial<CatalogueQuery>, options?: { replace?: boolean }) =>
      go({ ...query, ...patch, page: 1, open: null }, options),
    [go, query]
  )

  // --- search box: typed text is local, the URL follows after a pause -------
  const [draft, setDraft] = useState(query.q)
  const [seenQ, setSeenQ] = useState(query.q)
  const [committedQ, setCommittedQ] = useState<string | null>(null)
  if (seenQ !== query.q) {
    // The URL's query changed. If it is the write we just made, the user may
    // already be typing on: leave the box alone, and forget the write so a
    // later Back/Forward to the same text still counts as external. Anything
    // else (Back, Forward, a reset link) puts the URL's text in the box.
    setSeenQ(query.q)
    if (query.q === committedQ) setCommittedQ(null)
    else setDraft(query.q)
  }

  const commitSearch = useCallback(
    (value: string) => {
      const q = value.trim().slice(0, MAX_QUERY_LENGTH)
      if (q === query.q) return
      setCommittedQ(q)
      refine({ q }, { replace: true })
    },
    [query.q, refine]
  )

  useEffect(() => {
    if (draft.trim() === query.q) return
    const timer = setTimeout(() => commitSearch(draft), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [draft, query.q, commitSearch])

  // --- data -------------------------------------------------------------------
  const key = catalogueKey(query)
  const [initialKey] = useState(() => catalogueKey(initialQuery))
  const hasInitial = key === initialKey && initialPage !== null
  const { data, error, isValidating, mutate } = useSWR(
    ["catalogue", key],
    async () => fetchCataloguePage(await loadSupabase(), query),
    {
      fallbackData: hasInitial ? initialPage : undefined,
      revalidateOnMount: !hasInitial,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    }
  )
  const updating = isValidating && !!data

  // --- detail dialog, driven by ?o=<slug> ---------------------------------------
  const listed = query.open ? data?.items.find((item) => item.slug === query.open) : undefined
  const [initialOpenItem] = useState(initialOpen)
  const { data: fetchedOpen } = useSWR(
    query.open && !listed ? ["opportunity", query.open] : null,
    async ([, slug]) => fetchOpportunityBySlug(await loadSupabase(), slug),
    {
      fallbackData: initialOpenItem && initialOpenItem.slug === query.open ? initialOpenItem : undefined,
      revalidateOnFocus: false,
    }
  )
  const openItem = query.open ? (listed ?? fetchedOpen) : null

  // Opened by a click here: closing goes Back, so the history has no dead entry.
  // Opened from a shared link: closing just drops ?o= from the URL.
  const [openedHere, setOpenedHere] = useState(false)
  const openDetails = (opportunity: Opportunity) => {
    setOpenedHere(true)
    go({ ...query, open: opportunity.slug })
  }
  const closeDetails = () => {
    if (openedHere) {
      setOpenedHere(false)
      window.history.back()
    } else {
      go({ ...query, open: null }, { replace: true })
    }
  }

  // pushState does not touch <title>; keep it in step with what is on screen.
  useEffect(() => {
    const site = t.meta.siteName
    document.title = openItem
      ? `${openItem.title} — ${site}`
      : category === DEFAULT_CATEGORY
        ? t.meta.title
        : `${t.categories[category].title} — ${site}`
  }, [openItem, category, t])

  // --- actions -------------------------------------------------------------------
  const setFilters = (filters: Filters) => refine({ filters })
  const resetAll = () => {
    setDraft("")
    // Only a real change of q is a write the URL will echo back.
    if (query.q !== "") setCommittedQ("")
    refine({ q: "", filters: {} })
  }
  const hrefForCategory = (next: Category) =>
    catalogueHref(locale, { ...query, category: next, filters: {}, page: 1, open: null })
  const selectCategory = (next: Category) => go({ ...query, category: next, filters: {}, page: 1, open: null })
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const searchedOrFiltered = query.q !== "" || activeFilterCount(query.filters) > 0
  const quickFilterKeys = useMemo(
    () => new Set(QUICK_FILTERS[category].map(({ key, value }) => `${key}:${value}`)),
    [category]
  )

  let content
  if (error && !data) {
    content = (
      <div role="alert" className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">{t.catalogue.loadError}</p>
        <Button variant="outline" onClick={() => mutate()} className="h-11 rounded-full px-6">
          {t.catalogue.retry}
        </Button>
      </div>
    )
  } else if (!data) {
    content = <CatalogueSkeleton />
  } else if (data.items.length > 0) {
    content = (
      <ul
        aria-busy={updating}
        className={cn(
          "grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4",
          updating && "opacity-60"
        )}
      >
        {data.items.map((opportunity, index) => (
          <li key={opportunity.id}>
            <OpportunityCard opportunity={opportunity} onOpen={openDetails} priority={index < 4} />
          </li>
        ))}
      </ul>
    )
  } else if (data.total > 0) {
    content = (
      <div className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">{t.pagination.outOfRange}</p>
        <Button variant="outline" onClick={() => go({ ...query, page: 1 })} className="h-11 rounded-full px-6">
          {t.pagination.firstPage}
        </Button>
      </div>
    )
  } else {
    content = (
      <div className="space-y-4 px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <SearchX aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">{searchedOrFiltered ? t.catalogue.emptyFiltered : t.catalogue.empty}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {!query.showPast && (
            <Button variant="outline" onClick={() => refine({ showPast: true })} className="h-11 rounded-full px-6">
              {t.catalogue.showPastInstead}
            </Button>
          )}
          {searchedOrFiltered && (
            <Button variant="ghost" onClick={resetAll} className="h-11 rounded-full px-6 text-primary">
              {t.catalogue.resetSearchAndFilters}
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <section id="catalogue" aria-labelledby="catalogue-heading" className="relative z-10 scroll-mt-16 py-12 sm:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div ref={topRef} className="scroll-mt-24 space-y-6 sm:space-y-8">
          <h2 id="catalogue-heading" className="text-balance text-2xl font-bold text-white sm:text-3xl">
            {t.categories[category].title}
          </h2>

          <div className="space-y-4">
            <CategoryNav active={category} hrefFor={hrefForCategory} onSelect={selectCategory} />
            <QuickFilters category={category} filters={query.filters} onFiltersChange={setFilters} />
          </div>

          <FilterDialog category={category} filters={query.filters} onFiltersChange={setFilters} hiddenBadges={quickFilterKeys}>
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault()
                commitSearch(draft)
              }}
              className="relative min-w-0 flex-1 basis-full sm:basis-64"
            >
              <label htmlFor="catalogue-search" className="sr-only">
                {t.catalogue.searchLabel}
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="catalogue-search"
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                maxLength={MAX_QUERY_LENGTH}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t.catalogue.searchPlaceholder}
                className="h-11 w-full rounded-full border-2 border-border bg-card pl-11 pr-12 text-base text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary/60 sm:text-sm"
              />
              {draft && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft("")
                    commitSearch("")
                  }}
                  aria-label={t.catalogue.clearSearch}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </form>
          </FilterDialog>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="min-h-5 text-sm text-muted-foreground" aria-live="polite">
              {data && plural(locale, data.total, t.catalogue.found)}
              {updating && <span> · {t.catalogue.updating}</span>}
            </p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="flex min-h-11 items-center gap-2 sm:min-h-0">
                <Switch
                  id="catalogue-show-past"
                  checked={query.showPast}
                  onCheckedChange={(checked) => refine({ showPast: checked })}
                />
                <label htmlFor="catalogue-show-past" className="cursor-pointer text-sm text-muted-foreground">
                  {t.catalogue.showPast}
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="sr-only">{t.catalogue.sortLabel}</span>
                <select
                  value={query.sort}
                  onChange={(event) => refine({ sort: event.target.value as SortOrder })}
                  className="h-11 cursor-pointer rounded-full border border-border bg-[#0d1a14] px-4 text-sm text-foreground outline-none focus-visible:border-primary/60 sm:h-9"
                >
                  <option value="deadline">{t.catalogue.sortDeadline}</option>
                  <option value="newest">{t.catalogue.sortNewest}</option>
                </select>
              </label>
            </div>
          </div>

          {content}

          {data && (
            <Pagination
              page={query.page}
              totalPages={totalPages}
              hrefFor={(page) => catalogueHref(locale, { ...query, page, open: null })}
              onSelect={(page) => go({ ...query, page, open: null }, { scroll: true })}
            />
          )}
        </div>
      </div>

      <OpportunityDialog open={query.open !== null} opportunity={openItem} onClose={closeDetails} />
    </section>
  )
}

export function CatalogueSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  )
}
