import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { category, data } = await request.json()

    if (!category || !data) {
      return NextResponse.json({ error: "Missing category or data" }, { status: 400 })
    }

    // Use service role client to bypass PostgREST cache
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log("[v0] API inserting data:", { category, data })

    const { data: result, error } = await supabase
      .from(category)
      .insert(data)
      .select()

    if (error) {
      console.error("[v0] API Supabase error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { category, id } = await request.json()

    if (!category || !id) {
      return NextResponse.json({ error: "Missing category or id" }, { status: 400 })
    }

    // Use service role client to bypass PostgREST cache
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { error } = await supabase
      .from(category)
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] API Supabase delete error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
