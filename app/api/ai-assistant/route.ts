export async function POST(req: Request) {
  try {
    const { messages, notesContext } = await req.json()

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.error("[v0] Missing OPENAI_API_KEY")
      return Response.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      )
    }

    const systemPrompt = `Ты — персональный ИИ-помощник для казахстанских школьников и студентов. 
Ты помогаешь с выбором олимпиад, соревнований, волонтёрских программ и университетов в Казахстане.
Ты даёшь советы по развитию портфолио, подготовке к экзаменам (ЕНТ), и выбору карьерного пути.
Отвечай на русском языке, кратко и по делу.

${notesContext ? `Вот заметки пользователя для контекста:\n${notesContext}` : "У пользователя пока нет заметок."}`

    console.log("[v0] Calling OpenAI API directly")

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("[v0] OpenAI API error:", error)
      return Response.json(
        { error: "Failed to get response from OpenAI" },
        { status: response.status }
      )
    }

    const data = await response.json()
    const assistantMessage = data.choices[0]?.message?.content || "Извините, я не смог сгенерировать ответ."

    console.log("[v0] OpenAI response received successfully")

    return Response.json({ message: assistantMessage })
  } catch (error) {
    console.error("[v0] AI assistant error:", error)
    return Response.json(
      { error: "Failed to generate response" },
      { status: 500 }
    )
  }
}
