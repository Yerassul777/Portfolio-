"use client"

import { useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { Bot, StickyNote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/components/i18n-provider"

// The two panels (chat, notes, sign-in form, their data layers) are a large
// part of the site's JavaScript and nothing on first paint needs them. The
// header renders only the buttons; each panel's code is fetched when the
// browser is idle, or as soon as a finger or pointer reaches its button.
const loadAI = () => import("@/components/ai-assistant")
const loadNotes = () => import("@/components/notes-workspace")
const AIAssistantPanel = dynamic(() => loadAI().then((m) => m.AIAssistantPanel), { ssr: false })
const NotesPanel = dynamic(() => loadNotes().then((m) => m.NotesPanel), { ssr: false })

type Panel = "ai" | "notes"

export function HeaderTools() {
  const { t } = useI18n()
  const [open, setOpen] = useState<Panel | null>(null)
  // A panel stays mounted after its first opening: it keeps its state
  // (a half-typed message) and can play its closing animation.
  const [mounted, setMounted] = useState<Record<Panel, boolean>>({ ai: false, notes: false })
  const aiRef = useRef<HTMLButtonElement>(null)
  const notesRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const warm = () => {
      loadAI().catch(() => {})
      loadNotes().catch(() => {})
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(warm, 3000)
    return () => window.clearTimeout(id)
  }, [])

  const show = (panel: Panel) => {
    setMounted((current) => (current[panel] ? current : { ...current, [panel]: true }))
    setOpen(panel)
  }
  const onOpenChange = (panel: Panel) => (next: boolean) => setOpen(next ? panel : null)

  return (
    <>
      <Button
        ref={aiRef}
        variant="outline"
        aria-label={t.ai.open}
        aria-haspopup="dialog"
        aria-expanded={open === "ai"}
        onPointerDown={() => void loadAI().catch(() => {})}
        onClick={() => show("ai")}
        className="group relative size-11 gap-2 overflow-hidden rounded-full border-emerald-600 bg-gradient-to-r from-emerald-500/10 to-green-600/10 p-0 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-300 sm:h-9 sm:w-auto sm:px-3"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 transition-transform duration-1000 group-hover:translate-x-[100%]"
        />
        <Bot className="relative z-10 h-4 w-4" />
        <span className="relative z-10 hidden sm:inline">{t.ai.open}</span>
      </Button>
      <Button
        ref={notesRef}
        variant="outline"
        aria-label={t.notes.open}
        aria-haspopup="dialog"
        aria-expanded={open === "notes"}
        onPointerDown={() => void loadNotes().catch(() => {})}
        onClick={() => show("notes")}
        className="size-11 gap-2 rounded-full border-gray-700 bg-transparent p-0 text-gray-300 hover:border-emerald-500/50 hover:bg-gray-800/50 hover:text-white sm:h-9 sm:w-auto sm:px-3"
      >
        <StickyNote className="h-4 w-4" />
        <span className="hidden sm:inline">{t.notes.open}</span>
      </Button>

      {mounted.ai && <AIAssistantPanel open={open === "ai"} onOpenChange={onOpenChange("ai")} returnFocusRef={aiRef} />}
      {mounted.notes && <NotesPanel open={open === "notes"} onOpenChange={onOpenChange("notes")} returnFocusRef={notesRef} />}
    </>
  )
}
