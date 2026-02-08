"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Bot, Send, Loader2, Sparkles, TrendingUp } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

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

export function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Load notes from localStorage for AI context
  useEffect(() => {
    const loadData = () => {
      const savedNotes = localStorage.getItem("portfolio-notes")
      if (savedNotes) {
        const parsedNotes = JSON.parse(savedNotes)
        setNotes(parsedNotes)
        console.log("[v0] AI loaded notes:", parsedNotes.length, "notes")
      }

      // Load chat history
      const savedMessages = localStorage.getItem("ai-chat-history")
      if (savedMessages) {
        setMessages(JSON.parse(savedMessages))
      }
    }

    loadData()

    // Listen for storage changes (when notes are updated)
    window.addEventListener("storage", loadData)
    return () => window.removeEventListener("storage", loadData)
  }, [])

  // Scroll to bottom when new message arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

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
    setIsLoading(true)

    try {
      // Prepare context from notes - refresh from localStorage to get latest
      const freshNotes = localStorage.getItem("portfolio-notes")
      const currentNotes = freshNotes ? JSON.parse(freshNotes) : notes
      
      const notesContext = currentNotes.map((note: Note) => 
        `${note.category.toUpperCase()}: ${note.title}\n${note.content}`
      ).join("\n\n")

      console.log("[v0] Sending notes context to AI:", notesContext.length, "characters")

      const response = await fetch("/api/ai-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          notesContext,
        }),
      })

      if (!response.ok) {
        throw new Error("Не удалось получить ответ от ИИ")
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
        timestamp: new Date().toISOString(),
      }

      saveMessages([...updatedMessages, assistantMessage])
    } catch (error) {
      console.error("[v0] AI Assistant error:", error)
      const errorMessage: Message = {
        role: "assistant",
        content: "Извините, произошла ошибка. Пожалуйста, проверьте настройки API ключа в переменных окружения (OPENAI_API_KEY).",
        timestamp: new Date().toISOString(),
      }
      saveMessages([...updatedMessages, errorMessage])
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
          <span className="hidden sm:inline relative z-10">ИИ Помощник</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[90vw] md:w-[600px] sm:max-w-[600px] bg-[#0d1210] border-gray-800 p-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-[#0a0f0d] to-[#0d1914]">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center animate-pulse">
                <Bot className="h-4 w-4 text-white" />
              </div>
              ИИ Помощник
            </SheetTitle>
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearHistory}
                className="text-gray-400 hover:text-white text-xs"
              >
                Очистить
              </Button>
            )}
          </div>
          <p className="text-sm text-emerald-400/80 mt-1 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Анализирую ваши заметки и даю персональные советы
          </p>
        </SheetHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-4" ref={scrollRef}>
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
                    Расскажите о своих целях, и я помогу вам их достичь
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
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                )}
                <Card
                  className={`max-w-[80%] ${
                    message.role === "user"
                      ? "bg-gradient-to-br from-emerald-600 to-green-700 border-0"
                      : "bg-[#141a17] border-gray-800"
                  }`}
                >
                  <CardContent className="p-3">
                    <p
                      className={`text-sm leading-relaxed whitespace-pre-wrap ${
                        message.role === "user" ? "text-white" : "text-gray-300"
                      }`}
                    >
                      {message.content}
                    </p>
                    <p
                      className={`text-xs mt-2 ${
                        message.role === "user"
                          ? "text-emerald-100/60"
                          : "text-gray-600"
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
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shrink-0 mt-1 animate-pulse">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <Card className="bg-[#141a17] border-gray-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                      <span className="text-sm text-gray-400">Думаю...</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="px-6 py-4 border-t border-gray-800 bg-[#0a0f0d]">
          <div className="flex gap-2">
            <Textarea
              placeholder="Спросите меня о ваших целях, портфолио или следующих шагах..."
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
              className="shrink-0 h-auto bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            {notes.length > 0 
              ? `Анализирую ${notes.length} ${notes.length === 1 ? 'заметку' : notes.length < 5 ? 'заметки' : 'заметок'} для персональных советов`
              : "Создайте заметки, чтобы я мог дать персональные советы"
            }
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
