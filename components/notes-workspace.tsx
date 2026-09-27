"use client"

import { useState } from "react"
import { Briefcase, GraduationCap, Plus, Save, Sparkles, StickyNote, Target, Trash2, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useI18n } from "@/components/i18n-provider"
import { HTML_LANG } from "@/lib/i18n/config"
import { format } from "@/lib/i18n/format"
import { saveNotes, useNotes, type Note } from "@/lib/local-store"
import { cn } from "@/lib/utils"

const CATEGORY_STYLE: Record<Note["category"], { icon: LucideIcon; color: string }> = {
  goals: { icon: Target, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  portfolio: { icon: Briefcase, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  ideas: { icon: Sparkles, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  other: { icon: GraduationCap, color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
}
const NOTE_CATEGORIES = Object.keys(CATEGORY_STYLE) as Note["category"][]

const EMPTY_DRAFT = { title: "", content: "", category: "goals" as Note["category"] }

export function NotesWorkspace() {
  const { locale, t } = useI18n()
  const notes = useNotes()
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)

  const addNote = () => {
    if (!draft.title.trim() && !draft.content.trim()) return
    const now = new Date().toISOString()
    saveNotes([
      {
        id: crypto.randomUUID(),
        title: draft.title.trim() || t.notes.untitled,
        content: draft.content,
        category: draft.category,
        createdAt: now,
        updatedAt: now,
      },
      ...notes,
    ])
    setDraft(EMPTY_DRAFT)
    setIsCreating(false)
  }

  const updateNote = (id: string, updates: Partial<Note>) => {
    saveNotes(notes.map((note) => (note.id === id ? { ...note, ...updates, updatedAt: new Date().toISOString() } : note)))
  }

  const deleteNote = (id: string) => {
    saveNotes(notes.filter((note) => note.id !== id))
    if (editingId === id) setEditingId(null)
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          aria-label={t.notes.open}
          className="size-11 gap-2 rounded-full border-gray-700 bg-transparent p-0 text-gray-300 hover:border-emerald-500/50 hover:bg-gray-800/50 hover:text-white sm:h-9 sm:w-auto sm:px-3"
        >
          <StickyNote className="h-4 w-4" />
          <span className="hidden sm:inline">{t.notes.open}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden border-gray-800 bg-[#0d1210] p-0 sm:w-[90vw] sm:max-w-[600px] md:w-[600px] [&>button]:hidden"
      >
        <SheetHeader className="border-b border-gray-800 bg-[#0a0f0d] px-6 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-white">
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-600">
                <StickyNote className="h-4 w-4 text-white" />
              </span>
              {t.notes.title}
            </SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label={t.notes.close} className="size-11 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white">
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="mt-1 text-sm text-gray-400">{t.notes.subtitle}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          {isCreating ? (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                addNote()
              }}
              className="space-y-3 rounded-xl border border-gray-800 bg-[#141a17] p-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-gray-200">{t.notes.newNote}</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t.notes.cancel}
                  className="size-11 text-gray-400 hover:text-white sm:size-8"
                  onClick={() => setIsCreating(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder={t.notes.titlePlaceholder}
                aria-label={t.notes.titlePlaceholder}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className="h-11 border-gray-700 bg-[#0d1210] text-base text-white placeholder:text-gray-500 sm:text-sm"
              />
              <Textarea
                placeholder={t.notes.contentPlaceholder}
                aria-label={t.notes.contentPlaceholder}
                value={draft.content}
                onChange={(e) => setDraft({ ...draft, content: e.target.value })}
                rows={4}
                className="resize-none border-gray-700 bg-[#0d1210] text-base text-white placeholder:text-gray-500 sm:text-sm"
              />
              <div role="radiogroup" aria-label={t.notes.categoryLabel} className="flex flex-wrap gap-2">
                {NOTE_CATEGORIES.map((category) => {
                  const selected = draft.category === category
                  return (
                    <button
                      key={category}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setDraft({ ...draft, category })}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all active:scale-95",
                        selected
                          ? `${CATEGORY_STYLE[category].color} ring-2 ring-emerald-500/40 ring-offset-2 ring-offset-[#141a17]`
                          : "border-transparent bg-gray-800 text-gray-400 hover:bg-gray-700"
                      )}
                    >
                      {t.notes.categories[category]}
                    </button>
                  )
                })}
              </div>
              <Button type="submit" className="h-11 w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700">
                <Save className="h-4 w-4" />
                {t.notes.save}
              </Button>
            </form>
          ) : (
            <Button
              onClick={() => setIsCreating(true)}
              variant="outline"
              className="h-16 w-full border-dashed border-gray-700 bg-transparent text-gray-400 hover:border-emerald-500/50 hover:bg-gray-800/50 hover:text-white"
            >
              <Plus className="h-5 w-5" />
              {t.notes.create}
            </Button>
          )}

          {notes.length === 0 && !isCreating && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800/50">
                <StickyNote aria-hidden="true" className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400">{t.notes.emptyTitle}</p>
              <p className="mt-1 text-xs text-gray-400">{t.notes.emptyText}</p>
            </div>
          )}

          <ul className="space-y-3">
            {notes.map((note) => {
              const style = CATEGORY_STYLE[note.category] ?? CATEGORY_STYLE.other
              const Icon = style.icon
              return (
                <li key={note.id} className="rounded-xl border border-gray-800 bg-[#141a17] p-4 transition-colors hover:border-gray-700">
                  {editingId === note.id ? (
                    <div className="space-y-3">
                      <Input
                        aria-label={t.notes.titlePlaceholder}
                        value={note.title}
                        onChange={(e) => updateNote(note.id, { title: e.target.value })}
                        className="h-11 border-gray-700 bg-[#0d1210] text-base text-white sm:text-sm"
                      />
                      <Textarea
                        aria-label={t.notes.contentPlaceholder}
                        value={note.content}
                        onChange={(e) => updateNote(note.id, { content: e.target.value })}
                        rows={4}
                        className="resize-none border-gray-700 bg-[#0d1210] text-base text-white sm:text-sm"
                      />
                      <Button onClick={() => setEditingId(null)} className="h-11 bg-emerald-600 hover:bg-emerald-700 sm:h-9">
                        {t.notes.done}
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(note.id)}
                          aria-label={format(t.notes.edit, { title: note.title })}
                          className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                        >
                          <h4 className="font-medium text-white transition-colors hover:text-emerald-400">{note.title}</h4>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-400">{note.content || t.notes.editHint}</p>
                        </button>
                        {/* Always visible on touch screens; revealed on hover or focus with a mouse. */}
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={format(t.notes.delete, { title: note.title })}
                          onClick={() => deleteNote(note.id)}
                          className="size-11 shrink-0 text-gray-400 hover:bg-red-500/10 hover:text-red-400 sm:size-8 [@media(hover:hover)]:opacity-60 [@media(hover:hover)]:hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3">
                        <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs", style.color)}>
                          <Icon aria-hidden="true" className="h-3 w-3" />
                          {t.notes.categories[note.category] ?? t.notes.categories.other}
                        </span>
                        <time dateTime={note.updatedAt} className="text-xs text-gray-400">
                          {new Date(note.updatedAt).toLocaleDateString(HTML_LANG[locale])}
                        </time>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <div className="border-t border-gray-800 bg-[#0a0f0d] px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <p className="text-xs text-gray-400">{t.notes.storedLocally}</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
