"use client"

import { useCallback, useMemo } from "react"
import useSWR from "swr"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { localizeOpportunity, opportunityColumns } from "@/lib/catalogue"
import type { Locale } from "@/lib/i18n/config"
import { loadSupabase } from "@/lib/supabase-browser"
import type { Opportunity } from "@/lib/types"

export interface Favorite {
  opportunityId: string
  createdAt: string
  /** null when the item was unpublished after it was saved. */
  opportunity: Opportunity | null
}

type FavoriteRow = { opportunity_id: string; created_at: string; opportunity: Opportunity | null }

async function fetchFavorites([, , locale]: readonly [string, string, Locale]): Promise<Favorite[]> {
  const supabase = await loadSupabase()
  const { data, error } = await supabase
    .from("favorites")
    .select(`opportunity_id, created_at, opportunity:opportunities(${opportunityColumns(locale)})`)
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) throw error
  return (data as unknown as FavoriteRow[]).map((row) => ({
    opportunityId: row.opportunity_id,
    createdAt: row.created_at,
    opportunity: row.opportunity && localizeOpportunity(row.opportunity, locale),
  }))
}

/**
 * The signed-in user's favorites. Every heart on the page shares this one
 * request (SWR dedupes by key); signed out there are none.
 */
export function useFavorites() {
  const { user, loading } = useAuth()
  const { locale } = useI18n()
  const userId = user?.id ?? null
  const key = userId ? (["favorites", userId, locale] as const) : null
  const { data, error, mutate } = useSWR(key, fetchFavorites, { revalidateOnFocus: true, dedupingInterval: 10_000 })
  const ids = useMemo(() => new Set((data ?? []).map((f) => f.opportunityId)), [data])

  const toggle = useCallback(
    async (opportunity: Opportunity) => {
      if (!userId) return
      const saved = ids.has(opportunity.id)
      const next = (list: Favorite[] | undefined) =>
        saved
          ? (list ?? []).filter((f) => f.opportunityId !== opportunity.id)
          : [{ opportunityId: opportunity.id, createdAt: new Date().toISOString(), opportunity }, ...(list ?? [])]
      await mutate(
        async (current) => {
          const supabase = await loadSupabase()
          const { error: writeError } = saved
            ? await supabase.from("favorites").delete().eq("opportunity_id", opportunity.id)
            : await supabase.from("favorites").insert({ opportunity_id: opportunity.id })
          if (writeError) throw writeError
          return next(current)
        },
        { optimisticData: next, rollbackOnError: true, revalidate: false }
      )
    },
    [userId, ids, mutate]
  )

  return {
    signedIn: !!userId,
    authLoading: loading,
    ready: !loading && (!userId || data !== undefined || !!error),
    loadFailed: !!error && data === undefined,
    retry: () => void mutate(),
    favorites: data ?? [],
    isFavorite: (id: string) => ids.has(id),
    toggle,
  }
}
