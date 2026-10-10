"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Briefcase, Cloud, GraduationCap, Loader2, Plus, Save, Smartphone, Sparkles, StickyNote, Target, Trash2, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AuthForm } from "@/components/auth-form"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { formatDeadline } from "@/lib/deadline"
import { HTML_LANG } from "@/lib/i18n/config"
import { format, plural } from "@/lib/i18n/format"
import { NOTE_CONTENT_MAX, NOTE_TITLE_MAX, useNotesData, type Note } from "@/lib/notes"
import { cn } from "@/lib/utils"

const CATEGORY_STYLE: Record<Note["category"], { icon: LucideIcon; color: string }> = {
  goals: { icon: Target, color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  portfolio: { icon: Briefcase, color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  ideas: { icon: Sparkles, color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  other: { icon: GraduationCap, color: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
}
const NOTE_CATEGORIES = Object.keys(CATEGORY_STYLE) as Note["category"][]

const EMPTY_DRAFT = { title: "", content: "", category: "goals" as Note["category"] }
/** Edits are saved after this pause in typing, and when the editor closes. */
const AUTOSAVE_MS = 700

type Editing = { id: string; title: string; content: string }

/**
 * Notes: the account’s when signed in, this device’s otherwise. A tab of the
 * Portfolio panel; `active` is false while another tab is shown.
 */
export function NotesTab({ active }: { active: boolean }) {
  const { locale, t } = useI18n()
  const { user } = useAuth()
  const data = useNotesData(active)
  const { notes, update } = data
  const [isCreating, setIsCreating] = useState(false)
  const [creatingBusy, setCreatingBusy] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [showSignIn, setShowSignIn] = useState(false)

  // Typing edits a local copy, so a refresh from another device cannot
  // overwrite text mid-word and each keystroke is not a request.
  const notesRef = useRef(notes)
  useEffect(() => {
    notesRef.current = notes
  }, [notes])
  const scrollRef = useRef<HTMLDivElement>(null)
  const saveEdit = useCallback(
    (edit: Editing) => {
      const current = notesRef.current.find((n) => n.id === edit.id)
      if (!current || (current.title === edit.title && current.content === edit.content)) return
      update(edit.id, { title: edit.title, content: edit.content })
        .then(() => setSaveFailed(false))
        .catch(() => setSaveFailed(true))
    },
    [update]
  )

  useEffect(() => {
    if (!editing) return
    const timer = setTimeout(() => saveEdit(editing), AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [editing, saveEdit])

  const finishEditing = () => {
    if (editing) saveEdit(editing)
    setEditing(null)
  }

  // Leaving the tab (or closing the panel) saves an open edit; the editor
  // stays open, so coming back continues where it was.
  const editingRef = useRef(editing)
  useEffect(() => {
    editingRef.current = editing
  }, [editing])
  useEffect(() => {
    if (!active && editingRef.current) saveEdit(editingRef.current)
  }, [active, saveEdit])

  const addNote = async () => {
    if (!draft.title.trim() && !draft.content.trim()) return
    const now = new Date().toISOString()
    setCreatingBusy(true)
    try {
      await data.add({
        id: crypto.randomUUID(),
        title: draft.title.trim() || t.notes.untitled,
        content: draft.content,
        category: draft.category,
        createdAt: now,
        updatedAt: now,
      })
      setDraft(EMPTY_DRAFT)
      setIsCreating(false)
      setSaveFailed(false)
    } catch {
      // The form stays open with the text in it.
      setSaveFailed(true)
    } finally {
      setCreatingBusy(false)
    }
  }

  const deleteNote = (id: string) => {
    if (editing?.id === id) setEditing(null)
    data.remove(id).then(() => setSaveFailed(false), () => setSaveFailed(true))
  }

  const loadingAccount = active && !data.ready
  const [importBusy, setImportBusy] = useState(false)

  return (
    <div className="flex min-h-full flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 p-4">
          {data.devicePending > 0 && user && (
            <div role="region" aria-labelledby="device-notes-title" className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
              <h3 id="device-notes-title" className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Smartphone aria-hidden="true" className="h-4 w-4" />
                {t.localImport.title}
              </h3>
              <p className="text-sm text-gray-300">
                {plural(locale, data.devicePending, t.localImport.text)} {format(t.localImport.question, { email: user.email ?? "" })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={importBusy}
                  onClick={async () => {
                    setImportBusy(true)
                    try {
                      await data.importDevice()
                      setSaveFailed(false)
                    } catch {
                      setSaveFailed(true)
                    } finally {
                      setImportBusy(false)
                    }
                  }}
                  className="h-11"
                >
                  {importBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t.localImport.move}
                </Button>
                <Button variant="outline" className="h-11" onClick={data.keepDevice}>
                  {t.localImport.keep}
                </Button>
                <Button variant="ghost" className="h-11 text-red-300 hover:text-red-200" onClick={data.discardDevice}>
                  {t.localImport.discard}
                </Button>
              </div>
            </div>
          )}
          {!user && showSignIn && (
            <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-[#141a17] p-4">
              <AuthForm title={t.notes.syncTitle} description={t.notes.syncText} />
              <Button variant="ghost" className="h-11 w-full text-gray-400 hover:text-white" onClick={() => setShowSignIn(false)}>
                {t.notes.notNow}
              </Button>
            </div>
          )}

          {saveFailed && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {t.notes.saveError}
            </p>
          )}

          {loadingAccount ? (
            <div role="status" className="flex flex-col items-center gap-3 py-16 text-sm text-gray-400">
              <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-emerald-400" />
              {t.notes.loading}
            </div>
          ) : data.loadFailed ? (
            <div className="space-y-3 py-12 text-center">
              <p role="alert" className="text-sm text-gray-300">{t.notes.loadError}</p>
              <Button variant="outline" className="h-11" onClick={data.retry}>
                {t.notes.retry}
              </Button>
            </div>
          ) : (
            <>
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
                    maxLength={NOTE_TITLE_MAX}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    className="h-11 border-gray-700 bg-[#0d1210] text-base text-white placeholder:text-gray-500 sm:text-sm"
                  />
                  <Textarea
                    placeholder={t.notes.contentPlaceholder}
                    aria-label={t.notes.contentPlaceholder}
                    value={draft.content}
                    maxLength={NOTE_CONTENT_MAX}
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
                            "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-[transform,background-color] active:scale-95",
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
                  <Button
                    type="submit"
                    disabled={creatingBusy}
                    className="h-11 w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700"
                  >
                    {creatingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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
                  const title = note.title || t.notes.untitled
                  return (
                    <li key={note.id} className="rounded-xl border border-gray-800 bg-[#141a17] p-4 transition-colors hover:border-gray-700">
                      {editing?.id === note.id ? (
                        <div className="space-y-3">
                          <Input
                            aria-label={t.notes.titlePlaceholder}
                            value={editing.title}
                            maxLength={NOTE_TITLE_MAX}
                            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                            className="h-11 border-gray-700 bg-[#0d1210] text-base text-white sm:text-sm"
                          />
                          <Textarea
                            aria-label={t.notes.contentPlaceholder}
                            value={editing.content}
                            maxLength={NOTE_CONTENT_MAX}
                            // Opening a note for editing puts the cursor at the end of its text.
                            autoFocus
                            onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
                            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                            rows={4}
                            className="resize-none border-gray-700 bg-[#0d1210] text-base text-white sm:text-sm"
                          />
                          <Button onClick={finishEditing} className="h-11 bg-emerald-600 hover:bg-emerald-700 sm:h-9">
                            {t.notes.done}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (editing) saveEdit(editing)
                                setEditing({ id: note.id, title: note.title, content: note.content })
                              }}
                              aria-label={format(t.notes.edit, { title })}
                              className="min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            >
                              <h4 className="break-words font-medium text-white transition-colors hover:text-emerald-400">{title}</h4>
                              <p data-selectable className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-400">{note.content || t.notes.editHint}</p>
                            </button>
                            {/* Always visible on touch screens; revealed on hover or focus with a mouse. */}
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={format(t.notes.delete, { title })}
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
                              {formatDeadline(new Date(note.updatedAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" }), "short", HTML_LANG[locale])}
                            </time>
                          </div>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <div className="border-t border-gray-800 px-6 py-3">
          {data.synced ? (
            <p className="flex items-center gap-2 text-xs text-gray-400">
              <Cloud aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {t.notes.synced}
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              {t.notes.storedLocally}{" "}
              {!showSignIn && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSignIn(true)
                    scrollRef.current?.scrollTo({ top: 0 })
                  }}
                  className="inline-flex min-h-11 items-center text-emerald-400 underline-offset-2 hover:underline sm:min-h-0"
                >
                  {t.notes.signInToSync}
                </button>
              )}
            </p>
          )}
        </div>
    </div>
  )
}
