"use client"

import { useState } from "react"
import { Download, FileText, Loader2, LogOut, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { isIOS } from "@/lib/app-mode"
import { useConsents } from "@/lib/consent"
import { format } from "@/lib/i18n/format"
import { loadSupabase } from "@/lib/supabase-browser"
import { AccountOnly } from "./common"

export function AccountTab() {
  const { t } = useI18n()
  return (
    <AccountOnly title={t.account.title} text={t.favorites.signInText}>
      <Account />
    </AccountOnly>
  )
}

/** Everything the site stores about the signed-in user, read through RLS. */
async function collectMyData() {
  const supabase = await loadSupabase()
  const tables = ["profiles", "consents", "notes", "ai_messages", "ai_usage", "favorites", "portfolio_entries", "push_subscriptions"] as const
  const result: Record<string, unknown> = { exported_at: new Date().toISOString() }
  const { data: userData } = await supabase.auth.getUser()
  result.account = { id: userData.user?.id, email: userData.user?.email, created_at: userData.user?.created_at }
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*").limit(5000)
    result[table] = error ? { error: error.message } : data
  }
  return result
}

async function saveFile(file: File) {
  if (isIOS() && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file] }).catch(() => {})
    return
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement("a")
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function Account() {
  const { locale, t } = useI18n()
  const { user, signOut } = useAuth()
  const { consents, record } = useConsents()
  const [busy, setBusy] = useState<null | "export" | "delete" | "signout" | "notes">(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState("")
  const [error, setError] = useState<string | null>(null)
  const email = user?.email ?? ""

  const deleteAccount = async () => {
    setBusy("delete")
    setError(null)
    try {
      // The push subscription first, while the session still exists.
      const { unsubscribeThisDevice } = await import("@/lib/push")
      await unsubscribeThisDevice().catch(() => {})
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
    <div className="space-y-5 p-4">
      <p className="truncate text-sm text-gray-400">{format(t.account.signedInAs, { email })}</p>

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
        <a
          href={`/${locale}/privacy`}
          target="_blank"
          rel="noopener"
          className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-800 px-4 text-sm text-gray-200 hover:bg-gray-800/50"
        >
          <FileText aria-hidden="true" className="h-4 w-4 text-emerald-400" />
          {t.account.privacy}
        </a>
        <button
          type="button"
          disabled={busy !== null}
          onClick={async () => {
            setBusy("export")
            setError(null)
            try {
              const data = await collectMyData()
              await saveFile(new File([JSON.stringify(data, null, 2)], "portfolio-plus-my-data.json", { type: "application/json" }))
            } catch {
              setError(t.portfolio.saveError)
            } finally {
              setBusy(null)
            }
          }}
          className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-800 px-4 text-left text-sm text-gray-200 hover:bg-gray-800/50 disabled:opacity-60"
        >
          {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="h-4 w-4 text-emerald-400" />}
          <span>
            {t.account.export}
            <span className="block text-xs text-gray-400">{t.account.exportHint}</span>
          </span>
        </button>
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
    </div>
  )
}
