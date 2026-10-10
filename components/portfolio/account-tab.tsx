"use client"

import { useState } from "react"
import { Check, FileText, Loader2, LogOut, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/components/auth-provider"
import { PolicyDialog } from "@/components/consent"
import { useI18n } from "@/components/i18n-provider"
import { AVATAR_GRADIENTS, UserAvatar } from "@/components/user-avatar"
import { useConsents } from "@/lib/consent"
import { formatDeadline } from "@/lib/deadline"
import { HTML_LANG } from "@/lib/i18n/config"
import { format, plural } from "@/lib/i18n/format"
import {
  CITY_MAX,
  GRADES,
  INTERESTS_MAX,
  NAME_MAX,
  NICKNAME_MAX,
  ageOn,
  shownName,
  todayInKazakhstan,
  useProfile,
  type Grade,
  type Profile,
} from "@/lib/profile"
import { loadSupabase } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"
import { AccountOnly, LoadError, Spinner } from "./common"

const CITIES = [
  "Алматы", "Астана", "Шымкент", "Караганда", "Актобе", "Тараз", "Павлодар", "Усть-Каменогорск", "Семей", "Атырау",
  "Костанай", "Кызылорда", "Уральск", "Петропавловск", "Актау", "Туркестан", "Кокшетау", "Талдыкорган", "Экибастуз", "Жезказган",
]

export function AccountTab() {
  const { t } = useI18n()
  return (
    <AccountOnly title={t.account.title} text={t.favorites.signInText}>
      <Account />
    </AccountOnly>
  )
}

function Account() {
  const { t } = useI18n()
  const { profile, ready, loadFailed, retry, save } = useProfile()
  if (!ready) return <Spinner />
  if (loadFailed || !profile) return <LoadError text={t.account.loadError} onRetry={retry} />
  return (
    <div className="space-y-5 p-4">
      <ProfileForm profile={profile} save={save} />
      <Settings />
    </div>
  )
}

type Draft = { displayName: string; nickname: string; grade: Grade | ""; city: string; interests: string; avatarColor: number }

const draftOf = (p: Profile): Draft => ({
  displayName: p.displayName ?? "",
  nickname: p.nickname ?? "",
  grade: p.grade ?? "",
  city: p.city ?? "",
  interests: p.interests ?? "",
  avatarColor: p.avatarColor,
})

function ProfileForm({ profile, save }: { profile: Profile; save: ReturnType<typeof useProfile>["save"] }) {
  const { locale, t } = useI18n()
  const { user } = useAuth()
  const [draft, setDraft] = useState<Draft>(() => draftOf(profile))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<null | "saved" | "error" | "nickname">(null)
  const initial = draftOf(profile)
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const nicknameOk = !draft.nickname.trim() || /^@?[^\s@]{2,32}$/.test(draft.nickname.trim())
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setStatus(null)
  }
  const name = shownName({ ...profile, displayName: draft.displayName || null, nickname: draft.nickname || null }, user?.email)
  const age = profile.birthDate ? ageOn(profile.birthDate, todayInKazakhstan()) : null
  const field = "h-11 border-gray-700 bg-[#0d1210] text-base text-white sm:text-sm"

  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        if (!dirty || !nicknameOk) return
        setBusy(true)
        try {
          const saved = await save({ ...draft, grade: draft.grade || null })
          // As stored (trimmed, "@" dropped), so the form is no longer "changed".
          if (saved) setDraft(draftOf(saved))
          setStatus("saved")
        } catch {
          setStatus("error")
        } finally {
          setBusy(false)
        }
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-4 rounded-2xl border border-gray-800 bg-gradient-to-br from-[#141a17] to-[#0f1512] p-4">
        <UserAvatar name={name} color={draft.avatarColor} className="h-16 w-16 text-2xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-white">{name}</p>
          {draft.nickname.trim() && <p className="truncate text-sm text-emerald-300">@{draft.nickname.trim().replace(/^@/, "")}</p>}
          <p className="truncate text-xs text-gray-400">{user?.email}</p>
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{t.account.avatarColor}</legend>
        <div className="flex flex-wrap gap-2">
          {AVATAR_GRADIENTS.map((gradient, i) => (
            <button
              key={gradient}
              type="button"
              aria-label={format(t.account.colorN, { n: i + 1 })}
              aria-pressed={draft.avatarColor === i}
              onClick={() => set({ avatarColor: i })}
              className={cn(
                "flex size-11 items-center justify-center rounded-full bg-gradient-to-br transition-transform active:scale-90",
                gradient,
                draft.avatarColor === i && "ring-2 ring-white ring-offset-2 ring-offset-[#0d1210]"
              )}
            >
              {draft.avatarColor === i && <Check aria-hidden="true" className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm text-gray-300">{t.account.name}</span>
          <Input value={draft.displayName} maxLength={NAME_MAX} autoComplete="given-name" placeholder={t.account.namePlaceholder} onChange={(e) => set({ displayName: e.target.value })} className={field} />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-gray-300">{t.account.nickname}</span>
          <Input
            value={draft.nickname}
            maxLength={NICKNAME_MAX + 1}
            autoComplete="nickname"
            autoCapitalize="none"
            placeholder="@nickname"
            aria-invalid={!nicknameOk}
            onChange={(e) => set({ nickname: e.target.value })}
            className={field}
          />
          {!nicknameOk && <span className="block text-xs text-amber-300">{t.account.nicknameRule}</span>}
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-gray-300">{t.account.grade}</span>
          <select
            value={draft.grade}
            onChange={(e) => set({ grade: e.target.value as Grade | "" })}
            className="h-11 w-full rounded-md border border-gray-700 bg-[#0d1210] px-3 text-base text-white outline-none focus-visible:border-emerald-500/60 sm:text-sm"
          >
            <option value="">{t.account.gradeNone}</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {t.account.grades[g]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm text-gray-300">{t.account.city}</span>
          <Input value={draft.city} maxLength={CITY_MAX} list="kz-cities" placeholder={t.account.cityPlaceholder} onChange={(e) => set({ city: e.target.value })} className={field} />
          <datalist id="kz-cities">
            {CITIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm text-gray-300">{t.account.interests}</span>
        <Textarea
          value={draft.interests}
          maxLength={INTERESTS_MAX}
          rows={2}
          placeholder={t.account.interestsPlaceholder}
          onChange={(e) => set({ interests: e.target.value })}
          className="resize-none border-gray-700 bg-[#0d1210] text-base text-white sm:text-sm"
        />
      </label>
      <p className="text-xs leading-relaxed text-gray-400">{t.account.aiUsesProfile}</p>

      {profile.birthDate && age !== null && (
        <p className="rounded-xl border border-gray-800 px-4 py-3 text-sm text-gray-300">
          {t.account.birthDate}:{" "}
          <span className="text-white">
            {formatDeadline(profile.birthDate, "long", HTML_LANG[locale])}
          </span>{" "}
          <span className="text-gray-400">({plural(locale, age, t.account.years)})</span>
          <span className="mt-1 block text-xs text-gray-500">{t.account.birthDateLocked}</span>
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || !nicknameOk || busy} className="h-11 rounded-xl px-6">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.account.save}
        </Button>
        {status === "saved" && !dirty && (
          <span role="status" className="flex items-center gap-1 text-sm text-emerald-300">
            <Check aria-hidden="true" className="h-4 w-4" />
            {t.account.saved}
          </span>
        )}
        {status === "error" && (
          <span role="alert" className="text-sm text-red-300">
            {t.portfolio.saveError}
          </span>
        )}
      </div>
    </form>
  )
}

function Settings() {
  const { t } = useI18n()
  const { user, signOut } = useAuth()
  const { consents, record } = useConsents()
  const [busy, setBusy] = useState<null | "delete" | "signout" | "notes">(null)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const email = user?.email ?? ""

  const deleteAccount = async () => {
    setBusy("delete")
    setError(null)
    try {
      // The push subscription and the certificate photos first, while the
      // session still exists (files in Storage do not cascade with the account).
      const { unsubscribeThisDevice } = await import("@/lib/push")
      await unsubscribeThisDevice().catch(() => {})
      if (user) {
        const { removeAllPhotos } = await import("@/lib/certificates")
        await removeAllPhotos(user.id)
      }
      const supabase = await loadSupabase()
      const { error: rpcError } = await supabase.rpc("delete_my_account")
      if (rpcError) throw rpcError
      try {
        localStorage.removeItem("portfolio-notes")
        localStorage.removeItem("ai-chat-history")
      } catch {}
      await supabase.auth.signOut({ scope: "local" })
    } catch {
      setError(t.account.deleteFailed)
      setBusy(null)
    }
  }

  return (
    <>
      <section className="space-y-2 rounded-xl border border-gray-800 bg-[#141a17] p-4">
        <div className="flex items-start justify-between gap-3">
          <label htmlFor="notes-to-ai" className="text-sm font-medium text-white">
            {t.account.notesToAi}
          </label>
          <Switch
            id="notes-to-ai"
            checked={consents.notesToAi}
            disabled={busy === "notes"}
            onCheckedChange={async (checked) => {
              setBusy("notes")
              await record("notes_to_ai", checked).catch(() => setError(t.portfolio.saveError))
              setBusy(null)
            }}
          />
        </div>
        <p className="text-xs leading-relaxed text-gray-400">{t.account.notesToAiHint}</p>
      </section>

      <div className="grid gap-2">
        <button
          type="button"
          onClick={() => setPolicyOpen(true)}
          className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-800 px-4 text-left text-sm text-gray-200 hover:bg-gray-800/50"
        >
          <FileText aria-hidden="true" className="h-4 w-4 text-emerald-400" />
          {t.account.privacy}
        </button>
        <PolicyDialog open={policyOpen} onOpenChange={setPolicyOpen} />
        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("signout")
            await signOut().catch(() => {})
            setBusy(null)
          }}
          className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-800 px-4 text-sm text-gray-200 hover:bg-gray-800/50 disabled:opacity-60"
        >
          {busy === "signout" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut aria-hidden="true" className="h-4 w-4 text-gray-400" />}
          {t.account.signOut}
        </button>
      </div>

      <section className="space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-red-200">
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          {t.account.delete}
        </h3>
        <p className="text-xs leading-relaxed text-gray-400">{t.account.deleteHint}</p>
        {confirming ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (typed.trim().toLowerCase() === email.toLowerCase()) void deleteAccount()
            }}
            className="space-y-2"
          >
            <label htmlFor="delete-confirm" className="block text-xs text-gray-300">
              {t.account.deleteConfirm}
            </label>
            <Input
              id="delete-confirm"
              type="email"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={email}
              className="h-11 border-gray-700 bg-[#0d1210] text-base text-white sm:text-sm"
            />
            <Button
              type="submit"
              variant="destructive"
              disabled={busy !== null || typed.trim().toLowerCase() !== email.toLowerCase()}
              className="h-11 w-full"
            >
              {busy === "delete" && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.account.deleteButton}
            </Button>
          </form>
        ) : (
          <Button variant="outline" className="h-11 border-red-500/30 text-red-200 hover:bg-red-500/10" onClick={() => setConfirming(true)}>
            {t.account.delete}
          </Button>
        )}
      </section>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </>
  )
}
