import { generateText } from "ai"

export async function POST(req: Request) {
  try {
    const { messages, notesContext } = await req.json()

    const systemPrompt = `Ты — персональный ИИ-помощник для казахстанских школьников и студентов. 
Ты помогаешь с выбором олимпиад, соревнований, волонтёрских программ и университетов в Казахстане.
Ты даёшь советы по развитию портфолио, подготовке к экзаменам (ЕНТ), и выбору карьерного пути.
Отвечай на русском языке, кратко и по делу.

${notesContext ? `Вот заметки пользователя для контекста:\n${notesContext}` : "У пользователя пока нет заметок."}`

    const result = await generateText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    })

    return Response.json({ message: result.text })
  } catch (error) {
    console.error("[v0] AI assistant error:", error)
    return Response.json(
      { error: "Failed to generate response" },
      { status: 500 }
    )
  }
}
