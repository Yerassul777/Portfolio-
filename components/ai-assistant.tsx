"use client"

import { useState, useEffect, useLayoutEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet"
import { ArrowDown, ArrowUp, Bot, Flag, MessageSquare, Send, Loader2, Sparkles, TrendingUp, X, ShieldAlert } from "lucide-react"
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
import { ageOn, shownName, todayInKazakhstan, useProfile } from "@/lib/profile"
import { AI_MIN_AGE } from "@/lib/policy"
import type { Locale } from "@/lib/i18n/config"
import type { Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"

// The trajectory view is a separate chunk: most visits only chat.
const Trajectory = dynamic(() => import("@/components/trajectory").then((m) => m.Trajectory), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
    </div>
  ),
})

type Quota = { used: number; limit: number }

type Message = ChatMessage

const URL_PATTERN = /https?:\/\/[^\s<>"'«»]+/g

// Turns bare http(s) URLs into links. Built from React elements, never HTML,
// so model output cannot inject markup; the pattern only admits http(s).
// Links to this site open inside the app (`onInternal` gets the path);
// others open in the browser.
function linkify(text: string, onInternal: (path: string) => void) {
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    // A sentence often ends right after a URL: keep the trailing punctuation as text.
    const url = match[0].replace(/[.,;:!?)\]]+$/, "")
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    let internal: string | null = null
    try {
      const parsed = new URL(url)
      if (parsed.origin === window.location.origin) internal = parsed.pathname + parsed.search + parsed.hash
    } catch {}
    const path = internal
    parts.push(
      <a
        key={start}
        href={url}
        {...(path
          ? {
              onClick: (event: MouseEvent) => {
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
                event.preventDefault()
                onInternal(path)
              },
            }
          : { target: "_blank", rel: "noopener noreferrer" })}
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

const ZONE = "Asia/Almaty"
const dayKey = (timestamp: string) => new Date(timestamp).toLocaleDateString("sv-SE", { timeZone: ZONE })

/** "Сегодня", "Вчера", "5 октября", or "5 октября 2025" for another year. */
function dayLabel(timestamp: string, locale: Locale, t: Dictionary): string {
  const day = dayKey(timestamp)
  const today = todayInKazakhstan()
  if (day === today) return t.ai.today
  if (day === dayKey(new Date(Date.now() - 86_400_000).toISOString())) return t.ai.yesterday
  return new Date(timestamp).toLocaleDateString(HTML_LANG[locale], {
    day: "numeric",
    month: "long",
    ...(day.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    timeZone: ZONE,
  })
}

/** Distance from the bottom, in px, that still counts as "at the latest message". */
const NEAR_BOTTOM = 120

interface AIAssistantPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Closes the panel without a history step: a link inside it is navigating. */
  onLeave: () => void
  /** The header button, which gets focus back when the panel closes. */
  returnFocusRef: RefObject<HTMLElement | null>
  variant?: PanelVariant
}

/**
 * The assistant panel. HeaderTools renders the header button and loads this
 * module on demand, so none of it is in the page's initial JavaScript.
 */
export function AIAssistantPanel({ open, onOpenChange, onLeave, returnFocusRef, variant = "sheet" }: AIAssistantPanelProps) {
  const { locale, t } = useI18n()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { consents, ready: consentsReady } = useConsents()
  const { profile, ready: profileReady } = useProfile()
  // The date of birth decides; accounts from before it existed have the age group they chose.
  const tooYoung = profile?.birthDate
    ? ageOn(profile.birthDate, todayInKazakhstan()) < AI_MIN_AGE
    : consents.ageBracket === "under13"
  // What the panel shows: sign-in, the last registration step, or the chat.
  const stage = !user
    ? "signin"
    : !consentsReady || !profileReady
      ? "loading"
      : !consents.terms
        ? "consent"
        : tooYoung
          ? "under13"
          : "chat"
  const openInApp = (path: string) => {
    onLeave()
    router.push(path)
  }
  // Tagged with the user it belongs to, so switching accounts never shows the previous user's allowance.
  const [quotaState, setQuotaState] = useState<{ userId: string; quota: Quota } | null>(null)
  const quota = user && quotaState?.userId === user.id ? quotaState.quota : null
  const setQuota = (next: Quota) => {
    if (user) setQuotaState({ userId: user.id, quota: next })
  }
  // Chat or "Моя траектория"; both need what the chat needs.
  const [view, setView] = useState<"chat" | "plan">("chat")
  // Loaded only for those who may chat (not before registration, not under 13).
  const chat = useChat(open && stage === "chat" && view === "chat")
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
  const chatContainerRef = useRef<HTMLDivElement>(null)
  // Where the reader is: at the latest message, or reading back. Decides the
  // jump button's direction and whether a new message scrolls the chat.
  const [nearBottom, setNearBottom] = useState(true)
  const [scrollable, setScrollable] = useState(false)
  const shownCount = useRef(0)
  const chatVisible = open && stage === "chat" && chat.ready && !chat.loadFailed

  const scrollToEnd = (behavior: ScrollBehavior) => {
    const box = chatContainerRef.current
    if (box) box.scrollTo({ top: box.scrollHeight, behavior })
  }
  // Pinned to the latest message while the reader is there, so content that
  // settles after a scroll (a reply's last lines, the allowance line below)
  // never leaves the newest message half-hidden.
  const pinned = useRef(true)
  const measure = () => {
    const box = chatContainerRef.current
    if (!box) return
    const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < NEAR_BOTTOM
    pinned.current = atEnd
    setNearBottom(atEnd)
    setScrollable(box.scrollHeight > box.clientHeight * 1.5)
  }

  // Opening the chat shows the latest messages at once, not the first ones;
  // a new message (sent, answered, the "thinking" bubble) follows the
  // conversation — unless the reader has scrolled back to read something.
  useLayoutEffect(() => {
    if (!chatVisible) {
      shownCount.current = 0
      return
    }
    const first = shownCount.current === 0
    const grew = messages.length !== shownCount.current
    shownCount.current = Math.max(messages.length, 1)
    if (first) {
      pinned.current = true
      scrollToEnd("auto")
    } else if ((grew || isLoading) && (nearBottom || pending)) scrollToEnd("smooth")
    measure()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatVisible, messages.length, isLoading])

  useEffect(() => {
    const box = chatContainerRef.current
    if (!chatVisible || !box || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (pinned.current) box.scrollTop = box.scrollHeight
    })
    observer.observe(box)
    if (box.firstElementChild) observer.observe(box.firstElementChild)
    return () => observer.disconnect()
  }, [chatVisible])

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
          {stage === "chat" && (
            <div role="tablist" aria-label={t.ai.title} className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[#141a17] p-1">
              {([
                ["chat", MessageSquare, t.trajectory.chatTab],
                ["plan", Flag, t.trajectory.planTab],
              ] as const).map(([id, Icon, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
                    view === id ? "bg-emerald-500/15 text-emerald-300" : "text-gray-400 hover:text-gray-200"
                  )}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          )}
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
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-gray-300">{t.aiAge.under13}</p>
          </div>
        ) : view === "plan" ? (
          <Trajectory active={open} onLeave={onLeave} />
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
        <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={chatContainerRef}
          onScroll={measure}
          className="flex-1 overflow-y-auto overscroll-contain px-6 py-4 min-h-0"
        >
          <div className="mx-auto max-w-3xl space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12 space-y-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-600/20 flex items-center justify-center mx-auto">
                  <Bot className="h-8 w-8 text-emerald-400" />
                </div>
                <div>
                  <p className="text-gray-300 text-base font-medium">
                    {profile && (profile.displayName || profile.nickname)
                      ? format(t.ai.greetingName, { name: shownName(profile, undefined) })
                      : t.ai.greeting}
                  </p>
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
              <div key={`${message.timestamp}-${index}`} className="space-y-4">
              {(index === 0 || dayKey(messages[index - 1].timestamp) !== dayKey(message.timestamp)) && (
                <div className="flex justify-center pt-2">
                  <span className="rounded-full border border-gray-800 bg-[#111714] px-3 py-1 text-xs font-medium text-gray-400">
                    {dayLabel(message.timestamp, locale, t)}
                  </span>
                </div>
              )}
              <div
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <Card
                  className={`max-w-[80%] gap-0 border-0 py-0 shadow-none ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-emerald-600 to-green-700"
                      : "bg-[#141a17]"
                  }`}
                >
                  <CardContent className="p-3">
                    <p
                      data-selectable
                      className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        message.role === "user" ? "text-white" : "text-gray-300"
                      }`}
                    >
                      {message.role === "assistant" ? linkify(message.content, openInApp) : message.content}
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
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 mt-1 animate-pulse">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <Card className="gap-0 border-0 bg-[#141a17] py-0 shadow-none">
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

          </div>
        </div>
        {scrollable && (
          <button
            type="button"
            onClick={() => {
              const box = chatContainerRef.current
              if (!box) return
              if (nearBottom) box.scrollTo({ top: 0, behavior: "smooth" })
              else scrollToEnd("smooth")
            }}
            aria-label={nearBottom ? t.ai.toTop : t.ai.toLatest}
            title={nearBottom ? t.ai.toTop : t.ai.toLatest}
            className="absolute bottom-3 right-4 flex size-11 items-center justify-center rounded-full border border-emerald-500/30 bg-[#0f1a15]/95 text-emerald-300 shadow-lg shadow-black/40 transition-transform hover:bg-[#13221b] active:scale-90"
          >
            {nearBottom ? <ArrowUp aria-hidden="true" className="h-5 w-5" /> : <ArrowDown aria-hidden="true" className="h-5 w-5" />}
          </button>
        )}
        </div>
        )}

        {/* Input */}
        {stage === "chat" && view === "chat" && (
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
