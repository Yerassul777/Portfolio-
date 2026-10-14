"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/auth-provider"
import type { Locale } from "@/lib/i18n/config"
import { loadSupabase } from "@/lib/supabase-browser"

/**
 * Whether the signed-in user is an admin; null while that is not known yet.
 * This only decides what to render: the database checks is_admin() on every
 * read and write, so a tampered client still gets nothing.
 */
export function useIsAdmin(): boolean | null {
  const { user, loading } = useAuth()
  // Tagged with the user it was checked for; anything else reads as "not checked yet".
  const [check, setCheck] = useState<{ userId: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false
    loadSupabase()
      .then((supabase) => supabase.rpc("is_admin"))
      .then(({ data, error }) => !cancelled && setCheck({ userId, ok: !error && data === true }))
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) return null
  if (!user) return false
  return check?.userId === user.id ? check.ok : null
}

/** An admin page's content; anyone else is sent to the admin panel to sign in. */
export function AdminOnly({ locale, children }: { locale: Locale; children: ReactNode }) {
  const isAdmin = useIsAdmin()

  if (isAdmin === null) {
    return (
      <div role="status" className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div className="space-y-3 py-16 text-center">
        <p className="text-muted-foreground">Эта страница только для администраторов.</p>
        <Button asChild variant="outline" className="h-11">
          <Link href={`/${locale}/admin`}>Войти в админ-панель</Link>
        </Button>
      </div>
    )
  }
  return children
}
