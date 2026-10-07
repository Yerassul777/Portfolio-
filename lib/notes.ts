"use client"

import { useCallback, useMemo, useState } from "react"
import useSWR from "swr"
import { useAuth } from "@/components/auth-provider"
import { loadSupabase } from "@/lib/supabase-browser"
import { readNotes, saveNotes, useNotes as useLocalNotes, type Note } from "@/lib/local-store"

export type { Note }

// Match the checks in the notes table (migration 20260929090000).
export const NOTE_TITLE_MAX = 200
export const NOTE_CONTENT_MAX = 20000
const NOTE_CATEGORIES: readonly Note["category"][] = ["goals", "portfolio", "ideas", "other"]

type NoteRow = {
  id: string
  title: string
  content: string
  category: Note["category"]
  created_at: string
  updated_at: string
}

const COLUMNS = "id, title, content, category, created_at, updated_at"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fromRow(row: NoteRow): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function byUpdatedDesc(a: Note, b: Note) {
  return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
}

async function fetchNotes(): Promise<Note[]> {
  const supabase = await loadSupabase()
  const { data, error } = await supabase
    .from("notes")
    .select(COLUMNS)
    .order("updated_at", { ascending: false })
    .limit(500)
  if (error) throw error
  return (data as NoteRow[]).map(fromRow)
}

// Notes written by earlier versions of the site may have non-UUID ids. They
// get a UUID derived from the old id, so uploading the same note twice (a
// retry after a dropped connection) is still a no-op, never a duplicate.
async function uploadId(id: string): Promise<string> {
  if (UUID.test(id)) return id.toLowerCase()
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`portfolio-note:${id}`)))
  hash[6] = (hash[6] & 0x0f) | 0x50
  hash[8] = (hash[8] & 0x3f) | 0x80
  const hex = [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function validDate(value: string | undefined): string | undefined {
  return value && !Number.isNaN(Date.parse(value)) ? value : undefined
}

/**
 * Moves the notes kept on this device into the account, once per user per
 * page load. Copy, confirm the copy is there, and only then remove the local
 * notes — and only those confirmed, so a failure never loses anything.
 *
 * Only when the user says so: on a shared computer the notes on the device
 * may be someone else's (privacy review, R3).
 */
const imports = new Map<string, Promise<void>>()

function importLocalNotes(userId: string): Promise<void> {
  const running = imports.get(userId)
  if (running) return running

  const job = (async () => {
    const local = readNotes()
    if (local.length === 0) return
    const supabase = await loadSupabase()
    const pairs = await Promise.all(local.map(async (note) => ({ note, id: await uploadId(note.id) })))

    const { error } = await supabase.from("notes").upsert(
      pairs.map(({ note, id }) => ({
        id,
        title: note.title.slice(0, NOTE_TITLE_MAX),
        content: note.content.slice(0, NOTE_CONTENT_MAX),
        category: NOTE_CATEGORIES.includes(note.category) ? note.category : "other",
        created_at: validDate(note.createdAt),
        updated_at: validDate(note.updatedAt),
      })),
      { onConflict: "id", ignoreDuplicates: true }
    )
    if (error) throw error

    const { data, error: checkError } = await supabase
      .from("notes")
      .select("id")
      .in("id", pairs.map((p) => p.id))
    if (checkError) throw checkError

    const saved = new Set((data as { id: string }[]).map((row) => row.id))
    const savedLocalIds = new Set(pairs.filter((p) => saved.has(p.id)).map((p) => p.note.id))
    // Re-read: a note may have been added on this device while the upload ran.
    saveNotes(readNotes().filter((note) => !savedLocalIds.has(note.id)))
  })()

  imports.set(userId, job)
  // A failed attempt is retried the next time notes are needed.
  job.catch(() => imports.delete(userId))
  return job
}

// "Keep them on the device" lasts for this browser session.
function readKept(key: string | null): boolean {
  if (!key) return false
  try {
    return sessionStorage.getItem(key) === "1"
  } catch {
    return false
  }
}

function writeKept(key: string | null) {
  if (!key) return
  try {
    sessionStorage.setItem(key, "1")
  } catch {}
}

export type NotesData = {
  notes: Note[]
  /** Signed in, with notes on this device written without an account: ask what to do with them. */
  devicePending: number
  /** Moves the device's notes into the account. */
  importDevice: () => Promise<void>
  /** Leaves them on the device and stops asking for this session. */
  keepDevice: () => void
  /** Deletes them from the device. */
  discardDevice: () => void
  /** Stored in the account (signed in) rather than on this device. */
  synced: boolean
  /** False while the account's notes are still loading. */
  ready: boolean
  loadFailed: boolean
  retry: () => void
  add: (note: Note) => Promise<void>
  update: (id: string, patch: Partial<Pick<Note, "title" | "content" | "category">>) => Promise<void>
  remove: (id: string) => Promise<void>
}

/**
 * Notes for whoever is using the page: the account's notes when signed in,
 * this device's notes otherwise. `active` defers loading until a panel that
 * shows notes is open, so a page view costs no request.
 */
export function useNotesData(active: boolean): NotesData {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id ?? null
  const local = useLocalNotes()
  const key = active && userId ? (["notes", userId] as const) : null
  const { data, error, mutate } = useSWR(key, fetchNotes, { revalidateOnFocus: true, dedupingInterval: 5_000 })

  // Signed in, the account's notes only; the device's are offered separately.
  const notes = useMemo(() => (userId ? (data ?? []) : local), [userId, data, local])
  const keptKey = userId ? `portfolio-keep-device-notes:${userId}` : null
  const [keptFor, setKeptFor] = useState<string | null>(null)
  const devicePending = userId && local.length > 0 && keptFor !== userId && !readKept(keptKey) ? local.length : 0

  const importDevice = useCallback(async () => {
    if (!userId) return
    await importLocalNotes(userId)
    await mutate()
  }, [userId, mutate])
  const keepDevice = useCallback(() => {
    writeKept(keptKey)
    setKeptFor(userId)
  }, [keptKey, userId])
  const discardDevice = useCallback(() => saveNotes([]), [])

  const add = useCallback(
    async (note: Note) => {
      if (!userId) {
        saveNotes([note, ...readNotes()])
        return
      }
      await mutate(
        async (current) => {
          const supabase = await loadSupabase()
          const { data: row, error: insertError } = await supabase
            .from("notes")
            .insert({ id: note.id, title: note.title, content: note.content, category: note.category })
            .select(COLUMNS)
            .single()
          if (insertError) throw insertError
          return [fromRow(row as NoteRow), ...(current ?? []).filter((n) => n.id !== note.id)]
        },
        { optimisticData: (current) => [note, ...(current ?? [])], rollbackOnError: true, revalidate: false }
      )
    },
    [userId, mutate]
  )

  const update = useCallback<NotesData["update"]>(
    async (id, patch) => {
      const now = new Date().toISOString()
      if (!userId) {
        saveNotes(readNotes().map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n)))
        return
      }
      const apply = (list: Note[] | undefined) =>
        (list ?? []).map((n) => (n.id === id ? { ...n, ...patch, updatedAt: now } : n)).sort(byUpdatedDesc)
      await mutate(
        async (current) => {
          const supabase = await loadSupabase()
          const { error: updateError } = await supabase.from("notes").update(patch).eq("id", id)
          if (updateError) throw updateError
          return apply(current)
        },
        { optimisticData: apply, rollbackOnError: false, revalidate: false }
      )
    },
    [userId, mutate]
  )

  const remove = useCallback(
    async (id: string) => {
      if (!userId) {
        saveNotes(readNotes().filter((n) => n.id !== id))
        return
      }
      const without = (list: Note[] | undefined) => (list ?? []).filter((n) => n.id !== id)
      await mutate(
        async (current) => {
          const supabase = await loadSupabase()
          const { error: deleteError } = await supabase.from("notes").delete().eq("id", id)
          if (deleteError) throw deleteError
          return without(current)
        },
        { optimisticData: without, rollbackOnError: true, revalidate: false }
      )
    },
    [userId, mutate]
  )

  return {
    notes,
    devicePending,
    importDevice,
    keepDevice,
    discardDevice,
    synced: !!userId,
    ready: !authLoading && (!userId || data !== undefined || !!error),
    loadFailed: !!userId && !!error && data === undefined,
    retry: () => void mutate(),
    add,
    update,
    remove,
  }
}
