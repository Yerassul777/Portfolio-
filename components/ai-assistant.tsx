"use client"

import { useState, useEffect, useRef, type ReactNode, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet"
import { Bot, Send, Loader2, Sparkles, TrendingUp, X, ShieldAlert } from "lucide-react"
import { AuthForm } from "@/components/auth-form"
import { ConsentGate } from "@/components/consent"
import { panelContentProps, type PanelVariant } from "@/components/panel-frame"
import { useConsents } from "@/lib/consent"
import { getAccessToken, useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { HTML_LANG } from "@/lib/i18n/config"
import { format, plural } from "@/lib/i18n/format"
import { loadSupabase } from "@/lib/supabase-browser"
import { useChat, type ChatMessage } from "@/lib/chat"
import { useNotesData } from "@/lib/notes"

type Quota = { used: number; limit: number }

type Message = ChatMessage

const URL_PATTERN = /https?:\/\/[^\s<>"'«»]+/g

// Turns bare http(s) URLs into links. Built from React elements, never HTML,
// so model output cannot inject markup; the pattern only admits http(s).
function linkify(text: string) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    // A sentence often ends right after a URL: keep the trailing punctuation as text.
    const url = match[0].replace(/[.,;:!?)\]]+$/, "")
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    parts.push(
      <a
        key={start}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-emerald-400 underline underline-offset-2 hover:text-emerald-300"
      >
        {url}
      </a>
    )
    last = start + url.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

interface AIAssistantPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The header button, which gets focus back when the panel closes. */
  returnFocusRef: RefObject<HTMLElement | null>
  variant?: PanelVariant
}

/**
 * The assistant panel. HeaderTools renders the header button and loads this
 * module on demand, so none of it is in the page's initial JavaScript.
 */
export function AIAssistantPanel({ open, onOpenChange, returnFocusRef, variant = "sheet" }: AIAssistantPanelProps) {
  const { locale, t } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const { consents, ready: consentsReady, record } = useConsents()
  const [noticeBusy, setNoticeBusy] = useState(false)
  // What the panel shows: sign-in, the consent steps, or the chat.
  const stage = !user
    ? "signin"
    : !consentsReady
      ? "loading"
      : !consents.terms
        ? "consent"
        : consents.ageBracket === "under13"
          ? "under13"
          : !consents.aiNotice
            ? "notice"
            : "chat"
  // Tagged with the user it belongs to, so switching accounts never shows the previous user's allowance.
  const [quotaState, setQuotaState] = useState<{ userId: string; quota: Quota } | null>(null)
  const quota = user && quotaState?.userId === user.id ? quotaState.quota : null
  const setQuota = (next: Quota) => {
    if (user) setQuotaState({ userId: user.id, quota: next })
  }
  const chat = useChat(open)
  // Sent, not yet answered: shown under the history until the reply arrives.
  const [pending, setPending] = useState<Message | null>(null)
  const messages = pending ? [...chat.messages, pending] : chat.messages
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The account's notes (the assistant needs sign-in), used as context.
  const { notes } = useNotesData(open)
  // Notes reach OpenAI only if the user switched that on (Portfolio → Account).
  const notesShared = consents.notesToAi && notes.length > 0
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages.length, isLoading])

  // Today's allowance, so the limit is visible before it is hit. RLS returns
  // only this user's rows; the server remains the one that enforces it.
  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" })
    loadSupabase().then((supabase) =>
      Promise.all([
        supabase.from("ai_usage").select("message_count").eq("usage_date", today).maybeSingle(),
        supabase.from("profiles").select("plans(daily_ai_messages)").maybeSingle(),
      ])
    ).then(([usage, profile]) => {
      if (cancelled) return
      const plan = (profile.data as { plans?: { daily_ai_messages?: number } } | null)?.plans
      if (typeof plan?.daily_ai_messages === "number") {
        setQuotaState({ userId, quota: { used: usage.data?.message_count ?? 0, limit: plan.daily_ai_messages } })
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    const userMessage: Message = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...chat.messages, userMessage]
    setPending(userMessage)
    setInput("")
    setError(null)
    setIsLoading(true)

    let reply: Message
    try {
      const notesContext = notesShared
        ? notes.map((note) =>
            `[${note.category.toUpperCase()}] ${note.title}:\n${note.content}`
          ).join("\n\n---\n\n")
        : ""

      const token = await getAccessToken()
      if (!token) {
        throw new Error(t.ai.sessionExpired)
      }

      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          notesContext,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        if (errorData.quota) setQuota(errorData.quota)
        if (errorData.code === "auth_required") {
          throw new Error(t.ai.sessionExpired)
        }
        throw new Error(errorData.error || t.ai.failed)
      }

      const data = await response.json()
      if (data.quota) setQuota(data.quota)

      reply = {
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
      }
    } catch (error) {
      // Nothing was answered: the question goes back into the box, not into history.
      setPending(null)
      setInput((current) => current || text)
      setError(
        error instanceof Error && error.message
          ? error.message
          : t.ai.failed
      )
      setIsLoading(false)
      return
    }

    // append shows both messages at once (before the save completes), so the
    // pending one can go in the same render without a flicker.
    const saving = chat.append([userMessage, reply])
    setPending(null)
    setIsLoading(false)
    try {
      await saving
    } catch {
      setError(t.ai.saveFailed)
    }
  }

  const clearHistory = async () => {
    if (!window.confirm(t.ai.clearConfirm)) return
    setError(null)
    try {
      await chat.clear()
    } catch {
      setError(t.ai.clearFailed)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={variant === "sheet"}>
      <SheetContent side="right" {...panelContentProps(variant, returnFocusRef)}>
        {/* Header */}
        <SheetHeader className="px-6 pb-4 pt-[max(1rem,env(safe-area-inset-top))] border-b border-gray-800 bg-gradient-to-r from-[#0a0f0d] to-[#0d1914] shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              {t.ai.title}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {user && chat.messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="h-11 sm:h-8 text-gray-400 hover:text-white text-xs"
                >
                  {t.ai.clear}
                </Button>
              )}
              {variant === "sheet" && (
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t.ai.close}
                    className="size-11 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
              )}
            </div>
          </div>
          <SheetDescription className="text-sm text-emerald-400/80 mt-1 flex items-center gap-1.5">
            <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
            {notesShared ? plural(locale, notes.length, t.ai.notesUsed) : notes.length > 0 ? t.ai.notesOff : t.ai.noNotes}
          </SheetDescription>
        </SheetHeader>

        {stage === "signin" ? (
          <div className="flex-1 overflow-y-auto px-6 py-10 min-h-0">
            {authLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              </div>
            ) : (
              <AuthForm title={t.ai.signInTitle} description={t.ai.signInText} />
            )}
          </div>
        ) : stage === "loading" ? (
          <div role="status" className="flex flex-1 justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          </div>
        ) : stage === "consent" ? (
          <div className="flex-1 overflow-y-auto min-h-0">
            <ConsentGate>{null}</ConsentGate>
          </div>
        ) : stage === "under13" ? (
          <div className="flex-1 space-y-3 px-6 py-12 text-center">
            <ShieldAlert aria-hidden="true" className="mx-auto h-8 w-8 text-amber-300" />
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-300">{t.aiNotice.under13}</p>
          </div>
        ) : stage === "notice" ? (
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-10">
            <div className="mx-auto max-w-sm space-y-4 text-center">
              <h3 className="text-lg font-semibold text-white">{t.aiNotice.title}</h3>
              <p className="text-sm leading-relaxed text-gray-300">{t.aiNotice.text}</p>
              <Button
                className="h-11 w-full"
                disabled={noticeBusy}
                onClick={async () => {
                  setNoticeBusy(true)
                  await record("ai_processing", true).catch(() => setError(t.consent.saveFailed))
                  setNoticeBusy(false)
                }}
              >
                {noticeBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t.aiNotice.ok}
              </Button>
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            </div>
          </div>
        ) : !chat.ready ? (
          <div role="status" aria-label={t.ai.thinking} className="flex flex-1 justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
          </div>
        ) : chat.loadFailed ? (
          <div className="flex-1 space-y-3 px-6 py-12 text-center">
            <p role="alert" className="text-sm text-gray-300">{t.ai.historyLoadError}</p>
            <Button variant="outline" className="h-11" onClick={chat.retry}>
              {t.ai.retry}
            </Button>
          </div>
        ) : (
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 min-h-0"
        >
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-600/20 flex items-center justify-center mx-auto">
                  <Bot className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <p className="text-gray-300 text-base font-medium">{t.ai.greeting}</p>
                  <p className="text-gray-400 text-sm mt-2">{t.ai.greetingText}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto mt-6">
                  {t.ai.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="min-h-11 text-left px-4 py-2.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 text-sm transition-colors border border-gray-700/50 hover:border-emerald-500/30"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.timestamp}-${index}`}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <Card
                  className={`max-w-[80%] border-0 shadow-none ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-emerald-600 to-green-700"
                      : "bg-[#141a17]"
                  }`}
                >
                  <CardContent className="p-3">
                    <p
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        message.role === "user" ? "text-white" : "text-gray-300"
                      }`}
                    >
                      {message.role === "assistant" ? linkify(message.content) : message.content}
                    </p>
                    <p
                      className={`text-xs mt-2 ${
                        message.role === "user" ? "text-emerald-100/60" : "text-gray-400"
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString(HTML_LANG[locale], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 mt-1 animate-pulse">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <Card className="bg-[#141a17] border-0 shadow-none">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-sm text-gray-400">{t.ai.thinking}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>
        )}

        {/* Input */}
        {stage === "chat" && (
        <div className="px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-800 bg-[#0a0f0d] shrink-0">
          <div className="flex gap-2">
            <Textarea
              placeholder={t.ai.inputPlaceholder}
              aria-label={t.ai.inputLabel}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              rows={2}
              className="resize-none bg-[#0d1210] border-gray-700 text-base sm:text-sm text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              aria-label={t.ai.send}
              className="shrink-0 h-auto min-w-11 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            {notesShared ? plural(locale, notes.length, t.ai.contextNotes) : t.ai.contextNone}
          </p>
          {quota && (
            <p className={`text-xs mt-1 ${quota.used >= quota.limit ? "text-amber-400" : "text-gray-400"}`}>
              {quota.used >= quota.limit
                ? t.ai.quotaExhausted
                : format(plural(locale, quota.limit - quota.used, t.ai.quotaLeft), { limit: quota.limit })}
            </p>
          )}
        </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
