"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, ExternalLink, Flag, ListChecks, Loader2, Plus, RefreshCw, Search, Sparkles, Target, Trash2, TriangleAlert, Trophy, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FavoriteButton } from "@/components/favorite-button"
import { useI18n } from "@/components/i18n-provider"
import { catalogueHref } from "@/lib/catalogue"
import { HTML_LANG, type Locale } from "@/lib/i18n/config"
import { format } from "@/lib/i18n/format"
import { todayInKazakhstan } from "@/lib/profile"
import { opportunityPath } from "@/lib/site"
import { GOAL_MAX, GOALS_LIMIT, useGoals, type Goal, type GoalStep, type StepKind } from "@/lib/trajectory"
import { cn } from "@/lib/utils"

// "Моя траектория", the second view of the AI assistant: a goal, and a dated
// plan towards it built from the catalogue, the portfolio and the profile.

const KIND_ICON: Record<StepKind, LucideIcon> = { opportunity: Trophy, search: Search, task: ListChecks, gap: TriangleAlert }
const KIND_STYLE: Record<StepKind, string> = {
  opportunity: "bg-emerald-500/15 text-emerald-300",
  search: "bg-sky-500/15 text-sky-300",
  task: "bg-violet-500/15 text-violet-300",
  gap: "bg-amber-500/15 text-amber-300",
}

function monthLabel(month: string, locale: Locale): string {
  const text = new Date(`${month.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(HTML_LANG[locale], { month: "long", year: "numeric", timeZone: "UTC" })
  const clean = text.replace(/\s*г\.$/, "")
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

/** The next 36 months as YYYY-MM, for the "by when" picker. */
function nextMonths(): string[] {
  const [y, m] = todayInKazakhstan().split("-").map(Number)
  return Array.from({ length: 36 }, (_, i) => {
    const index = y * 12 + (m - 1) + i
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`
  })
}

export function Trajectory({ active, onLeave }: { active: boolean; onLeave: () => void }) {
  const { t } = useI18n()
  const data = useGoals(active)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  if (!data.ready) {
    return (
      <div role="status" className="flex flex-1 justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </div>
    )
  }
  if (data.loadFailed) {
    return (
      <div className="flex-1 space-y-3 px-6 py-12 text-center">
        <p role="alert" className="text-sm text-gray-300">{t.trajectory.loadError}</p>
        <Button variant="outline" className="h-11" onClick={data.retry}>
          {t.ai.retry}
        </Button>
      </div>
    )
  }

  const goal = data.goals.find((g) => g.id === selected) ?? data.goals[0]
  const showForm = creating || !goal

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-4">
        {data.goals.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {data.goals.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={!creating && g.id === goal?.id}
                onClick={() => {
                  setSelected(g.id)
                  setCreating(false)
                }}
                className={cn(
                  "flex min-h-11 max-w-56 shrink-0 items-center gap-2 rounded-full border px-4 text-sm transition-colors",
                  !creating && g.id === goal?.id ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" : "border-gray-800 text-gray-400 hover:text-gray-200"
                )}
              >
                <Target aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="truncate">{g.title}</span>
              </button>
            ))}
            {data.goals.length < GOALS_LIMIT && (
              <button
                type="button"
                aria-pressed={creating}
                onClick={() => setCreating(true)}
                className={cn(
                  "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm transition-colors",
                  creating ? "border-emerald-400/50 text-emerald-200" : "border-gray-700 text-gray-400 hover:text-gray-200"
                )}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t.trajectory.newGoal}
              </button>
            )}
          </div>
        )}
        {showForm ? (
          <GoalForm
            build={data.build}
            onBuilt={(id) => {
              setSelected(id)
              setCreating(false)
            }}
            onCancel={goal ? () => setCreating(false) : undefined}
          />
        ) : (
          <GoalView key={goal.id} goal={goal} data={data} onLeave={onLeave} onDeleted={() => setSelected(null)} />
        )}
      </div>
    </div>
  )
}

function GoalForm({
  build,
  onBuilt,
  onCancel,
}: {
  build: ReturnType<typeof useGoals>["build"]
  onBuilt: (id: string) => void
  onCancel?: () => void
}) {
  const { locale, t } = useI18n()
  const [goal, setGoal] = useState("")
  const [target, setTarget] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const months = nextMonths()

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        if (goal.trim().length < 3 || busy) return
        setBusy(true)
        setError(null)
        const outcome = await build({ goal: goal.trim(), targetMonth: target || null })
        setBusy(false)
        if (outcome.ok) onBuilt(outcome.goalId)
        else setError(outcome.message || t.trajectory.failed)
      }}
      className="space-y-4 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-[#10201a] to-[#0d1210] p-5"
    >
      <div className="space-y-1.5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Flag aria-hidden="true" className="h-5 w-5 text-emerald-400" />
          {t.trajectory.title}
        </h3>
        <p className="text-sm leading-relaxed text-gray-400">{t.trajectory.intro}</p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm text-gray-300">{t.trajectory.goalLabel}</span>
        <Textarea
          value={goal}
          maxLength={GOAL_MAX}
          rows={2}
          required
          placeholder={t.trajectory.goalPlaceholder}
          onChange={(e) => setGoal(e.target.value)}
          className="resize-none border-gray-700 bg-[#0d1210] text-base text-white placeholder:text-gray-500 sm:text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {t.trajectory.examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setGoal(example)}
            className="min-h-9 rounded-full border border-gray-700 px-3 text-xs text-gray-300 transition-colors hover:border-emerald-500/40 hover:text-white"
          >
            {example}
          </button>
        ))}
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm text-gray-300">{t.trajectory.targetLabel}</span>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-11 w-full rounded-md border border-gray-700 bg-[#0d1210] px-3 text-base text-white outline-none focus-visible:border-emerald-500/60 sm:text-sm"
        >
          <option value="">{t.trajectory.noTarget}</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m, locale)}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="text-sm text-amber-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || goal.trim().length < 3} className="h-11 min-w-0 flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {busy ? t.trajectory.building : t.trajectory.build}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" className="h-11 text-gray-300" onClick={onCancel}>
            {t.portfolio.cancel}
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-500">{t.trajectory.costNote}</p>
    </form>
  )
}

function GoalView({
  goal,
  data,
  onLeave,
  onDeleted,
}: {
  goal: Goal
  data: ReturnType<typeof useGoals>
  onLeave: () => void
  onDeleted: () => void
}) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const [busy, setBusy] = useState<null | "rebuild" | "delete">(null)
  const [error, setError] = useState<string | null>(null)
  const done = goal.steps.filter((s) => s.done).length
  const total = goal.steps.length
  const go = (href: string) => {
    onLeave()
    router.push(href)
  }

  const groups: { label: string; steps: GoalStep[] }[] = []
  for (const step of goal.steps) {
    const label = step.dueMonth ? monthLabel(step.dueMonth, locale) : t.trajectory.anytime
    const last = groups.at(-1)
    if (last && last.label === label) last.steps.push(step)
    else groups.push({ label, steps: [step] })
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-[#10201a] to-[#0d1210] p-5">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <Target className="h-5 w-5 text-emerald-300" />
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-lg font-semibold leading-snug text-white">{goal.title}</h3>
            <p className="text-sm text-emerald-300/80">
              {goal.targetMonth ? format(t.trajectory.by, { month: monthLabel(goal.targetMonth, locale).toLowerCase() }) : t.trajectory.noTarget}
            </p>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-gray-800" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={t.trajectory.progress}>
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-[width] duration-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <p className="text-xs text-gray-400">{format(t.trajectory.doneOf, { done, total })}</p>
        </div>
        {goal.summary && (
          <p data-selectable className="text-sm leading-relaxed text-gray-300">
            {goal.summary}
          </p>
        )}
      </section>

      <ol className="space-y-5">
        {groups.map((group) => (
          <li key={group.label} className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wider text-gray-400">{group.label}</h4>
            <ul className="space-y-2">
              {group.steps.map((step) => {
                const Icon = KIND_ICON[step.kind]
                return (
                  <li key={step.id} className={cn("flex gap-3 rounded-xl border border-gray-800 bg-[#141a17] p-3 transition-opacity", step.done && "opacity-60")}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={step.done}
                      aria-label={step.title}
                      onClick={() => void data.toggleStep(step.id, !step.done).catch(() => setError(t.portfolio.saveError))}
                      className="flex size-11 shrink-0 items-center justify-center rounded-full"
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                          step.done ? "border-emerald-400 bg-emerald-500 text-white" : "border-gray-600"
                        )}
                      >
                        {step.done && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1 space-y-1.5 py-1">
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", KIND_STYLE[step.kind])}>
                        <Icon aria-hidden="true" className="h-3 w-3" />
                        {t.trajectory.kinds[step.kind]}
                      </span>
                      <p className={cn("break-words font-medium leading-snug text-white", step.done && "line-through decoration-gray-500")}>{step.title}</p>
                      {step.detail && (
                        <p data-selectable className="break-words text-sm leading-relaxed text-gray-400">
                          {step.detail}
                        </p>
                      )}
                      {step.kind === "opportunity" && step.opportunity && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button type="button" variant="outline" size="sm" className="h-10 border-emerald-500/30 text-emerald-200" onClick={() => go(opportunityPath(locale, step.opportunity!.slug))}>
                            <ExternalLink className="h-4 w-4" />
                            {t.trajectory.open}
                          </Button>
                          <FavoriteButton opportunity={step.opportunity} />
                        </div>
                      )}
                      {step.kind === "search" && (
                        <div className="pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-10 border-sky-500/30 text-sky-200"
                            onClick={() =>
                              go(
                                catalogueHref(locale, {
                                  category: step.searchKind ?? "olympiads",
                                  q: step.searchQuery ?? "",
                                  filters: {},
                                  sort: "deadline",
                                  showPast: false,
                                  page: 1,
                                  open: null,
                                })
                              )
                            }
                          >
                            <Search className="h-4 w-4" />
                            {t.trajectory.find}
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="text-sm text-amber-300">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-gray-800 pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          className="h-11 border-gray-700 text-gray-200"
          onClick={async () => {
            if (!window.confirm(t.trajectory.rebuildConfirm)) return
            setBusy("rebuild")
            setError(null)
            const outcome = await data.build({ goal: goal.title, targetMonth: goal.targetMonth?.slice(0, 7) ?? null, goalId: goal.id })
            setBusy(null)
            if (!outcome.ok) setError(outcome.message || t.trajectory.failed)
          }}
        >
          {busy === "rebuild" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {busy === "rebuild" ? t.trajectory.building : t.trajectory.rebuild}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy !== null}
          className="h-11 text-gray-400 hover:text-red-300"
          onClick={async () => {
            if (!window.confirm(t.trajectory.deleteConfirm)) return
            setBusy("delete")
            try {
              await data.removeGoal(goal.id)
              onDeleted()
            } catch {
              setError(t.portfolio.saveError)
            } finally {
              setBusy(null)
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
          {t.trajectory.delete}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-gray-500">{t.trajectory.disclaimer}</p>
    </div>
  )
}
