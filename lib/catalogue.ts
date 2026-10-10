import type { SupabaseClient } from "@supabase/supabase-js"
import type { Locale } from "@/lib/i18n/config"
import { CATEGORIES, FILTER_CONFIGS, type Category, type Filters, type Opportunity } from "@/lib/types"
import { daysUntil, todayInAlmaty } from "@/lib/deadline"
import { buildSearchWords, MAX_QUERY_LENGTH, type SearchWord } from "@/lib/search"
import { DEFAULT_CATEGORY, categoryPath } from "@/lib/site"

export const PAGE_SIZE = 24
const MAX_PAGE = 1000

// Everything a card or the detail view shows; `legacy` (the pre-Phase-2 row
// archive) never needs to reach the browser.
export const OPPORTUNITY_COLUMNS =
  "id,kind,status,slug,title,description,link,deadline,image_url,subject,level,type,age_group,format,duration,city,field,requirements,grant_available,pass_score,pass_score_year,created_at,updated_at,source_url,reviewed_at"

export type SortOrder = "deadline" | "newest"

/**
 * The catalogue's state, all of it in the URL:
 *   /ru/competitions?q=робо&type=hackathon,robotics&sort=new&past=1&page=2&o=<slug>
 * The category is the path; everything else is a query parameter and is left
 * out when it has its default value, so the plain page stays a clean URL.
 */
export interface CatalogueQuery {
  category: Category
  q: string
  filters: Filters
  sort: SortOrder
  showPast: boolean
  page: number
  /** Slug of the opportunity open in the detail dialog. */
  open: string | null
}

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>

function readParam(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined
  const value = source[key]
  return Array.isArray(value) ? value[0] : value
}

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,99}$/

export function isCategory(value: string): value is Category {
  return (CATEGORIES as string[]).includes(value)
}

/** Parses untrusted URL input; anything unknown or malformed is dropped, never an error. */
export function parseCatalogueQuery(category: Category, source: ParamSource): CatalogueQuery {
  const filters: Filters = {}
  for (const config of FILTER_CONFIGS[category]) {
    const key = config.key as string
    const raw = readParam(source, key)
    if (!raw) continue
    const allowed = new Set(config.options.map((o) => o.value))
    const values = [...new Set(raw.split(","))].filter((v) => allowed.has(v))
    if (values.length > 0) filters[key] = values
  }

  const page = Number.parseInt(readParam(source, "page") ?? "1", 10)
  const open = readParam(source, "o")

  return {
    category,
    q: (readParam(source, "q") ?? "").slice(0, MAX_QUERY_LENGTH),
    filters,
    sort: readParam(source, "sort") === "new" ? "newest" : "deadline",
    showPast: readParam(source, "past") === "1",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1,
    open: open && SLUG_PATTERN.test(open) ? open : null,
  }
}

export function catalogueSearchParams(query: CatalogueQuery, { withOpen = true } = {}): URLSearchParams {
  const params = new URLSearchParams()
  const q = query.q.trim()
  if (q) params.set("q", q)
  for (const config of FILTER_CONFIGS[query.category]) {
    const values = query.filters[config.key as string]
    if (values?.length) params.set(config.key as string, values.join(","))
  }
  if (query.sort === "newest") params.set("sort", "new")
  if (query.showPast) params.set("past", "1")
  if (query.page > 1) params.set("page", String(query.page))
  if (withOpen && query.open) params.set("o", query.open)
  return params
}

/** The category a catalogue URL path shows: /ru → the default one, /ru/competitions → competitions. */
export function categoryFromPathname(pathname: string): Category {
  const segment = pathname.split("/")[2]
  return segment && isCategory(segment) ? segment : DEFAULT_CATEGORY
}

/** The catalogue state of the page the browser is on right now. */
export function currentCatalogueQuery(): CatalogueQuery {
  const category = categoryFromPathname(window.location.pathname)
  return parseCatalogueQuery(category, new URLSearchParams(window.location.search))
}

export function catalogueHref(locale: Locale, query: CatalogueQuery): string {
  const params = catalogueSearchParams(query).toString()
  return categoryPath(locale, query.category) + (params ? `?${params}` : "")
}

/** Identifies one page of results; the open dialog is not part of it. */
export function catalogueKey(query: CatalogueQuery, locale: Locale = "ru"): string {
  return `${locale}/${query.category}?${catalogueSearchParams(query, { withOpen: false })}`
}

export function isRefined(query: CatalogueQuery): boolean {
  // toString rather than .size, which iOS 16 Safari does not have.
  return catalogueSearchParams(query, { withOpen: false }).toString() !== ""
}

export function activeFilterCount(filters: Filters): number {
  return Object.values(filters).reduce((sum, values) => sum + values.length, 0)
}

export interface CataloguePage {
  items: Opportunity[]
  total: number
}

export type CatalogueFilters = Partial<Record<string, string | boolean | string[]>>

const TRANSLATED_COLUMNS: Record<Locale, string> = { ru: "", kz: ",title_kk,description_kk", en: ",title_en,description_en" }

/** The catalogue columns plus the text in this language, if it is not Russian (only that one: no payload for the others). */
export function opportunityColumns(locale: Locale = "ru"): string {
  return OPPORTUNITY_COLUMNS + TRANSLATED_COLUMNS[locale]
}

/** The row with its title and description in this language where it has them; Russian otherwise. */
export function localizeOpportunity<T extends Opportunity>(row: T, locale: Locale): T {
  if (locale === "ru") return row
  const { title_kk, title_en, description_kk, description_en, ...rest } = row
  const title = locale === "kz" ? title_kk : title_en
  const description = locale === "kz" ? description_kk : description_en
  return { ...rest, title: title?.trim() ? title : row.title, description: description?.trim() ? description : row.description } as T
}

interface SearchOptions {
  locale?: Locale
  kind?: Category
  filters?: CatalogueFilters
  search?: SearchWord[]
  onlyOpen?: boolean
  sort?: SortOrder
  limit?: number
  offset?: number
}

function rpcArgs(options: SearchOptions) {
  return {
    p_kind: options.kind ?? null,
    p_filters: options.filters ?? {},
    p_only_open: options.onlyOpen ?? false,
    p_search: options.search?.length ? options.search : null,
  }
}

/**
 * Published opportunities through search_opportunities. It runs with the
 * caller's rights, so RLS applies exactly as for a direct read. Works with the
 * browser client and the server's public client alike.
 */
export async function searchCatalogue(client: SupabaseClient, options: SearchOptions = {}): Promise<Opportunity[]> {
  const { data, error } = await client
    .rpc("search_opportunities", {
      ...rpcArgs(options),
      p_sort: options.sort ?? "newest",
      p_limit: options.limit ?? PAGE_SIZE,
      p_offset: options.offset ?? 0,
    })
    .select(opportunityColumns(options.locale))
  if (error) throw error
  const locale = options.locale ?? "ru"
  return ((data ?? []) as unknown as Opportunity[]).map((row) => localizeOpportunity(row, locale))
}

export async function countCatalogue(client: SupabaseClient, options: SearchOptions = {}): Promise<number> {
  const { data, error } = await client.rpc("count_opportunities", rpcArgs(options))
  if (error) throw error
  return typeof data === "number" ? data : 0
}

export async function fetchCataloguePage(
  client: SupabaseClient,
  query: CatalogueQuery,
  locale: Locale = "ru",
  labels: Record<string, string> = {}
): Promise<CataloguePage> {
  const options: SearchOptions = {
    locale,
    kind: query.category,
    filters: query.filters,
    search: buildSearchWords(query.q, query.category, labels),
    onlyOpen: !query.showPast,
  }
  const [items, total] = await Promise.all([
    searchCatalogue(client, { ...options, sort: query.sort, limit: PAGE_SIZE, offset: (query.page - 1) * PAGE_SIZE }),
    countCatalogue(client, options),
  ])
  return { items, total }
}

/**
 * How many open opportunities match a search in each category. Search runs
 * inside one category at a time (words resolve against that category's
 * filters), so this is what tells a search that found nothing here where it
 * did find something.
 */
export async function countByCategory(client: SupabaseClient, q: string, onlyOpen = true, labels: Record<string, string> = {}): Promise<Record<Category, number>> {
  const counts = await Promise.all(
    CATEGORIES.map((kind) => countCatalogue(client, { kind, onlyOpen, search: buildSearchWords(q, kind, labels) }))
  )
  return Object.fromEntries(CATEGORIES.map((kind, i) => [kind, counts[i]])) as Record<Category, number>
}

/** Where a search should land: here if it finds anything here, else the category that finds the most. */
export function bestCategory(counts: Record<Category, number>, current: Category): Category {
  if (counts[current] > 0) return current
  return CATEGORIES.reduce((best, kind) => (counts[kind] > counts[best] ? kind : best), current)
}

export interface Highlights {
  /** Open opportunities with the nearest deadlines, any category. */
  soon: Opportunity[]
  /** Open opportunities in the whole catalogue. */
  openTotal: number
  /** Of those, how many close within CLOSING_SOON_DAYS. */
  closingSoon: number
}

export const CLOSING_SOON_DAYS = 7
const HIGHLIGHT_SCAN = 50

/** What the home page's first screen shows above the catalogue. */
export async function fetchHighlights(client: SupabaseClient, soonCount = 3, locale: Locale = "ru"): Promise<Highlights> {
  const today = todayInAlmaty()
  const [nearest, openTotal] = await Promise.all([
    // Sorted by nearest deadline, open ones only, so the ones with a deadline come first.
    searchCatalogue(client, { locale, onlyOpen: true, sort: "deadline", limit: HIGHLIGHT_SCAN }),
    countCatalogue(client, { onlyOpen: true }),
  ])
  const dated = nearest.filter((o) => o.deadline && (daysUntil(o.deadline, today) ?? -1) >= 0)
  return {
    soon: dated.slice(0, soonCount),
    openTotal,
    closingSoon: dated.filter((o) => (daysUntil(o.deadline, today) ?? Infinity) <= CLOSING_SOON_DAYS).length,
  }
}

export async function fetchOpportunityBySlug(client: SupabaseClient, slug: string, locale: Locale = "ru"): Promise<Opportunity | null> {
  if (!SLUG_PATTERN.test(slug)) return null
  const { data, error } = await client.from("opportunities").select(opportunityColumns(locale)).eq("slug", slug).maybeSingle()
  if (error) throw error
  const row = data as unknown as Opportunity | null
  return row ? localizeOpportunity(row, locale) : null
}
