"use client"

import { useSyncExternalStore } from "react"

// Device-local data (notes, AI chat). Every read tolerates missing or corrupted
// storage, so a bad value can never take the page down.

export interface Note {
  id: string
  title: string
  content: string
  category: "goals" | "portfolio" | "ideas" | "other"
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

const CHANGE_EVENT = "portfolio-local-store"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNote(value: unknown): value is Note {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    typeof value.category === "string"
  )
}

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    isRecord(value) &&
    (value.role === "user" || value.role === "assistant") &&
    typeof value.content === "string"
  )
}

function createStore<T>(key: string, isItem: (value: unknown) => value is T) {
  const empty: T[] = []
  let cachedRaw: string | null | undefined
  let cachedValue: T[] = empty

  function read(): T[] {
    let raw: string | null = null
    try {
      raw = localStorage.getItem(key)
    } catch {
      return empty
    }
    // useSyncExternalStore needs the same array back while storage is unchanged.
    if (raw === cachedRaw) return cachedValue
    cachedRaw = raw
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : []
      cachedValue = Array.isArray(parsed) ? parsed.filter(isItem) : empty
    } catch {
      cachedValue = empty
    }
    return cachedValue
  }

  function write(items: T[] | null) {
    try {
      if (items === null) localStorage.removeItem(key)
      else localStorage.setItem(key, JSON.stringify(items))
    } catch {
      // Storage full or unavailable (private mode): keep working without persistence.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  function subscribe(onChange: () => void) {
    window.addEventListener("storage", onChange)
    window.addEventListener(CHANGE_EVENT, onChange)
    return () => {
      window.removeEventListener("storage", onChange)
      window.removeEventListener(CHANGE_EVENT, onChange)
    }
  }

  function useItems(): T[] {
    return useSyncExternalStore(subscribe, read, () => empty)
  }

  return { read, write, useItems }
}

const notesStore = createStore("portfolio-notes", isNote)
const chatStore = createStore("ai-chat-history", isChatMessage)

export const useNotes = notesStore.useItems
export const readNotes = notesStore.read
export const saveNotes = (notes: Note[]) => notesStore.write(notes)

export const useChatHistory = chatStore.useItems
export const saveChatHistory = (messages: ChatMessage[]) => chatStore.write(messages)
export const clearChatHistory = () => chatStore.write(null)
