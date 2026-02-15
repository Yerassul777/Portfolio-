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
      console.error("[v0] API GET error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error("[v0] API GET error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { category, data } = await request.json()

    if (!category || !data || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Missing or invalid category/data" }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { data: result, error } = await supabase
      .from(category)
      .insert(data)
      .select()

    if (error) {
      console.error("[v0] API POST error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("[v0] API POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { category, id } = await request.json()

    if (!category || !id || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Missing or invalid category/id" }, { status: 400 })
    }

    const supabase = getServiceClient()
    const { error } = await supabase
      .from(category)
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] API DELETE error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] API DELETE error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
