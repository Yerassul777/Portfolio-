"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { ChevronDown, Loader2 } from "lucide-react"
import { AdminOnly } from "@/components/admin-gate"
import type { Locale } from "@/lib/i18n/config"
import { loadSupabase } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"

// /admin/diagnostics: what lib/diagnostics.ts collected on real devices over
// the last week — errors grouped by message, and every start of the installed
// app with where its time went. Read-only; the reports are kept 30 days.

type Device = { ua?: string; screen?: [number, number, number]; touch?: number }
type Row = { id: number; created_at: string; kind: "error" | "launch"; build: string | null; report: Record<string, unknown> & { device?: Device } }
type Steps = Partial<Record<"hydrated" | "intro" | "warm" | "finale" | "landed", number>>
type Frames = { frames: number; slow: number; worst: number }

const DAYS = 7

async function fetchReports(): Promise<Row[]> {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString()
  const { data, error } = await (await loadSupabase())
    .from("client_reports")
    .select("id, created_at, kind, build, report")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000)
  if (error) throw error
  return data as Row[]
}

const dateTime = (iso: string) => new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" })

/** "iPad 810×1080@2": enough to tell the model. */
function deviceLabel(device: Device | undefined): string {
  const ua = device?.ua ?? ""
  const kind = /iPad/.test(ua) || (/Macintosh/.test(ua) && (device?.touch ?? 0) > 1) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "Mac" : "?"
  const [w, h, dpr] = device?.screen ?? []
  return w ? `${kind} ${w}×${h}@${dpr}` : kind
}

const median = (values: number[]) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : undefined
}

const seconds = (value: number | undefined) => (value === undefined ? "—" : `${(value / 1000).toFixed(2)} с`)

export function AdminDiagnostics({ locale }: { locale: Locale }) {
  return (
    <AdminOnly locale={locale}>
      <Reports />
    </AdminOnly>
  )
}

function Reports() {
  const [tab, setTab] = useState<"errors" | "launches">("errors")
  const { data, error, isLoading } = useSWR("admin-diagnostics", fetchReports)
  const errors = useMemo(() => (data ?? []).filter((row) => row.kind === "error"), [data])
  const launches = useMemo(() => (data ?? []).filter((row) => row.kind === "launch"), [data])

  if (isLoading) return <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
  if (error) return <p className="text-center text-sm text-destructive">Не удалось загрузить отчёты.</p>

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Диагностика" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(
          [
            ["errors", `Ошибки (${errors.length})`],
            ["launches", `Запуски (${launches.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("h-10 rounded-lg text-sm font-medium transition-colors", tab === id ? "bg-background text-foreground shadow" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">За последние {DAYS} дней. Отчёты анонимные и хранятся 30 дней.</p>
      {tab === "errors" ? <Errors rows={errors} /> : <Launches rows={launches} />}
    </div>
  )
}

function Errors({ rows }: { rows: Row[] }) {
  const groups = useMemo(() => {
    const byMessage = new Map<string, Row[]>()
    for (const row of rows) {
      const key = String(row.report.message ?? "")
      byMessage.set(key, [...(byMessage.get(key) ?? []), row])
    }
    return [...byMessage.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [rows])

  if (!groups.length) return <p className="py-8 text-center text-muted-foreground">Ошибок нет.</p>
  return (
    <ul className="space-y-3">
      {groups.map(([message, group]) => (
        <ErrorGroup key={message} message={message} rows={group} />
      ))}
    </ul>
  )
}

function ErrorGroup({ message, rows }: { message: string; rows: Row[] }) {
  const [open, setOpen] = useState(false)
  const [latest] = rows
  const devices = [...new Set(rows.map((row) => deviceLabel(row.report.device)))]
  const builds = [...new Set(rows.map((row) => row.build ?? "?"))]

  return (
    <li className="rounded-xl border bg-card p-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium tabular-nums text-red-300">{rows.length}</span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block break-words text-sm font-medium text-foreground">{message || "(без текста)"}</span>
          <span className="block text-xs text-muted-foreground">
            последняя {dateTime(latest.created_at)} · {devices.slice(0, 3).join(", ")}
            {devices.length > 3 && ` и ещё ${devices.length - 3}`} · сборки {builds.join(", ")}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words" data-selectable>
          {JSON.stringify(latest.report, null, 2)}
        </pre>
      )}
    </li>
  )
}

function Launches({ rows }: { rows: Row[] }) {
  const summary = useMemo(() => {
    const byDevice = new Map<string, Row[]>()
    for (const row of rows) {
      const label = deviceLabel(row.report.device)
      byDevice.set(label, [...(byDevice.get(label) ?? []), row])
    }
    return [...byDevice.entries()].map(([label, group]) => {
      const steps = group.map((row) => (row.report.steps ?? {}) as Steps)
      const firstPaint = median(group.map((row) => Number(row.report.firstPaint)))
      return { label, count: group.length, firstPaint, landed: median(steps.map((s) => Number(s.landed))) }
    })
  }, [rows])

  if (!rows.length) return <p className="py-8 text-center text-muted-foreground">Запусков приложения ещё не было.</p>
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Устройство</th>
              <th className="p-3 font-medium">Запусков</th>
              <th className="p-3 font-medium">Первый кадр</th>
              <th className="p-3 font-medium">Готово к работе</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((device) => (
              <tr key={device.label} className="border-t">
                <td className="p-3">{device.label}</td>
                <td className="p-3 tabular-nums">{device.count}</td>
                <td className="p-3 tabular-nums">{seconds(device.firstPaint)}</td>
                <td className="p-3 tabular-nums">{seconds(device.landed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">Медианы, от начала загрузки страницы. Ниже — каждый запуск.</p>
      <ul className="space-y-3">
        {rows.slice(0, 50).map((row) => (
          <Launch key={row.id} row={row} />
        ))}
      </ul>
    </div>
  )
}

function Launch({ row }: { row: Row }) {
  const [open, setOpen] = useState(false)
  const steps = (row.report.steps ?? {}) as Steps
  const intro = row.report.introFrames as Frames | undefined
  // The finale is planned at 750 ms (lib/launch-screen.ts); a busy device lands later.
  const finale = steps.finale && steps.landed ? steps.landed - steps.finale : undefined

  return (
    <li className="rounded-xl border bg-card p-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block text-sm font-medium text-foreground">
            {deviceLabel(row.report.device)} · первый кадр {seconds(Number(row.report.firstPaint))} · готово {seconds(steps.landed)}
          </span>
          <span className="block text-xs text-muted-foreground">
            {dateTime(row.created_at)} · сборка {row.build ?? "?"} · интро: медленных кадров {intro ? `${intro.slow} из ${intro.frames}, худший ${intro.worst} мс` : "—"} · финал {finale === undefined ? "—" : `${finale} мс`}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap break-words" data-selectable>
          {JSON.stringify(row.report, null, 2)}
        </pre>
      )}
    </li>
  )
}
