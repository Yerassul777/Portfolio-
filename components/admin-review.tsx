"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Check, ChevronDown, ExternalLink, Loader2, Pencil, Play, Plus, Quote, Trash2, TriangleAlert, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { getAccessToken, useAuth } from "@/components/auth-provider"
import { formatDeadline } from "@/lib/deadline"
import type { Locale } from "@/lib/i18n/config"
import { loadSupabase } from "@/lib/supabase-browser"
import { CATEGORIES, CATEGORY_LABELS, FILTER_CONFIGS, getFilterLabel, type Category } from "@/lib/types"
import { cn } from "@/lib/utils"

// /admin/review: what the nightly search found (Phase 6). Admins approve,
// edit or reject each find; nothing reaches the site without that. Also the
// run reports, the dry/live switch, "run now", and the list of sources.
// The database checks is_admin() on every read and write; this page only
// decides what to show.

type Find = {
  id: string
  kind: Category
  slug: string
  title: string
  description: string
  link: string | null
  deadline: string | null
  source_url: string | null
  source_name: string | null
  extraction_confidence: number | null
  evidence: string | null
  ingested_at: string | null
  [filter: string]: unknown
}

const FIND_COLUMNS =
  "id, kind, slug, title, description, link, deadline, source_url, source_name, extraction_confidence, evidence, ingested_at, subject, level, type, age_group, format, duration, city, field, requirements, grant_available"

async function fetchQueue(): Promise<Find[]> {
  const { data, error } = await (await loadSupabase())
    .from("opportunities")
    .select(FIND_COLUMNS)
    .eq("status", "pending")
    .order("extraction_confidence", { ascending: false, nullsFirst: false })
    .order("ingested_at", { ascending: false })
    .limit(50)
  if (error) throw error
  return data as Find[]
}

type Run = {
  id: string
  started_at: string
  finished_at: string | null
  trigger: "cron" | "manual"
  mode: "dry" | "live"
  stats: Record<string, number>
  items: { url: string; source: string; outcome: string; title?: string; deadline?: string | null; evidence?: string | null; confidence?: number; reason?: string }[]
  error: string | null
}

type Source = {
  id: string
  name: string
  listing_url: string
  link_pattern: string
  kind_hint: Category | null
  enabled: boolean
  max_new_per_run: number
  last_run_at: string | null
}

const OUTCOME_LABEL: Record<string, string> = {
  would_add: "добавил бы",
  inserted: "в очереди",
  updated: "обновлено",
  duplicate: "уже есть",
  not_opportunity: "не возможность",
  expired: "дедлайн прошёл",
  low_quality: "сомнительно",
  blocked: "запрещено robots.txt",
  error: "ошибка",
  queue_full: "очередь полна",
  run_limit: "лимит прогона",
  skipped: "пропущено",
}

const STATUS_LABEL: Record<string, string> = { published: "опубликовано", pending: "на проверке", archived: "в архиве" }

const dateTime = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" })

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value === null) return null
  const tone = value >= 0.8 ? "bg-emerald-500/15 text-emerald-300" : value >= 0.5 ? "bg-amber-500/15 text-amber-300" : "bg-red-500/15 text-red-300"
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", tone)}>{Math.round(value * 100)}%</span>
}

export function AdminReview({ locale }: { locale: Locale }) {
  const { user, loading } = useAuth()
  const [check, setCheck] = useState<{ userId: string; ok: boolean } | null>(null)
  const isAdmin = user && check?.userId === user.id ? check.ok : null
  const [tab, setTab] = useState<"queue" | "runs" | "sources">("queue")

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    loadSupabase()
      .then((s) => s.rpc("is_admin"))
      .then(({ data, error }) => !cancelled && setCheck({ userId, ok: !error && data === true }))
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading || (user && isAdmin === null)) {
    return (
      <div role="status" className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }
  if (!user || !isAdmin) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-muted-foreground">Эта страница только для администраторов.</p>
        <Button asChild variant="outline" className="h-11">
          <Link href={`/${locale}/admin`}>Войти в админ-панель</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Автопоиск" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["queue", "Очередь"],
            ["runs", "Прогоны"],
            ["sources", "Источники"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("min-h-11 rounded-lg text-sm font-medium transition-colors", tab === id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "queue" && <Queue locale={locale} />}
      {tab === "runs" && <Runs />}
      {tab === "sources" && <Sources />}
    </div>
  )
}

// --- the review queue -------------------------------------------------------------

function Queue({ locale }: { locale: Locale }) {
  const { data, error, isLoading, mutate } = useSWR("admin-review-queue", fetchQueue, { revalidateOnFocus: false })
  const [selected, setSelected] = useState(0)
  const [editing, setEditing] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const finds = useMemo(() => data ?? [], [data])
  const current = finds[Math.min(selected, Math.max(finds.length - 1, 0))]

  const decide = useCallback(
    async (find: Find, status: "published" | "rejected") => {
      setBusy(find.id)
      setMessage(null)
      const { error: updateError } = await (await loadSupabase()).from("opportunities").update({ status }).eq("id", find.id)
      setBusy(null)
      if (updateError) return setMessage("Не удалось сохранить. Попробуйте ещё раз.")
      await mutate((list) => (list ?? []).filter((f) => f.id !== find.id), { revalidate: false })
      setMessage(status === "published" ? `«${find.title}» опубликовано` : `«${find.title}» отклонено`)
    },
    [mutate]
  )

  // j/k to move, a to approve, r to reject, e to edit — not while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return
      if (!current || editing) return
      if (event.key === "j") setSelected((i) => Math.min(i + 1, finds.length - 1))
      else if (event.key === "k") setSelected((i) => Math.max(i - 1, 0))
      else if (event.key === "a") void decide(current, "published")
      else if (event.key === "r") void decide(current, "rejected")
      else if (event.key === "e") setEditing(current.id)
      else return
      event.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, editing, finds.length, decide])

  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
  if (error) return <p role="alert" className="text-center text-sm text-destructive-foreground">Не удалось загрузить очередь.</p>

  return (
    <section aria-label="Очередь находок" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {finds.length === 0
          ? "Очередь пуста. Новые находки появятся после прогона в боевом режиме."
          : `${finds.length} на проверке. Сначала самые уверенные. Клавиши: J/K — следующая/предыдущая, A — одобрить, R — отклонить, E — изменить.`}
      </p>
      {message && (
        <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
          {message}
        </p>
      )}
      <ul className="space-y-3">
        {finds.map((find, index) => (
          <li key={find.id}>
            {editing === find.id ? (
              <EditFind
                find={find}
                onDone={async (saved) => {
                  setEditing(null)
                  if (saved) await mutate()
                }}
              />
            ) : (
              <FindCard
                find={find}
                locale={locale}
                selected={find.id === current?.id}
                busy={busy === find.id}
                onSelect={() => setSelected(index)}
                onApprove={() => void decide(find, "published")}
                onReject={() => void decide(find, "rejected")}
                onEdit={() => setEditing(find.id)}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function FindCard({
  find,
  locale,
  selected,
  busy,
  onSelect,
  onApprove,
  onReject,
  onEdit,
}: {
  find: Find
  locale: Locale
  selected: boolean
  busy: boolean
  onSelect: () => void
  onApprove: () => void
  onReject: () => void
  onEdit: () => void
}) {
  const filters = FILTER_CONFIGS[find.kind]
    .map((config) => {
      const value = find[config.key as string]
      if (value === null || value === undefined || value === "") return null
      return `${config.label}: ${getFilterLabel(find.kind, config.key as string, String(value))}`
    })
    .filter(Boolean) as string[]
  // "Looks like …": only for the card being looked at.
  const { data: similar } = useSWR(selected ? ["admin-similar", find.id] : null, async () => {
    const { data } = await (await loadSupabase()).rpc("admin_similar_opportunities", { p_id: find.id })
    return (data ?? []) as { id: string; slug: string; title: string; status: string; score: number }[]
  })

  return (
    <article
      onClick={onSelect}
      className={cn("space-y-3 rounded-xl border bg-card p-4 transition-colors", selected ? "border-primary/50 ring-1 ring-primary/30" : "border-border")}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">{CATEGORY_LABELS[find.kind]}</span>
        <ConfidenceBadge value={find.extraction_confidence} />
        {find.source_name && <span>{find.source_name}</span>}
        {find.ingested_at && <span>· найдено {dateTime(find.ingested_at)}</span>}
      </div>
      <h3 className="break-words text-base font-semibold leading-snug text-foreground">{find.title}</h3>
      {find.description && <p className="break-words text-sm leading-relaxed text-muted-foreground">{find.description}</p>}
      <div className="space-y-1.5 text-sm">
        <p className={find.deadline ? "text-foreground" : "text-amber-300"}>
          Дедлайн: {find.deadline ? formatDeadline(find.deadline, "long", "ru-RU") : "не найден — проверьте на странице источника"}
        </p>
        {find.evidence && (
          <blockquote className="flex gap-2 rounded-lg border-l-2 border-primary/60 bg-muted/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            <Quote aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="break-words">{find.evidence}</span>
          </blockquote>
        )}
      </div>
      {filters.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <span key={f} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
              {f}
            </span>
          ))}
        </div>
      )}
      {similar && similar.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <p className="flex items-center gap-1.5 font-medium">
            <TriangleAlert aria-hidden="true" className="h-3.5 w-3.5" />
            Похоже на то, что уже есть:
          </p>
          {similar.map((s) => (
            <p key={s.id} className="break-words">
              {s.status === "published" ? (
                <a href={`/${locale}/o/${s.slug}`} target="_blank" rel="noopener" className="underline underline-offset-2">
                  {s.title}
                </a>
              ) : (
                s.title
              )}{" "}
              ({STATUS_LABEL[s.status] ?? s.status}, сходство {Math.round(s.score * 100)}%)
            </p>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" className="h-10" disabled={busy} onClick={(e) => (e.stopPropagation(), onApprove())}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Одобрить
        </Button>
        <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={(e) => (e.stopPropagation(), onEdit())}>
          <Pencil className="h-4 w-4" />
          Изменить
        </Button>
        <Button size="sm" variant="ghost" className="h-10 text-red-300 hover:text-red-200" disabled={busy} onClick={(e) => (e.stopPropagation(), onReject())}>
          <X className="h-4 w-4" />
          Отклонить
        </Button>
        {find.source_url && (
          <a
            href={find.source_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-auto inline-flex min-h-10 items-center gap-1 text-sm text-primary underline-offset-2 hover:underline"
          >
            Источник
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  )
}

function EditFind({ find, onDone }: { find: Find; onDone: (saved: boolean) => void }) {
  const [draft, setDraft] = useState({ kind: find.kind, title: find.title, description: find.description, link: find.link ?? "", deadline: find.deadline ?? "" })
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const field = "border-border bg-background text-base sm:text-sm"
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        setBusy(true)
        setFailed(false)
        const kindChanged = draft.kind !== find.kind
        const { error } = await (await loadSupabase())
          .from("opportunities")
          .update({
            kind: draft.kind,
            title: draft.title.trim(),
            description: draft.description.trim(),
            link: draft.link.trim() || null,
            deadline: draft.deadline || null,
            // A person checked it: the nightly job will not overwrite this text.
            reviewed_at: new Date().toISOString(),
            // Filters belong to a category; a new category starts without them.
            ...(kindChanged && { subject: null, level: null, type: null, age_group: null, format: null, duration: null, city: null, field: null, requirements: null, grant_available: null }),
          })
          .eq("id", find.id)
        setBusy(false)
        if (error) return setFailed(true)
        onDone(true)
      }}
      className="space-y-3 rounded-xl border border-primary/40 bg-card p-4"
    >
      <label className="block space-y-1 text-xs text-muted-foreground">
        Раздел
        <select
          value={draft.kind}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as Category })}
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground sm:text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs text-muted-foreground">
        Название
        <Input required maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={cn("h-11", field)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1 text-xs text-muted-foreground">
          Дедлайн
          <Input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} className={cn("h-11", field)} />
        </label>
        <label className="block space-y-1 text-xs text-muted-foreground">
          Ссылка
          <Input type="url" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} className={cn("h-11", field)} />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-muted-foreground">
        Описание
        <Textarea rows={4} maxLength={4000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={cn("resize-y", field)} />
      </label>
      {failed && (
        <p role="alert" className="text-sm text-red-300">
          Не удалось сохранить. Проверьте ссылку (нужен адрес с https://) и попробуйте ещё раз.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-11" disabled={busy || !draft.title.trim()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Сохранить
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => onDone(false)}>
          Отменить
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">После сохранения находка остаётся в очереди — одобрите её отдельно.</p>
    </form>
  )
}

// --- runs, mode and "run now" ------------------------------------------------------

function Runs() {
  const settings = useSWR("admin-ingest-settings", async () => {
    const { data, error } = await (await loadSupabase()).rpc("admin_ingest_settings")
    if (error) throw error
    return (data as { live: boolean; pending: number; max_pending: number }[])[0]
  })
  const runs = useSWR("admin-ingest-runs", async () => {
    const { data, error } = await (await loadSupabase()).from("ingest_runs").select("*").order("started_at", { ascending: false }).limit(15)
    if (error) throw error
    return data as Run[]
  })
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const live = settings.data?.live ?? false

  const runNow = async (dry: boolean) => {
    setRunning(true)
    setResult(null)
    try {
      const token = await getAccessToken()
      const response = await fetch("/api/cron/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dry }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) setResult(body.error ?? "Не удалось запустить.")
      else setResult(`Готово: ${summary(body.stats ?? {})}`)
      await Promise.all([runs.mutate(), settings.mutate()])
    } catch {
      setResult("Не удалось запустить.")
    } finally {
      setRunning(false)
    }
  }

  return (
    <section aria-label="Прогоны" className="space-y-5">
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <label htmlFor="ingest-live" className="text-sm font-medium text-foreground">
              Боевой режим
            </label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {live
                ? "Находки попадают в очередь на проверку. На сайт ничего не выходит без вашего одобрения."
                : "Пробный режим: робот только показывает, что добавил бы. Включайте боевой, когда неделю пробных прогонов выглядят разумно."}
            </p>
          </div>
          <Switch
            id="ingest-live"
            checked={live}
            disabled={!settings.data}
            onCheckedChange={async (checked) => {
              if (checked && !window.confirm("Включить боевой режим? Находки начнут попадать в очередь на проверку.")) return
              await (await loadSupabase()).rpc("admin_set_ingest_live", { p_live: checked })
              await settings.mutate()
            }}
          />
        </div>
        {settings.data && (
          <p className="text-xs text-muted-foreground">
            В очереди: {settings.data.pending} из {settings.data.max_pending} возможных.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button className="h-11" disabled={running} onClick={() => void runNow(true)} variant={live ? "outline" : "default"}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Пробный прогон
          </Button>
          {live && (
            <Button className="h-11" disabled={running} onClick={() => void runNow(false)}>
              <Play className="h-4 w-4" />
              Прогон с добавлением
            </Button>
          )}
        </div>
        {running && <p className="text-xs text-muted-foreground">Идёт прогон, до минуты…</p>}
        {result && (
          <p role="status" className="text-sm text-foreground">
            {result}
          </p>
        )}
      </div>

      {runs.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
      <ul className="space-y-2">
        {(runs.data ?? []).map((run) => (
          <li key={run.id} className="rounded-xl border border-border bg-card">
            <button
              type="button"
              aria-expanded={open === run.id}
              onClick={() => setOpen(open === run.id ? null : run.id)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", run.mode === "live" ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300")}>
                {run.mode === "live" ? "боевой" : "пробный"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-foreground">
                  {dateTime(run.started_at)} · {run.trigger === "cron" ? "по расписанию" : "вручную"}
                  {!run.finished_at && " · идёт"}
                </span>
                <span className="block truncate text-xs text-muted-foreground">{run.error ? `Ошибка: ${run.error}` : summary(run.stats)}</span>
              </span>
              <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open === run.id && "rotate-180")} />
            </button>
            {open === run.id && (
              <ul className="space-y-2 border-t border-border px-4 py-3">
                {run.items.length === 0 && <li className="text-xs text-muted-foreground">Новых страниц не было.</li>}
                {run.items.map((item, i) => (
                  <li key={`${item.url}-${i}`} className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">{OUTCOME_LABEL[item.outcome] ?? item.outcome}</span>
                      {typeof item.confidence === "number" && <ConfidenceBadge value={item.confidence} />}
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-primary underline-offset-2 hover:underline">
                        {item.title || item.url}
                      </a>
                    </div>
                    {item.deadline && <p className="text-muted-foreground">Дедлайн: {formatDeadline(item.deadline, "long", "ru-RU")}</p>}
                    {item.evidence && <p className="break-words italic text-muted-foreground">«{item.evidence}»</p>}
                    {item.reason && item.outcome !== "would_add" && <p className="text-muted-foreground">{item.reason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function summary(stats: Record<string, number>): string {
  const parts = [
    `страниц ${stats.pages ?? 0}`,
    stats.would_add ? `добавил бы ${stats.would_add}` : null,
    stats.inserted ? `в очередь ${stats.inserted}` : null,
    stats.updated ? `обновлено ${stats.updated}` : null,
    stats.not_opportunity ? `не возможности ${stats.not_opportunity}` : null,
    stats.expired ? `прошли ${stats.expired}` : null,
    stats.error ? `ошибок ${stats.error}` : null,
    typeof stats.cost_usd === "number" ? `$${stats.cost_usd.toFixed(3)}` : null,
  ]
  return parts.filter(Boolean).join(" · ")
}

// --- sources ----------------------------------------------------------------------

function Sources() {
  const { data, isLoading, mutate } = useSWR("admin-ingest-sources", async () => {
    const { data, error } = await (await loadSupabase()).from("ingest_sources").select("*").order("created_at")
    if (error) throw error
    return data as Source[]
  })
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: "", listing_url: "https://", link_pattern: "", kind_hint: "" as Category | "", max_new_per_run: 10 })
  const [error, setError] = useState<string | null>(null)
  const field = "h-11 border-border bg-background text-base sm:text-sm"

  return (
    <section aria-label="Источники" className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Робот открывает страницу-список источника, берёт ссылки, подходящие под шаблон, и читает только новые страницы — не больше указанного числа за прогон, раз в секунду, соблюдая robots.txt.
      </p>
      {isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />}
      <ul className="space-y-2">
        {(data ?? []).map((source) => (
          <li key={source.id} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-medium text-foreground">{source.name}</p>
                <a href={source.listing_url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-primary">
                  {source.listing_url}
                </a>
                <code className="block break-all text-xs text-muted-foreground">{source.link_pattern}</code>
                <p className="text-xs text-muted-foreground">
                  {source.kind_hint ? CATEGORY_LABELS[source.kind_hint] : "любой раздел"} · до {source.max_new_per_run} новых за прогон
                  {source.last_run_at && ` · последний прогон ${dateTime(source.last_run_at)}`}
                </p>
              </div>
              <Switch
                aria-label={`Включён: ${source.name}`}
                checked={source.enabled}
                onCheckedChange={async (enabled) => {
                  await (await loadSupabase()).from("ingest_sources").update({ enabled }).eq("id", source.id)
                  await mutate()
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground hover:text-red-300"
              onClick={async () => {
                if (!window.confirm(`Удалить источник «${source.name}»? Найденное им останется в каталоге.`)) return
                await (await loadSupabase()).from("ingest_sources").delete().eq("id", source.id)
                await mutate()
              }}
            >
              <Trash2 className="h-4 w-4" />
              Удалить
            </Button>
          </li>
        ))}
      </ul>
      {adding ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            const { error: insertError } = await (await loadSupabase())
              .from("ingest_sources")
              .insert({ ...draft, kind_hint: draft.kind_hint || null })
            if (insertError) return setError("Не сохранилось. Адрес должен начинаться с https://, шаблон — быть правильным регулярным выражением.")
            setAdding(false)
            setDraft({ name: "", listing_url: "https://", link_pattern: "", kind_hint: "", max_new_per_run: 10 })
            await mutate()
          }}
          className="space-y-3 rounded-xl border border-primary/40 bg-card p-4"
        >
          <Input required placeholder="Название, например «РНПЦ Дарын»" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} />
          <Input required type="url" placeholder="Страница-список: https://…" value={draft.listing_url} onChange={(e) => setDraft({ ...draft, listing_url: e.target.value })} className={field} />
          <Input required placeholder="Шаблон ссылок: ^https://site\.kz/events/[a-z0-9-]+/?$" value={draft.link_pattern} onChange={(e) => setDraft({ ...draft, link_pattern: e.target.value })} className={cn(field, "font-mono")} />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={draft.kind_hint}
              onChange={(e) => setDraft({ ...draft, kind_hint: e.target.value as Category | "" })}
              className="h-11 w-full rounded-md border border-border bg-background px-3 text-base text-foreground sm:text-sm"
            >
              <option value="">Раздел не известен</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <Input type="number" min={1} max={20} value={draft.max_new_per_run} onChange={(e) => setDraft({ ...draft, max_new_per_run: Number(e.target.value) })} aria-label="Новых страниц за прогон" className={field} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="h-11">
              Сохранить
            </Button>
            <Button type="button" variant="ghost" className="h-11" onClick={() => setAdding(false)}>
              Отменить
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="h-11" onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Добавить источник
        </Button>
      )}
    </section>
  )
}
