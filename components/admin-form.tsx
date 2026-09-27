"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Plus, Trash2, AlertTriangle, ImageIcon, LogOut, ShieldAlert } from "lucide-react"
import { CATEGORIES, FILTER_CONFIGS, CATEGORY_LABELS, type Category, type Opportunity } from "@/lib/types"
import useSWR, { mutate } from "swr"
import { AuthForm } from "@/components/auth-form"
import { useAuth } from "@/components/auth-provider"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type AdminItem = Pick<Opportunity, "id" | "kind" | "title" | "description" | "status">

// Read with the admin's own session: RLS shows admins every row, whatever its status.
async function fetchAllSessions(): Promise<{ category: Category; items: AdminItem[] }[]> {
  const { data, error } = await getSupabaseBrowserClient()
    .from("opportunities")
    .select("id, kind, title, description, status")
    .order("created_at", { ascending: false })
  if (error) throw error

  const items = (data ?? []) as AdminItem[]
  return CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.kind === category),
  }))
}

export function AdminForm() {
  const { user, loading: authLoading, signOut } = useAuth()
  // Tagged with the user it was checked for; anything else reads as "not checked yet".
  const [adminCheck, setAdminCheck] = useState<{ userId: string; isAdmin: boolean } | null>(null)
  const isAdmin = user && adminCheck?.userId === user.id ? adminCheck.isAdmin : null
  const [isLoading, setIsLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [sessionToDelete, setSessionToDelete] = useState<{ id: string; category: Category; title: string } | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // This only decides what to render. The database enforces the same rule on
  // every write through RLS, so a tampered client still cannot write.
  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    getSupabaseBrowserClient()
      .rpc("is_admin")
      .then(({ data, error }) => {
        if (!cancelled) setAdminCheck({ userId, isAdmin: !error && data === true })
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const { data: allSessions, isLoading: sessionsLoading } = useSWR(isAdmin ? "admin-sessions" : null, fetchAllSessions)

  const [formData, setFormData] = useState<{
    category: Category | ""
    title: string
    description: string
    link: string
    deadline: string
    imageUrl: string
    grantAvailable: boolean
    filterValues: Record<string, string>
  }>({
    category: "",
    title: "",
    description: "",
    link: "",
    deadline: "",
    imageUrl: "",
    grantAvailable: false,
    filterValues: {},
  })

  const currentFilterConfigs = formData.category ? FILTER_CONFIGS[formData.category] : []

  const handleCategoryChange = (value: Category) => {
    setFormData((prev) => ({
      ...prev,
      category: value,
      filterValues: {},
      grantAvailable: false,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.category) return

    setIsLoading(true)
    setMessage(null)

    try {
      const insertData: Record<string, string | boolean | null> = {
        kind: formData.category,
        title: formData.title,
        description: formData.description,
        link: formData.link,
        deadline: formData.deadline || null,
        image_url: formData.imageUrl || null,
      }

      // Add grant_available for universities
      if (formData.category === "universities") {
        insertData.grant_available = formData.grantAvailable
      }

      // Add filter values
      for (const [key, value] of Object.entries(formData.filterValues)) {
        if (value) insertData[key] = value
      }

      const { error } = await getSupabaseBrowserClient().from("opportunities").insert(insertData)

      if (error) {
        setMessage({
          type: "error",
          text:
            error.code === "42501"
              ? "Нет прав администратора для этой операции."
              : error.code === "23514"
                ? "Ссылка и изображение должны начинаться с http:// или https://."
                : "Не удалось добавить сеанс. Попробуйте ещё раз.",
        })
        return
      }

      setMessage({ type: "success", text: "Сеанс успешно добавлен!" })
      setFormData({
        category: "",
        title: "",
        description: "",
        link: "",
        deadline: "",
        imageUrl: "",
        grantAvailable: false,
        filterValues: {},
      })
      
      // Refresh sessions list
      mutate("admin-sessions")
      mutate(["opportunities", formData.category])
    } catch {
      setMessage({ type: "error", text: "Не удалось добавить сеанс. Попробуйте ещё раз." })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return

    setDeleteLoading(sessionToDelete.id)
    
    try {
      // RLS turns a disallowed delete into "0 rows" rather than an error, so the
      // count is what tells success from a silent refusal.
      const { error, count } = await getSupabaseBrowserClient()
        .from("opportunities")
        .delete({ count: "exact" })
        .eq("id", sessionToDelete.id)

      if (error || count === 0) {
        setMessage({
          type: "error",
          text: count === 0 ? "Запись не удалена: нет прав или она уже удалена." : "Не удалось удалить сеанс. Попробуйте ещё раз.",
        })
        return
      }

      setMessage({ type: "success", text: "Сеанс успешно удалён!" })

      // Refresh sessions list
      mutate("admin-sessions")
      mutate(["opportunities", sessionToDelete.category])
    } catch {
      setMessage({ type: "error", text: "Не удалось удалить сеанс. Попробуйте ещё раз." })
    } finally {
      setDeleteLoading(null)
      setSessionToDelete(null)
    }
  }

  const totalSessions = allSessions?.reduce((acc, cat) => acc + cat.items.length, 0) || 0

  if (authLoading || (user && isAdmin === null)) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8">
          <AuthForm
            title="Вход для администраторов"
            description="Войдите в аккаунт, которому выданы права администратора."
          />
        </CardContent>
      </Card>
    )
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="space-y-4 py-8 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-muted-foreground" />
          <div className="space-y-1">
            <p className="font-medium text-foreground">У этого аккаунта нет прав администратора</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" />
            Выйти и войти другим аккаунтом
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        <Button variant="ghost" size="sm" className="shrink-0 gap-2 text-muted-foreground" onClick={signOut}>
          <LogOut className="h-3.5 w-3.5" />
          Выйти
        </Button>
      </div>

      <Tabs defaultValue="add" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="add" className="gap-2">
            <Plus className="h-4 w-4" />
            Добавить сеанс
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Управление ({totalSessions})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Добавить новый сеанс
              </CardTitle>
              <CardDescription suppressHydrationWarning>
                Заполните информацию и выберите параметры фильтрации
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Категория</Label>
                  <Select value={formData.category} onValueChange={handleCategoryChange}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Выберите категорию" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="olympiads">Олимпиады</SelectItem>
                      <SelectItem value="competitions">Соревнования</SelectItem>
                      <SelectItem value="volunteering">Волонтёрство</SelectItem>
                      <SelectItem value="universities">Университеты</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Название</Label>
                  <Input
                    id="title"
                    placeholder="Введите название"
                    value={formData.title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Описание</Label>
                  <Textarea
                    id="description"
                    placeholder="Введите краткое описание"
                    value={formData.description}
                    onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="link">Ссылка</Label>
                    <Input
                      id="link"
                      type="url"
                      placeholder="https://example.com"
                      value={formData.link}
                      onChange={(e) => setFormData((prev) => ({ ...prev, link: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deadline">Дедлайн (необязательно)</Label>
                    <Input
                      id="deadline"
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Изображение (URL)
                  </Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Вставьте ссылку на изображение для фона карточки
                  </p>
                  {formData.imageUrl && (
                    <div className="mt-2 relative aspect-video w-full max-w-xs rounded-lg overflow-hidden border">
                      <img 
                        src={formData.imageUrl || "/placeholder.svg"} 
                        alt="Preview" 
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Grant toggle for universities */}
                {formData.category === "universities" && (
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="grant" className="text-base">Грантовое обучение</Label>
                      <p className="text-sm text-muted-foreground">
                        Доступны ли гранты в данном университете
                      </p>
                    </div>
                    <Switch
                      id="grant"
                      checked={formData.grantAvailable}
                      onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, grantAvailable: checked }))}
                    />
                  </div>
                )}

                {currentFilterConfigs.length > 0 && (
                  <div className="border-t pt-4 mt-4 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">Параметры для фильтрации</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {currentFilterConfigs
                        .filter(config => config.key !== 'grant_available')
                        .map((config) => (
                        <div key={config.key} className="space-y-2">
                          <Label htmlFor={`filter-${config.key}`}>{config.label}</Label>
                          <Select
                            value={formData.filterValues[config.key] || ""}
                            onValueChange={(value) =>
                              setFormData((prev) => ({
                                ...prev,
                                filterValues: { ...prev.filterValues, [config.key]: value },
                              }))
                            }
                          >
                            <SelectTrigger id={`filter-${config.key}`}>
                              <SelectValue placeholder={`Выберите`} />
                            </SelectTrigger>
                            <SelectContent>
                              {config.options.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {message && (
                  <div
                    className={`p-3 rounded-lg text-sm ${
                      message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={isLoading || !formData.category}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Добавление...
                    </>
                  ) : (
                    "Добавить сеанс"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Управление сеансами
              </CardTitle>
              <CardDescription>
                Просмотр и удаление существующих сеансов
              </CardDescription>
            </CardHeader>
            <CardContent>
              {message && (
                <div
                  className={`p-3 rounded-lg text-sm mb-4 ${
                    message.type === "success" ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {message.text}
                </div>
              )}

              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-6">
                  {allSessions?.map(({ category, items }) => (
                    <div key={category} className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        {CATEGORY_LABELS[category]}
                        <span className="text-sm font-normal text-muted-foreground">
                          ({items.length})
                        </span>
                      </h3>
                      
                      {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">
                          Нет сеансов в этой категории
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{item.title}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {item.description.slice(0, 60)}...
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 ml-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setSessionToDelete({ id: item.id, category, title: item.title })}
                                disabled={deleteLoading === item.id}
                              >
                                {deleteLoading === item.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Удалить сеанс?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить &ldquo;{sessionToDelete?.title}&rdquo;? 
              Это действие нельзя отменить, сеанс будет полностью удалён из базы данных.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              className="bg-destructive hover:bg-destructive/90 text-white text-white"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
