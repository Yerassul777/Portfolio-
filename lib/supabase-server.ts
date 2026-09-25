import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const serverAuth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

// Server routes never hold the service-role key. They act either as the public
// or as the signed-in user, and RLS decides what each may do.

/** Anonymous: sees exactly what RLS grants the public — the catalogue. */
export function createPublicClient() {
  if (!url || !publishableKey) return null
  return createClient(url, publishableKey, { auth: serverAuth })
}

/** Acts as the user who owns `accessToken`: their RLS rows and function grants. */
export function createUserClient(accessToken: string) {
  if (!url || !publishableKey) return null
  return createClient(url, publishableKey, {
    auth: serverAuth,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}
