import { NextResponse } from "next/server"
import OpenAI from "openai"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { messages, notesContext } = await req.json()

    const systemPrompt = `Ты персональный карьерный помощник для молодых людей в Казахстане. Твоя задача - помогать им с выбором образования, развитием навыков и построением карьеры.

${notesContext ? `\n\nКонтекст заметок пользователя:\n${notesContext}\n\nИспользуй эту информацию для персонализированных советов.` : ''}

Отвечай на русском языке, будь дружелюбным, мотивирующим и давай конкретные советы.`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 1000,
    })

    return NextResponse.json({
      message: completion.choices[0].message.content,
    })
  } catch (error: any) {
    console.error("[v0] AI Assistant API error:", error)
    return NextResponse.json(
      { error: "Не удалось получить ответ от ИИ. Проверьте настройки API ключа." },
      { status: 500 }
    )
  }
}
