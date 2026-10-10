"use client"

import { useState, type ReactNode } from "react"
import { Download, Loader2, Pencil, Plus, Save, Trash2, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getAccessToken, useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { isIOS } from "@/lib/app-mode"
import { removePhotos, uploadPhoto, usePhotoUrls, type ScannedFields } from "@/lib/certificates"
import { isDeadlinePassed, formatDeadline } from "@/lib/deadline"
import { HTML_LANG } from "@/lib/i18n/config"
import { format } from "@/lib/i18n/format"
import {
  ENTRY_DESCRIPTION_MAX,
  ENTRY_TEXT_MAX,
  ENTRY_TITLE_MAX,
  usePortfolio,
  type EntryDraft,
  type EntryKind,
  type PortfolioEntry,
} from "@/lib/portfolio"
import { cn } from "@/lib/utils"
import { CertificateField, CertificateThumb, type PhotoState } from "./certificate-photo"
import { AccountOnly, EmptyState, LoadError, Spinner } from "./common"

const KINDS: EntryKind[] = ["olympiads", "competitions", "volunteering", "universities", "other"]
const EMPTY: EntryDraft = { kind: "olympiads", title: "", organizer: "", result: "", eventDate: null, description: "", status: "completed", certificatePath: null }

type Editing = { id: string | null; draft: EntryDraft; photo: PhotoState }

const photoOf = (draft: EntryDraft): PhotoState => (draft.certificatePath ? { kind: "saved", path: draft.certificatePath } : { kind: "none" })

/** Scanned fields fill what is still empty; what the user typed stays. */
function fillFrom(draft: EntryDraft, fields: ScannedFields): EntryDraft {
  return {
    ...draft,
    title: draft.title.trim() ? draft.title : fields.title,
    organizer: draft.organizer.trim() ? draft.organizer : fields.organizer,
    result: draft.result.trim() ? draft.result : fields.result,
    eventDate: draft.eventDate ?? fields.eventDate,
    kind: draft.title.trim() ? draft.kind : fields.kind,
  }
}

export function AchievementsTab() {
  const { t } = useI18n()
  return (
    <AccountOnly title={t.portfolio.signInTitle} text={t.portfolio.signInText}>
      <Achievements />
    </AccountOnly>
  )
}

function Achievements() {
  const { t } = useI18n()
  const { user } = useAuth()
  const portfolio = usePortfolio(true)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [failed, setFailed] = useState(false)
  const photoUrls = usePhotoUrls(portfolio.entries.flatMap((e) => (e.certificatePath ? [e.certificatePath] : [])))

  if (!portfolio.ready) return <Spinner />
  if (portfolio.loadFailed) return <LoadError text={t.portfolio.loadError} onRetry={portfolio.retry} />

  const participating = portfolio.entries.filter((e) => e.status === "participating")
  const completed = portfolio.entries.filter((e) => e.status === "completed")

  const run = async (action: () => Promise<void>) => {
    setFailed(false)
    try {
      await action()
      return true
    } catch {
      setFailed(true)
      return false
    }
  }

  // A new photo is uploaded first, then the entry saved; a replaced or removed
  // photo is deleted only once the entry no longer points at it.
  const save = async () => {
    if (!editing || !editing.draft.title.trim() || !user) return
    const { id, draft, photo } = editing
    const before = id ? (portfolio.entries.find((e) => e.id === id)?.certificatePath ?? null) : null
    let uploaded: string | null = null
    const ok = await run(async () => {
      if (photo.kind === "new") uploaded = await uploadPhoto(user.id, photo.blob)
      const certificatePath = photo.kind === "new" ? uploaded : photo.kind === "saved" ? photo.path : null
      try {
        await (id ? portfolio.update(id, { ...draft, certificatePath }) : portfolio.add({ ...draft, certificatePath }))
      } catch (error) {
        if (uploaded) await removePhotos([uploaded]).catch(() => {})
        throw error
      }
      if (before && before !== certificatePath) await removePhotos([before]).catch(() => {})
    })
    if (ok) setEditing(null)
  }

  const removeEntry = (entry: PortfolioEntry) =>
    run(async () => {
      await portfolio.remove(entry.id)
      if (entry.certificatePath) await removePhotos([entry.certificatePath]).catch(() => {})
    })

  const startEditing = (entry: PortfolioEntry) => setEditing({ id: entry.id, draft: toDraft(entry), photo: photoOf(toDraft(entry)) })

  const form = editing && (
    <EntryForm
      draft={editing.draft}
      onChange={(draft) => setEditing({ ...editing, draft })}
      onSave={save}
      onCancel={() => setEditing(null)}
      certificate={
        <CertificateField
          photo={editing.photo}
          savedUrl={editing.photo.kind === "saved" ? photoUrls[editing.photo.path] : undefined}
          onPhoto={(photo) => setEditing((current) => current && { ...current, photo })}
          onScanned={(fields) => setEditing((current) => current && { ...current, draft: fillFrom(current.draft, fields) })}
        />
      }
    />
  )

  return (
    <div className="space-y-5 p-4">
      {failed && (
        <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {t.portfolio.saveError}
        </p>
      )}

      {editing && editing.id === null ? (
        form
      ) : (
        <Button
          onClick={() => setEditing({ id: null, draft: EMPTY, photo: { kind: "none" } })}
          variant="outline"
          className="h-14 w-full border-dashed border-gray-700 bg-transparent text-gray-400 hover:border-emerald-500/50 hover:bg-gray-800/50 hover:text-white"
        >
          <Plus className="h-5 w-5" />
          {t.portfolio.add}
        </Button>
      )}

      {participating.length > 0 && (
        <section aria-labelledby="participating-title" className="space-y-3">
          <h3 id="participating-title" className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {t.portfolio.sectionParticipating}
          </h3>
          <ul className="space-y-3">
            {participating.map((entry) =>
              editing?.id === entry.id ? (
                <li key={entry.id}>{form}</li>
              ) : (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => startEditing(entry)}
                  onDelete={() => void removeEntry(entry)}
                  photoUrl={entry.certificatePath ? photoUrls[entry.certificatePath] : undefined}
                >
                  {entry.eventDate && isDeadlinePassed(entry.eventDate) ? (
                    <div className="space-y-2 border-t border-gray-800 pt-3">
                      <p className="text-sm font-medium text-amber-200">{t.portfolio.howDidItGo}</p>
                      <div className="flex flex-wrap gap-2">
                        {t.portfolio.resultChips.map((result) => (
                          <button
                            key={result}
                            type="button"
                            onClick={() => run(() => portfolio.update(entry.id, { status: "completed", result }))}
                            className="min-h-11 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-200 transition-[transform,background-color] hover:bg-emerald-500/20 active:scale-95"
                          >
                            {result}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="border-t border-gray-800 pt-3 text-xs text-gray-400">{t.portfolio.participatingHint}</p>
                  )}
                </EntryCard>
              )
            )}
          </ul>
        </section>
      )}

      <section aria-labelledby="completed-title" className="space-y-3">
        {/* Wraps: the PDF form, once open, takes a line of its own below the heading. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="completed-title" className="text-xs font-medium uppercase tracking-wider text-gray-400">
            {t.portfolio.sectionCompleted}
          </h3>
          {completed.length > 0 && <ExportButton />}
        </div>
        {completed.length === 0 && participating.length === 0 && !editing ? (
          <EmptyState icon={Trophy} title={t.portfolio.emptyTitle} text={t.portfolio.emptyText} />
        ) : (
          <ul className="space-y-3">
            {completed.map((entry) =>
              editing?.id === entry.id ? (
                <li key={entry.id}>{form}</li>
              ) : (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={() => startEditing(entry)}
                  onDelete={() => void removeEntry(entry)}
                  photoUrl={entry.certificatePath ? photoUrls[entry.certificatePath] : undefined}
                />
              )
            )}
          </ul>
        )}
      </section>
    </div>
  )
}

function toDraft(entry: PortfolioEntry): EntryDraft {
  const { kind, title, organizer, result, eventDate, description, status, certificatePath } = entry
  return { kind, title, organizer, result, eventDate, description, status, certificatePath }
}

function EntryCard({
  entry,
  onEdit,
  onDelete,
  photoUrl,
  children,
}: {
  entry: PortfolioEntry
  onEdit: () => void
  onDelete: () => void
  photoUrl?: string
  children?: ReactNode
}) {
  const { locale, t } = useI18n()
  return (
    <li className="space-y-3 rounded-xl border border-gray-800 bg-[#141a17] p-4">
      <div className="flex items-start justify-between gap-2">
        {entry.certificatePath && <CertificateThumb url={photoUrl} title={entry.title} />}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-emerald-300/80">
            {t.portfolio.kinds[entry.kind]}
            {entry.eventDate && <> · {formatDeadline(entry.eventDate, "short", HTML_LANG[locale])}</>}
          </p>
          <h4 className="break-words font-medium text-white">{entry.title}</h4>
          {(entry.result || entry.organizer) && (
            <p className="text-sm text-gray-400">
              {entry.result && <span className="font-medium text-amber-200">{entry.result}</span>}
              {entry.result && entry.organizer && " · "}
              {entry.organizer}
            </p>
          )}
          {entry.description && <p data-selectable className="whitespace-pre-wrap break-words text-sm text-gray-400">{entry.description}</p>}
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" aria-label={format(t.portfolio.edit, { title: entry.title })} onClick={onEdit} className="size-11 text-gray-400 hover:text-white">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={format(t.portfolio.delete, { title: entry.title })}
            onClick={onDelete}
            className="size-11 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {children}
    </li>
  )
}

function EntryForm({
  draft,
  onChange,
  onSave,
  onCancel,
  certificate,
}: {
  draft: EntryDraft
  onChange: (draft: EntryDraft) => void
  onSave: () => void
  onCancel: () => void
  /** The photo / scanner block, first in the form: scanning fills the fields below. */
  certificate: ReactNode
}) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const field = "border-gray-700 bg-[#0d1210] text-base text-white placeholder:text-gray-500 sm:text-sm"
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        await onSave()
        setBusy(false)
      }}
      className="space-y-3 rounded-xl border border-emerald-500/20 bg-[#141a17] p-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-gray-200">{t.portfolio.add}</h3>
        <Button type="button" variant="ghost" size="icon" aria-label={t.portfolio.cancel} className="size-11 text-gray-400 hover:text-white" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      {certificate}
      <label className="block space-y-1 text-xs text-gray-400">
        {t.portfolio.titleLabel}
        <Input required value={draft.title} maxLength={ENTRY_TITLE_MAX} onChange={(e) => onChange({ ...draft, title: e.target.value })} className={cn("h-11", field)} />
      </label>
      <div role="radiogroup" aria-label={t.portfolio.kindLabel} className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={draft.kind === kind}
            onClick={() => onChange({ ...draft, kind })}
            className={cn(
              "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors",
              draft.kind === kind ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-transparent bg-gray-800 text-gray-400 hover:bg-gray-700"
            )}
          >
            {t.portfolio.kinds[kind]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs text-gray-400">
          {t.portfolio.resultLabel}
          <Input
            value={draft.result}
            maxLength={ENTRY_TEXT_MAX}
            placeholder={t.portfolio.resultPlaceholder}
            onChange={(e) => onChange({ ...draft, result: e.target.value })}
            className={cn("h-11", field)}
          />
        </label>
        <label className="block space-y-1 text-xs text-gray-400">
          {t.portfolio.dateLabel}
          <Input type="date" value={draft.eventDate ?? ""} onChange={(e) => onChange({ ...draft, eventDate: e.target.value || null })} className={cn("h-11", field)} />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-gray-400">
        {t.portfolio.organizerLabel}
        <Input value={draft.organizer} maxLength={ENTRY_TEXT_MAX} onChange={(e) => onChange({ ...draft, organizer: e.target.value })} className={cn("h-11", field)} />
      </label>
      <label className="block space-y-1 text-xs text-gray-400">
        {t.portfolio.descriptionLabel}
        <Textarea
          value={draft.description}
          maxLength={ENTRY_DESCRIPTION_MAX}
          rows={3}
          onChange={(e) => onChange({ ...draft, description: e.target.value })}
          className={cn("resize-none", field)}
        />
      </label>
      <Button type="submit" disabled={busy || !draft.title.trim()} className="h-11 w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {t.portfolio.save}
      </Button>
    </form>
  )
}

/**
 * The portfolio as a PDF, made on the server (window.print does not work in an
 * installed iPhone app). The name is typed here, sent once, never stored.
 */
function ExportButton() {
  const { locale, t } = useI18n()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const download = async () => {
    setBusy(true)
    setFailed(false)
    try {
      const token = await getAccessToken()
      const response = await fetch("/api/portfolio/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim().slice(0, 80), locale }),
      })
      if (!response.ok) throw new Error(String(response.status))
      const file = new File([await response.blob()], "portfolio.pdf", { type: "application/pdf" })
      // iPhone and iPad: the share sheet saves to Files or sends it on.
      if (isIOS() && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => {})
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement("a")
        a.href = url
        a.download = "portfolio.pdf"
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
      setOpen(false)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="h-11 gap-2" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" />
        {t.portfolio.exportPdf}
      </Button>
    )
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void download()
      }}
      className="min-w-0 basis-full space-y-2 rounded-xl border border-gray-700 p-3"
    >
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder={t.print.namePlaceholder} aria-label={t.print.namePlaceholder} className="h-11 border-gray-700 bg-[#0d1210] text-base text-white sm:text-sm" />
      <p className="text-xs text-gray-400">{t.print.nameHint}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="h-11 min-w-0 flex-1">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t.print.print}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => setOpen(false)}>
          {t.portfolio.cancel}
        </Button>
      </div>
      {failed && (
        <p role="alert" className="text-xs text-red-300">
          {t.portfolio.saveError}
        </p>
      )}
      <p className="text-xs text-gray-500">{t.print.sharedComputer}</p>
    </form>
  )
}
