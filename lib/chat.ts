"use client"

import { useCallback, useEffect } from "react"
import useSWR from "swr"
import { useAuth } from "@/components/auth-provider"
import { loadSupabase } from "@/lib/supabase-browser"
import { clearChatHistory, readChatHistory, useChatHistory, type ChatMessage } from "@/lib/local-store"

export type { ChatMessage }

// Match the checks in the ai_messages table (migration 20260929090000).
const MESSAGE_MAX = 8000
/** How much of the conversation the panel shows; the database keeps 200. */
const SHOWN_MESSAGES = 100

type MessageRow = { id: number; role: ChatMessage["role"]; content: string; created_at: string }

async function fetchChat(): Promise<ChatMessage[]> {
  const supabase = await loadSupabase()
  const { data, error } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(SHOWN_MESSAGES)
  if (error) throw error
  return (data as MessageRow[])
    .reverse()
    .map((row) => ({ role: row.role, content: row.content, timestamp: row.created_at }))
}

function toRows(messages: ChatMessage[], withTimestamps: boolean) {
  return messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MESSAGE_MAX),
      ...(withTimestamps && !Number.isNaN(Date.parse(m.timestamp)) ? { created_at: m.timestamp } : {}),
    }))
}

/**
 * The conversation used to be kept per device. The first time a signed-in
 * user opens the assistant, that transcript is copied into the account and
 * then removed from the device.
 */
const imports = new Map<string, Promise<void>>()

function importLocalChat(userId: string): Promise<void> {
  const running = imports.get(userId)
  if (running) return running
  const job = (async () => {
    const rows = toRows(readChatHistory(), true)
    if (rows.length > 0) {
      const { error } = await (await loadSupabase()).from("ai_messages").insert(rows)
      if (error) throw error
    }
    clearChatHistory()
  })()
  imports.set(userId, job)
  job.catch(() => imports.delete(userId))
  return job
}

export type ChatData = {
  messages: ChatMessage[]
  ready: boolean
  loadFailed: boolean
  retry: () => void
  /** Saves messages to the account; they show at once, even before the save completes. */
  append: (messages: ChatMessage[]) => Promise<void>
  clear: () => Promise<void>
}

/** The signed-in user's conversation with the assistant, on every device. */
export function useChat(active: boolean): ChatData {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const legacy = useChatHistory()
  const key = active && userId ? (["ai_messages", userId] as const) : null
  const { data, error, mutate } = useSWR(key, fetchChat, { revalidateOnFocus: true, dedupingInterval: 5_000 })

  useEffect(() => {
    if (!active || !userId || legacy.length === 0) return
    importLocalChat(userId)
      .then(() => mutate())
      .catch((err) => console.error("Moving the chat to the account failed:", err))
  }, [active, userId, legacy.length, mutate])

  const append = useCallback(
    async (messages: ChatMessage[]) => {
      if (!userId) return
      await mutate(
        async (current) => {
          const { error: insertError } = await (await loadSupabase()).from("ai_messages").insert(toRows(messages, false))
          if (insertError) throw insertError
          return [...(current ?? []), ...messages]
        },
        // Kept on screen even if saving fails: the user has just read the answer.
        { optimisticData: (current) => [...(current ?? []), ...messages], rollbackOnError: false, revalidate: false }
      )
    },
    [userId, mutate]
  )

  const clear = useCallback(async () => {
    if (!userId) return
    await mutate(
      async () => {
        const { error: deleteError } = await (await loadSupabase()).from("ai_messages").delete().eq("user_id", userId)
        if (deleteError) throw deleteError
        return []
      },
      { optimisticData: [], rollbackOnError: true, revalidate: false }
    )
  }, [userId, mutate])

  return {
    messages: data ?? [],
    ready: !!userId && (data !== undefined || !!error),
    loadFailed: !!error && data === undefined,
    retry: () => void mutate(),
    append,
    clear,
  }
}
