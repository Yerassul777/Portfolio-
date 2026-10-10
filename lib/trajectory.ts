"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { getAccessToken, useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { localizeOpportunity, opportunityColumns } from "@/lib/catalogue"
import type { Locale } from "@/lib/i18n/config"
import { loadSupabase } from "@/lib/supabase-browser"
import type { Category, Opportunity } from "@/lib/types"

// "Моя траектория": the user's goals and their plans (migration
// 20261008110000). Plans are written by /api/trajectory; here they are read,
// ticked off and deleted.

export type StepKind = "opportunity" | "search" | "task" | "gap"

export interface GoalStep {
  id: string
  position: number
  kind: StepKind
  title: string
  detail: string
  /** "YYYY-MM-01" */
  dueMonth: string | null
  opportunity: Opportunity | null
  searchQuery: string | null
  searchKind: Category | null
  done: boolean
}

export interface Goal {
  id: string
  title: string
  /** "YYYY-MM-01" */
  targetMonth: string | null
  summary: string
  createdAt: string
  steps: GoalStep[]
}

export const GOAL_MAX = 200
export const GOALS_LIMIT = 5

type StepRow = {
  id: string
  position: number
  kind: StepKind
  title: string
  detail: string
  due_month: string | null
  search_query: string | null
  search_kind: Category | null
  done: boolean
  opportunity: Opportunity | null
}
type GoalRow = { id: string; title: string; target_month: string | null; summary: string; created_at: string; goal_steps: StepRow[] }

async function fetchGoals([, , locale]: readonly [string, string, Locale]): Promise<Goal[]> {
  const { data, error } = await (await loadSupabase())
    .from("goals")
    .select(
      `id, title, target_month, summary, created_at, goal_steps(id, position, kind, title, detail, due_month, search_query, search_kind, done, opportunity:opportunities(${opportunityColumns(locale)}))`
    )
    .order("created_at", { ascending: false })
  if (error) throw error
  return (data as unknown as GoalRow[]).map((g) => ({
    id: g.id,
    title: g.title,
    targetMonth: g.target_month,
    summary: g.summary,
    createdAt: g.created_at,
    steps: [...g.goal_steps]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        id: s.id,
        position: s.position,
        kind: s.kind,
        title: s.title,
        detail: s.detail,
        dueMonth: s.due_month,
        opportunity: s.opportunity && localizeOpportunity(s.opportunity, locale),
        searchQuery: s.search_query,
        searchKind: s.search_kind,
        done: s.done,
      })),
  }))
}

export type BuildOutcome = { ok: true; goalId: string } | { ok: false; message: string; code: string }

export function useGoals(active: boolean) {
  const { user } = useAuth()
  const { locale } = useI18n()
  const key = active && user ? (["goals", user.id, locale] as const) : null
  const { data, error, mutate } = useSWR(key, fetchGoals, { revalidateOnFocus: false, dedupingInterval: 10_000 })

  const build = useCallback(
    async (input: { goal: string; targetMonth: string | null; goalId?: string }): Promise<BuildOutcome> => {
      const token = await getAccessToken()
      if (!token) return { ok: false, code: "auth_required", message: "" }
      const response = await fetch("/api/trajectory", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...input, locale }),
      }).catch(() => null)
      const body = response ? await response.json().catch(() => ({})) : {}
      if (!response?.ok) return { ok: false, code: body.code ?? "failed", message: body.error ?? "" }
      await mutate()
      return { ok: true, goalId: body.goalId }
    },
    [mutate, locale]
  )

  const toggleStep = useCallback(
    async (stepId: string, done: boolean) => {
      const apply = (list: Goal[] | undefined) =>
        (list ?? []).map((g) => ({ ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, done } : s)) }))
      await mutate(
        async (current) => {
          const { error: updateError } = await (await loadSupabase()).from("goal_steps").update({ done }).eq("id", stepId)
          if (updateError) throw updateError
          return apply(current)
        },
        { optimisticData: apply, rollbackOnError: true, revalidate: false }
      )
    },
    [mutate]
  )

  const removeGoal = useCallback(
    async (goalId: string) => {
      const without = (list: Goal[] | undefined) => (list ?? []).filter((g) => g.id !== goalId)
      await mutate(
        async (current) => {
          const { error: deleteError } = await (await loadSupabase()).from("goals").delete().eq("id", goalId)
          if (deleteError) throw deleteError
          return without(current)
        },
        { optimisticData: without, rollbackOnError: true, revalidate: false }
      )
    },
    [mutate]
  )

  return {
    goals: data ?? [],
    ready: data !== undefined || !!error,
    loadFailed: !!error && data === undefined,
    retry: () => void mutate(),
    build,
    toggleStep,
    removeGoal,
  }
}
