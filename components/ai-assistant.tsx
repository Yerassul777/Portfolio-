"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose } from "@/components/ui/sheet"
import { Bot, Send, Loader2, Sparkles, TrendingUp, X, LogOut } from "lucide-react"
import { AuthForm } from "@/components/auth-form"
import { getAccessToken, useAuth } from "@/components/auth-provider"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

type Quota = { used: number; limit: number }

function messagesWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "сообщение"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "сообщения"
  return "сообщений"
}

interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

interface Note {
  id: string
  title: string
  content: string
  category: string
}

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
  const { user, loading: authLoading, signOut } = useAuth()
  const [quota, setQuota] = useState<Quota | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadData = () => {
      const savedNotes = localStorage.getItem("portfolio-notes")
      if (savedNotes) {
        const parsedNotes = JSON.parse(savedNotes)
        setNotes(parsedNotes)
      }
      const savedMessages = localStorage.getItem("ai-chat-history")
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages))
      }
    }
    loadData()
    window.addEventListener("storage", loadData)
    return () => window.removeEventListener("storage", loadData)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // Today's allowance, so the limit is visible before it is hit. RLS returns
  // only this user's rows; the server remains the one that enforces it.
  useEffect(() => {
    if (!user) {
      setQuota(null)
      return
    }
    let cancelled = false
    const supabase = getSupabaseBrowserClient()
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Almaty" })
    Promise.all([
      supabase.from("ai_usage").select("message_count").eq("usage_date", today).maybeSingle(),
      supabase.from("profiles").select("plans(daily_ai_messages)").maybeSingle(),
    ]).then(([usage, profile]) => {
      if (cancelled) return
      const plan = (profile.data as { plans?: { daily_ai_messages?: number } } | null)?.plans
      if (typeof plan?.daily_ai_messages === "number") {
        setQuota({ used: usage.data?.message_count ?? 0, limit: plan.daily_ai_messages })
      }
    })
    return () => {
      cancelled = true
    }
  }, [user])

  const saveMessages = (newMessages: Message[]) => {
    localStorage.setItem("ai-chat-history", JSON.stringify(newMessages))
    setMessages(newMessages)
  }

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
      const freshNotes = localStorage.getItem("portfolio-notes")
      const currentNotes: Note[] = freshNotes ? JSON.parse(freshNotes) : notes

      const notesContext = currentNotes.length > 0
        ? currentNotes.map((note: Note) =>
            `[${note.category.toUpperCase()}] ${note.title}:\n${note.content}`
          ).join("\n\n---\n\n")
        : ""

      const token = await getAccessToken()
      if (!token) {
        throw new Error("Сессия истекла. Войдите снова.")
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
          throw new Error("Сессия истекла. Войдите снова.")
        }
        throw new Error(errorData.error || "Не удалось получить ответ. Попробуйте ещё раз.")
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
          : "Не удалось получить ответ. Попробуйте ещё раз."
      )
    } finally {
      setIsLoading(false)
    }
  }

  const clearHistory = () => {
    setMessages([])
    localStorage.removeItem("ai-chat-history")
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-emerald-600 bg-gradient-to-r from-emerald-500/10 to-green-600/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 hover:border-emerald-500 gap-2 relative overflow-hidden group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <Bot className="h-4 w-4 relative z-10" />
          <span className="hidden sm:inline relative z-10">ИИ Помощник</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:w-[90vw] md:w-[600px] sm:max-w-[600px] bg-[#0d1210] border-gray-800 p-0 flex flex-col [&>button]:hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-[#0a0f0d] to-[#0d1914] shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              ИИ Помощник
            </SheetTitle>
            <div className="flex items-center gap-2">
              {user && messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearHistory}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Очистить
                </Button>
              )}
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg"
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Закрыть</span>
                </Button>
              </SheetClose>
            </div>
          </div>
          <p className="text-sm text-emerald-400/80 mt-1 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            {notes.length > 0
              ? `Анализирую ${notes.length} ${notes.length === 1 ? "заметку" : notes.length < 5 ? "заметки" : "заметок"} для персональных советов`
              : "Создайте заметки, чтобы я давал персональные советы"}
          </p>
          {user && (
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
              <span className="truncate">{user.email}</span>
              <button
                type="button"
                onClick={() => {
                  setMessages([])
                  setError(null)
                  signOut()
                }}
                className="flex shrink-0 items-center gap-1 transition-colors hover:text-gray-300"
              >
                <LogOut className="h-3 w-3" />
                Выйти
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
              <AuthForm
                title="Войдите, чтобы пользоваться ИИ-помощником"
                description="Это бесплатно. Вход защищает помощника от ботов — так он остаётся бесплатным для школьников."
              />
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
                  <p className="text-gray-300 text-base font-medium">
                    Привет! Я ваш персональный ИИ-помощник
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Я читаю ваши заметки и даю советы на их основе
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 max-w-sm mx-auto mt-6">
                  {[
                    "Помоги выбрать олимпиаду",
                    "Какие навыки мне развивать?",
                    "Оцени мое портфолио",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left px-4 py-2.5 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 text-sm transition-colors border border-gray-700/50 hover:border-emerald-500/30"
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
                        message.role === "user" ? "text-emerald-100/60" : "text-gray-600"
                      }`}
                    >
                      {new Date(message.timestamp).toLocaleTimeString("ru-RU", {
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
                      <span className="text-sm text-gray-400">Думаю...</span>
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
        <div className="px-6 py-4 border-t border-gray-800 bg-[#0a0f0d] shrink-0">
          <div className="flex gap-2">
            <Textarea
              placeholder="Спросите о ваших целях, портфолио..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              rows={2}
              className="resize-none bg-[#0d1210] border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500/50 focus:ring-emerald-500/20"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="shrink-0 h-auto bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            {notes.length > 0
              ? `${notes.length} ${notes.length === 1 ? "заметка" : notes.length < 5 ? "заметки" : "заметок"} используется для контекста`
              : "Добавьте заметки для персональных рекомендаций"}
          </p>
          {quota && (
            <p className={`text-xs mt-1 ${quota.used >= quota.limit ? "text-amber-400" : "text-gray-500"}`}>
              {quota.used >= quota.limit
                ? "Лимит на сегодня исчерпан — возвращайтесь завтра"
                : `Сегодня осталось ${quota.limit - quota.used} ${messagesWord(quota.limit - quota.used)} из ${quota.limit}`}
            </p>
          )}
        </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
