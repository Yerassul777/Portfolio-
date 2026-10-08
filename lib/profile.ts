"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { useAuth } from "@/components/auth-provider"
import { loadSupabase } from "@/lib/supabase-browser"

export { ageOn } from "@/lib/policy"
export { todayInAlmaty as todayInKazakhstan } from "@/lib/deadline"

// The profile the user fills in (Portfolio → Profile). Columns and limits
// match migration 20261008090000; the date of birth is set once.

export const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "college", "student", "other"] as const
export type Grade = (typeof GRADES)[number]

export const NAME_MAX = 80
export const NICKNAME_MAX = 32
export const CITY_MAX = 60
export const INTERESTS_MAX = 300
export const AVATAR_COLORS = 8

export interface Profile {
  displayName: string | null
  nickname: string | null
  grade: Grade | null
  city: string | null
  interests: string | null
  avatarColor: number
  birthDate: string | null
}

export type ProfileFields = Partial<Omit<Profile, "birthDate">>

const COLUMNS = "display_name, nickname, grade, city, interests, avatar_color, birth_date"

type Row = {
  display_name: string | null
  nickname: string | null
  grade: Grade | null
  city: string | null
  interests: string | null
  avatar_color: number | null
  birth_date: string | null
}

const fromRow = (row: Row | null): Profile => ({
  displayName: row?.display_name ?? null,
  nickname: row?.nickname ?? null,
  grade: row?.grade ?? null,
  city: row?.city ?? null,
  interests: row?.interests ?? null,
  avatarColor: row?.avatar_color ?? 0,
  birthDate: row?.birth_date ?? null,
})

async function fetchProfile(): Promise<Profile> {
  const { data, error } = await (await loadSupabase()).from("profiles").select(COLUMNS).maybeSingle()
  if (error) throw error
  return fromRow(data as Row | null)
}

/** The signed-in user's profile. */
export function useProfile() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const key = userId ? (["profile", userId] as const) : null
  const { data, error, mutate } = useSWR(key, fetchProfile, { revalidateOnFocus: false, dedupingInterval: 30_000 })

  const save = useCallback(
    async (fields: ProfileFields & { birthDate?: string }): Promise<Profile | null> => {
      if (!userId) return null
      const row: Partial<Row> = {}
      if (fields.displayName !== undefined) row.display_name = fields.displayName?.trim() || null
      if (fields.nickname !== undefined) row.nickname = fields.nickname?.trim().replace(/^@/, "") || null
      if (fields.grade !== undefined) row.grade = fields.grade
      if (fields.city !== undefined) row.city = fields.city?.trim() || null
      if (fields.interests !== undefined) row.interests = fields.interests?.trim() || null
      if (fields.avatarColor !== undefined) row.avatar_color = fields.avatarColor
      if (fields.birthDate !== undefined) row.birth_date = fields.birthDate
      const { data: saved, error: updateError } = await (await loadSupabase())
        .from("profiles")
        .update(row)
        .eq("id", userId)
        .select(COLUMNS)
        .single()
      if (updateError) throw updateError
      const profile = fromRow(saved as Row)
      await mutate(profile, { revalidate: false })
      return profile
    },
    [userId, mutate]
  )

  return {
    profile: data ?? null,
    ready: !userId || data !== undefined || !!error,
    loadFailed: !!error && data === undefined,
    retry: () => void mutate(),
    save,
  }
}

/** How the app addresses the user: their name, else nickname, else the email's first part. */
export function shownName(profile: Profile | null, email: string | undefined): string {
  return profile?.displayName || profile?.nickname || (email ? email.split("@")[0] : "")
}
