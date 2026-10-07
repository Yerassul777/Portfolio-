import { cache } from "react"
import { unstable_cache } from "next/cache"
import {
  fetchCataloguePage,
  fetchHighlights,
  fetchOpportunityBySlug,
  type CatalogueQuery,
  type CataloguePage,
  type Highlights,
} from "@/lib/catalogue"
import { createPublicClient } from "@/lib/supabase-server"
import type { Opportunity } from "@/lib/types"

// Server-side reads, as the public (RLS: published rows only).
//
// Results are kept in Next's data cache for a minute: the page then renders
// without waiting on the database (its first paint was held back by those
// round trips), and a burst of visitors costs one query, not one each. A
// change made in the admin panel shows up within that minute. A failed read
// throws inside the cached function, so a failure is never cached.
//
// cache() on top makes a layout, generateMetadata and the page share one
// lookup per render.
const REVALIDATE_SECONDS = 60
// Bump when the shape of a cached result changes.
const CACHE_VERSION = "v1"

function client() {
  const supabase = createPublicClient()
  if (!supabase) throw new Error("Supabase is not configured")
  return supabase
}

const cachedOpportunity = unstable_cache(
  async (slug: string) => fetchOpportunityBySlug(client(), slug),
  ["opportunity", CACHE_VERSION],
  { revalidate: REVALIDATE_SECONDS }
)

const cachedPage = unstable_cache(
  async (query: CatalogueQuery) => fetchCataloguePage(client(), query),
  ["catalogue-page", CACHE_VERSION],
  { revalidate: REVALIDATE_SECONDS }
)

const cachedHighlights = unstable_cache(async () => fetchHighlights(client()), ["highlights", CACHE_VERSION], {
  revalidate: REVALIDATE_SECONDS,
})

export const getOpportunity = cache(async (slug: string): Promise<Opportunity | null> => {
  try {
    return await cachedOpportunity(slug)
  } catch (error) {
    console.error("Loading opportunity failed:", error)
    return null
  }
})

/** The home page's nearest deadlines and counts; null if unreachable (the section is then left out). */
export async function getHighlights(): Promise<Highlights | null> {
  try {
    return await cachedHighlights()
  } catch (error) {
    console.error("Loading highlights failed:", error)
    return null
  }
}

/**
 * null when the catalogue is unreachable; the page then renders and the
 * browser retries. Only shared views (no search, first pages) go through the
 * cache: arbitrary ?q= values would otherwise fill it with one-off entries.
 */
export async function getCataloguePage(query: CatalogueQuery): Promise<CataloguePage | null> {
  try {
    const shared = query.q.trim() === "" && query.page <= 3
    return await (shared ? cachedPage(query) : fetchCataloguePage(client(), query))
  } catch (error) {
    console.error("Loading catalogue failed:", error)
    return null
  }
}
