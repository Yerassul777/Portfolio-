import { createHash, timingSafeEqual } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

const VALID_CATEGORIES = ["olympiads", "competitions", "volunteering", "universities"]

// Columns the admin form is allowed to write. Anything else in the payload is
// dropped, so a caller cannot reach columns the UI never exposes.
const WRITABLE_COLUMNS = new Set([
  "title",
  "description",
  "link",
  "deadline",
  "image_url",
  "subject",
  "level",
  "age_group",
  "type",
  "format",
  "duration",
  "city",
  "field",
  "requirements",
  "grant_available",
])

const MAX_FIELD_LENGTH = 5000

/**
 * Phase 0 stopgap: a shared secret held only by the admins, replaced by real
 * Supabase Auth in Phase 1. Compared over SHA-256 digests so the two buffers
 * are always the same length, which timingSafeEqual requires.
 */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN
  if (!expected) return false

  const provided = request.headers.get("x-admin-token")
  if (!provided) return false

  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

function sanitizeWritePayload(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null

  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!WRITABLE_COLUMNS.has(key)) continue
    if (value === null) {
      clean[key] = null
    } else if (typeof value === "string") {
      if (value.length > MAX_FIELD_LENGTH) return null
      clean[key] = value
    } else if (typeof value === "boolean") {
      clean[key] = value
    }
  }

  if (!clean.title || !clean.description || !clean.link) return null
  return clean
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data, error } = await supabase
      .from(category)
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      console.error("API GET error:", error)
      return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error("API GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  try {
    const { category, data } = await request.json()

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Missing or invalid category" }, { status: 400 })
    }

    const payload = sanitizeWritePayload(data)
    if (!payload) {
      return NextResponse.json({ error: "Missing or invalid data" }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data: result, error } = await supabase.from(category).insert(payload).select()

    if (error) {
      console.error("API POST error:", error)
      return NextResponse.json({ error: "Failed to insert session" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("API POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized()

  try {
    const { category, id } = await request.json()

    if (!category || !id || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Missing or invalid category/id" }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { error } = await supabase.from(category).delete().eq("id", id)

    if (error) {
      console.error("API DELETE error:", error)
      return NextResponse.json({ error: "Failed to delete session" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
