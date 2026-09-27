"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { Bot, Send, Loader2, Sparkles, TrendingUp, X, LogOut } from "lucide-react"
import { AuthForm } from "@/components/auth-form"
import { getAccessToken, useAuth } from "@/components/auth-provider"
import { useI18n } from "@/components/i18n-provider"
import { HTML_LANG } from "@/lib/i18n/config"
import { format, plural } from "@/lib/i18n/format"
import { loadSupabase } from "@/lib/supabase-browser"
import { clearChatHistory, readNotes, saveChatHistory, useChatHistory, useNotes, type ChatMessage } from "@/lib/local-store"

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

export function AIAssistant() {
  const { locale, t } = useI18n()
  const { user, loading: authLoading, signOut } = useAuth()
  // Tagged with the user it belongs to, so switching accounts never shows the previous user's allowance.
  const [quotaState, setQuotaState] = useState<{ userId: string; quota: Quota } | null>(null)
  const quota = user && quotaState?.userId === user.id ? quotaState.quota : null
  const setQuota = (next: Quota) => {
    if (user) setQuotaState({ userId: user.id, quota: next })
  }
  const messages = useChatHistory()
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const notes = useNotes()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

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

  const saveMessages = saveChatHistory

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    const updatedMessages = [...messages, userMessage]
    saveMessages(updatedMessages)
    setInput("")
    setError(null)
    setIsLoading(true)

    try {
      const currentNotes = readNotes()

      const notesContext = currentNotes.length > 0
        ? currentNotes.map((note) =>
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

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
      }
      saveMessages([...updatedMessages, assistantMessage])
    } catch (error) {
      setError(
        error instanceof Error && error.message
          ? error.message
          : t.ai.failed
      )
    } finally {
      setIsLoading(false)
    }
  }

  const clearHistory = clearChatHistory

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          aria-label={t.ai.open}
          className="size-11 p-0 sm:h-9 sm:w-auto sm:px-3 rounded-full border-emerald-600 bg-gradient-to-r from-emerald-500/10 to-green-600/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500 gap-2 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <Bot className="h-4 w-4 relative z-10" />
          <span className="hidden sm:inline relative z-10">{t.ai.open}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:w-[90vw] md:w-[600px] sm:max-w-[600px] bg-[#0d1210] border-gray-800 p-0 flex flex-col [&>button]:hidden"
      >
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
              {user && messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="h-11 sm:h-8 text-gray-400 hover:text-white text-xs"
                >
                  {t.ai.clear}
                </Button>
              )}
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
            </div>
          </div>
          <SheetDescription className="text-sm text-emerald-400/80 mt-1 flex items-center gap-1.5">
            <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
            {notes.length > 0 ? plural(locale, notes.length, t.ai.notesUsed) : t.ai.noNotes}
          </SheetDescription>
          {user && (
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-400">
              <span className="truncate">{user.email}</span>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  signOut()
                }}
                className="flex min-h-11 shrink-0 items-center gap-1 transition-colors hover:text-gray-300 sm:min-h-0"
              >
                <LogOut className="h-3 w-3" />
                {t.ai.signOut}
              </button>
            </div>
          )}
        </SheetHeader>

        {!user ? (
          <div className="flex-1 overflow-y-auto px-6 py-10 min-h-0">
            {authLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              </div>
            ) : (
              <AuthForm title={t.ai.signInTitle} description={t.ai.signInText} />
            )}
          </div>
        ) : (
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
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
                key={index}
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
        {user && (
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
            {notes.length > 0 ? plural(locale, notes.length, t.ai.contextNotes) : t.ai.contextNone}
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
