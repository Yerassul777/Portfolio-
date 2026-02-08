"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  StickyNote, 
  Plus, 
  Trash2, 
  Target, 
  Briefcase, 
  GraduationCap,
  Sparkles,
  Save,
  X
} from "lucide-react"

interface Note {
  id: string
  title: string
  content: string
  category: "goals" | "portfolio" | "ideas" | "other"
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: "goals", label: "Цели", icon: Target, color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  { value: "portfolio", label: "Портфолио", icon: Briefcase, color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  { value: "ideas", label: "Идеи", icon: Sparkles, color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  { value: "other", label: "Другое", icon: GraduationCap, color: "bg-gray-500/10 text-gray-600 border-gray-500/20" },
] as const

export function NotesWorkspace() {
  const [notes, setNotes] = useState<Note[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newNote, setNewNote] = useState({ title: "", content: "", category: "goals" as const })

  // Load notes from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem("portfolio-notes")
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes))
    }
  }, [])

  // Save notes to localStorage
  const saveNotes = (updatedNotes: Note[]) => {
    localStorage.setItem("portfolio-notes", JSON.stringify(updatedNotes))
    setNotes(updatedNotes)
  }

  const addNote = () => {
    if (!newNote.title.trim() && !newNote.content.trim()) return
    
    const note: Note = {
      id: crypto.randomUUID(),
      title: newNote.title || "Без названия",
      content: newNote.content,
      category: newNote.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    
    saveNotes([note, ...notes])
    setNewNote({ title: "", content: "", category: "goals" })
    setIsCreating(false)
  }

  const updateNote = (id: string, updates: Partial<Note>) => {
    const updatedNotes = notes.map(note => 
      note.id === id 
        ? { ...note, ...updates, updatedAt: new Date().toISOString() } 
        : note
    )
    saveNotes(updatedNotes)
  }

  const deleteNote = (id: string) => {
    saveNotes(notes.filter(note => note.id !== id))
  }

  const getCategoryInfo = (category: Note["category"]) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[3]
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800/50 hover:text-white hover:border-emerald-500/50 gap-2"
        >
          <StickyNote className="h-4 w-4" />
          <span className="hidden sm:inline">Заметки</span>
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-full sm:w-[90vw] md:w-[600px] sm:max-w-[600px] bg-[#0d1210] border-gray-800 p-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b border-gray-800 bg-[#0a0f0d]">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-white flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <StickyNote className="h-4 w-4 text-white" />
              </div>
              Рабочий стол заметок
            </SheetTitle>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Записывайте свои цели, достижения и планы
          </p>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Create new note section */}
          {isCreating ? (
            <Card className="bg-[#141a17] border-gray-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-gray-200 flex items-center justify-between">
                  <span>Новая заметка</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-white"
                    onClick={() => setIsCreating(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Название заметки"
                  value={newNote.title}
                  onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                  className="bg-[#0d1210] border-gray-700 text-white placeholder:text-gray-500"
                />
                <Textarea
                  placeholder="Напишите о своих целях, портфолио, кем хотите стать..."
                  value={newNote.content}
                  onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                  rows={4}
                  className="bg-[#0d1210] border-gray-700 text-white placeholder:text-gray-500 resize-none"
                />
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setNewNote({ ...newNote, category: cat.value })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        newNote.category === cat.value
                          ? cat.color + " ring-2 ring-offset-2 ring-offset-[#141a17]"
                          : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                      }`}
                    >
                      
                      {cat.label}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={addNote}
                  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить заметку
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Button
              onClick={() => setIsCreating(true)}
              variant="outline"
              className="w-full border-dashed border-gray-700 bg-transparent text-gray-400 hover:bg-gray-800/50 hover:text-white hover:border-emerald-500/50 h-16"
            >
              <Plus className="h-5 w-5 mr-2" />
              Создать заметку
            </Button>
          )}

          {/* Notes list */}
          <div className="space-y-3">
            {notes.length === 0 && !isCreating && (
              <div className="text-center py-12">
                <div className="h-16 w-16 rounded-full bg-gray-800/50 flex items-center justify-center mx-auto mb-4">
                  <StickyNote className="h-8 w-8 text-gray-600" />
                </div>
                <p className="text-gray-400 text-sm">
                  У вас пока нет заметок
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Создайте первую заметку о своих целях
                </p>
              </div>
            )}

            {notes.map((note) => {
              const catInfo = getCategoryInfo(note.category)
              const isEditing = editingId === note.id

              return (
                <Card 
                  key={note.id} 
                  className="bg-[#141a17] border-gray-800 group hover:border-gray-700 transition-colors"
                >
                  <CardContent className="p-4">
                    {isEditing ? (
                      <div className="space-y-3">
                        <Input
                          value={note.title}
                          onChange={(e) => updateNote(note.id, { title: e.target.value })}
                          className="bg-[#0d1210] border-gray-700 text-white"
                        />
                        <Textarea
                          value={note.content}
                          onChange={(e) => updateNote(note.id, { content: e.target.value })}
                          rows={4}
                          className="bg-[#0d1210] border-gray-700 text-white resize-none"
                        />
                        <Button
                          onClick={() => setEditingId(null)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Готово
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div 
                            className="flex-1 cursor-pointer"
                            onClick={() => setEditingId(note.id)}
                          >
                            <h4 className="font-medium text-white group-hover:text-emerald-400 transition-colors">
                              {note.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => deleteNote(note.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p 
                          className="text-sm text-gray-400 whitespace-pre-wrap cursor-pointer"
                          onClick={() => setEditingId(note.id)}
                        >
                          {note.content || "Нажмите, чтобы редактировать..."}
                        </p>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
                          <Badge variant="outline" className={`text-xs ${catInfo.color}`}>
                            <catInfo.icon className="h-3 w-3 mr-1" />
                            {catInfo.label}
                          </Badge>
                          <span className="text-xs text-gray-600">
                            {new Date(note.updatedAt).toLocaleDateString("ru-RU")}
                          </span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-6 py-4 border-t border-gray-800 bg-[#0a0f0d]">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            
            <span>Скоро: ИИ-рекомендации на основе ваших заметок</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
