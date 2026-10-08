"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { useAuth } from "@/components/auth-provider"
import { loadSupabase } from "@/lib/supabase-browser"
import type { Category, Opportunity } from "@/lib/types"

// Match the checks in portfolio_entries (migration 20261007090000).
export const ENTRY_TITLE_MAX = 200
export const ENTRY_TEXT_MAX = 200
export const ENTRY_DESCRIPTION_MAX = 4000

export type EntryKind = Category | "other"
export type EntryStatus = "participating" | "completed"

export interface PortfolioEntry {
  id: string
  opportunityId: string | null
  status: EntryStatus
  kind: EntryKind
  title: string
  organizer: string
  result: string
  /** "YYYY-MM-DD" */
  eventDate: string | null
  description: string
  /** The certificate photo in Storage ("<user id>/<id>.jpg"), see lib/certificates.ts. */
  certificatePath: string | null
  createdAt: string
}

export type EntryDraft = Pick<PortfolioEntry, "kind" | "title" | "organizer" | "result" | "eventDate" | "description" | "status" | "certificatePath">

type EntryRow = {
  id: string
  opportunity_id: string | null
  status: EntryStatus
  kind: EntryKind
  title: string
  organizer: string
  result: string
  event_date: string | null
  description: string
  certificate_path: string | null
  created_at: string
}

const COLUMNS = "id, opportunity_id, status, kind, title, organizer, result, event_date, description, certificate_path, created_at"

function fromRow(row: EntryRow): PortfolioEntry {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    status: row.status,
    kind: row.kind,
    title: row.title,
    organizer: row.organizer,
    result: row.result,
    eventDate: row.event_date,
    description: row.description,
    certificatePath: row.certificate_path,
    createdAt: row.created_at,
  }
}

function toRow(draft: Partial<EntryDraft>) {
  const row: Record<string, unknown> = {}
  if (draft.kind !== undefined) row.kind = draft.kind
  if (draft.status !== undefined) row.status = draft.status
  if (draft.title !== undefined) row.title = draft.title.trim().slice(0, ENTRY_TITLE_MAX)
  if (draft.organizer !== undefined) row.organizer = draft.organizer.trim().slice(0, ENTRY_TEXT_MAX)
  if (draft.result !== undefined) row.result = draft.result.trim().slice(0, ENTRY_TEXT_MAX)
  if (draft.eventDate !== undefined) row.event_date = draft.eventDate || null
  if (draft.description !== undefined) row.description = draft.description.slice(0, ENTRY_DESCRIPTION_MAX)
  if (draft.certificatePath !== undefined) row.certificate_path = draft.certificatePath
  return row
}

/** Newest first; entries without a date after dated ones. */
function byDateDesc(a: PortfolioEntry, b: PortfolioEntry) {
  if (a.eventDate && b.eventDate) return b.eventDate.localeCompare(a.eventDate)
  if (a.eventDate) return -1
  if (b.eventDate) return 1
  return b.createdAt.localeCompare(a.createdAt)
}

async function fetchEntries(): Promise<PortfolioEntry[]> {
  const supabase = await loadSupabase()
  const { data, error } = await supabase.from("portfolio_entries").select(COLUMNS).limit(300)
  if (error) throw error
  return (data as EntryRow[]).map(fromRow).sort(byDateDesc)
}

function hostname(url: string | null): string {
  if (!url) return ""
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

/**
 * The signed-in user's portfolio: what they take part in and what they have
 * done. `active` defers the request until something shows it.
 */
export function usePortfolio(active: boolean) {
  const { user, loading } = useAuth()
  const userId = user?.id ?? null
  const key = active && userId ? (["portfolio", userId] as const) : null
  const { data, error, mutate } = useSWR(key, fetchEntries, { revalidateOnFocus: true, dedupingInterval: 10_000 })

  const insert = useCallback(
    async (row: Record<string, unknown>) => {
      await mutate(
        async (current) => {
          const supabase = await loadSupabase()
          const { data: saved, error: insertError } = await supabase.from("portfolio_entries").insert(row).select(COLUMNS).single()
          if (insertError) throw insertError
          return [...(current ?? []), fromRow(saved as EntryRow)].sort(byDateDesc)
        },
        { revalidate: false }
      )
    },
    [mutate]
  )

  /** "I'm taking part": an entry filled in from the catalogue. */
  const participate = useCallback(
    (opportunity: Opportunity) =>
      insert({
        opportunity_id: opportunity.id,
        status: "participating",
        kind: opportunity.kind,
        title: opportunity.title.slice(0, ENTRY_TITLE_MAX),
        organizer: hostname(opportunity.link),
        event_date: opportunity.deadline,
      }),
    [insert]
  )

  const add = useCallback((draft: EntryDraft) => insert(toRow(draft)), [insert])

  const update = useCallback(
    async (id: string, patch: Partial<EntryDraft>) => {
      const apply = (list: PortfolioEntry[] | undefined) =>
        (list ?? []).map((e) => (e.id === id ? { ...e, ...patch } : e)).sort(byDateDesc)
      await mutate(
        async (current) => {
          const supabase = await loadSupabase()
          const { error: updateError } = await supabase.from("portfolio_entries").update(toRow(patch)).eq("id", id)
          if (updateError) throw updateError
          return apply(current)
        },
        { optimisticData: apply, rollbackOnError: true, revalidate: false }
      )
    },
    [mutate]
  )

  const remove = useCallback(
    async (id: string) => {
      const without = (list: PortfolioEntry[] | undefined) => (list ?? []).filter((e) => e.id !== id)
      await mutate(
        async (current) => {
          const supabase = await loadSupabase()
          const { error: deleteError } = await supabase.from("portfolio_entries").delete().eq("id", id)
          if (deleteError) throw deleteError
          return without(current)
        },
        { optimisticData: without, rollbackOnError: true, revalidate: false }
      )
    },
    [mutate]
  )

  const entries = data ?? []
  return {
    signedIn: !!userId,
    ready: !loading && (!userId || data !== undefined || !!error),
    loadFailed: !!error && data === undefined,
    retry: () => void mutate(),
    entries,
    entryFor: (opportunityId: string) => entries.find((e) => e.opportunityId === opportunityId) ?? null,
    participate,
    add,
    update,
    remove,
  }
}
