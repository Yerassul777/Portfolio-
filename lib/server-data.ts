import { cache } from "react"
import { fetchCataloguePage, fetchOpportunityBySlug, type CatalogueQuery, type CataloguePage } from "@/lib/catalogue"
import { createPublicClient } from "@/lib/supabase-server"
import type { Opportunity } from "@/lib/types"

// Server-side reads, as the public (RLS: published rows only). cache() makes a
// layout, generateMetadata and the page share one request per render.

export const getOpportunity = cache(async (slug: string): Promise<Opportunity | null> => {
  const client = createPublicClient()
  if (!client) return null
  try {
    return await fetchOpportunityBySlug(client, slug)
  } catch (error) {
    console.error("Loading opportunity failed:", error)
    return null
  }
})

/** null when the catalogue is unreachable; the page then renders and the browser retries. */
export async function getCataloguePage(query: CatalogueQuery): Promise<CataloguePage | null> {
  const client = createPublicClient()
  if (!client) return null
  try {
    return await fetchCataloguePage(client, query)
  } catch (error) {
    console.error("Loading catalogue failed:", error)
    return null
  }
}
