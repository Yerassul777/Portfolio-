import { NextRequest, NextResponse } from "next/server"
import { createPublicClient } from "@/lib/supabase-server"

const VALID_CATEGORIES = ["olympiads", "competitions", "volunteering", "universities"]

// Read-only. Admin writes go straight to Supabase with the admin's own session,
// and RLS lets them through only when public.is_admin() is true.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get("category")

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }

    const supabase = createPublicClient()
    if (!supabase) {
      console.error("API GET error: Supabase URL or publishable key is not set")
      return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 })
    }

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
