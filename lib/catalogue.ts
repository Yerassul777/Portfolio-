import type { SupabaseClient } from "@supabase/supabase-js"
import type { Category, Opportunity } from "@/lib/types"

export type CatalogueFilters = Partial<Record<string, string | boolean | string[]>>

// The database caps a page at 500 rows.
export const MAX_PAGE = 500

/**
 * Published opportunities through the search_opportunities RPC. It runs with
 * the caller's rights, so RLS applies exactly as for a direct read. Works with
 * the browser client and the server's public client alike.
 */
export async function searchCatalogue(
  client: SupabaseClient,
  options: { kind?: Category; filters?: CatalogueFilters; onlyOpen?: boolean; limit?: number; offset?: number } = {}
): Promise<Opportunity[]> {
  const { data, error } = await client.rpc("search_opportunities", {
    p_kind: options.kind ?? null,
    p_filters: options.filters ?? {},
    p_only_open: options.onlyOpen ?? false,
    p_limit: options.limit ?? MAX_PAGE,
    p_offset: options.offset ?? 0,
  })
  if (error) throw error
  return (data ?? []) as Opportunity[]
}
