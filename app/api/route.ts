import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { messages, notesContext } = await request.json()

    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key не настроен. Добавьте OPENAI_API_KEY в переменные окружения." },
        { status: 500 }
      )
    }

    // System prompt that trains the AI to be a helpful career advisor
    const systemPrompt = `Ты - опытный карьерный наставник и мотивационный коуч для молодёжи Казахстана. 
Твоя цель - помогать студентам достигать своих целей, развивать навыки и строить успешную карьеру.

КОНТЕКСТ ЗАМЕТОК ПОЛЬЗОВАТЕЛЯ:
${notesContext || "Пользователь пока не создал заметок о своих целях."}

ТВОИ КАЧЕСТВА:
- Давай глубокие, продуманные советы, основанные на заметках пользователя
- Будь поддерживающим, мотивирующим, но честным
- Анализируй цели пользователя и предлагай конкретные шаги для их достижения
- Рекомендуй релевантные олимпиады, конкурсы, волонтёрские программы и университеты
- Помогай оценивать портфолио и предлагай, что можно улучшить
- Отслеживай прогресс пользователя на основе его заметок
- Говори на русском языке
- Будь кратким, но информативным (2-4 абзаца)

ПОМНИ:
- Всегда опирайся на заметки пользователя в своих ответах
- Давай конкретные, практичные советы
- Мотивируй и вдохновляй
- Будь "крутым парнем" - уверенным, но дружелюбным`

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.8,
        max_tokens: 500,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("[v0] OpenAI API error:", errorData)
      throw new Error("OpenAI API request failed")
    }

    const data = await response.json()
    const assistantMessage = data.choices[0]?.message?.content || "Не удалось получить ответ."

    return NextResponse.json({ message: assistantMessage })
  } catch (error) {
    console.error("[v0] AI Assistant API error:", error)
    return NextResponse.json(
      { error: "Не удалось обработать запрос к ИИ" },
      { status: 500 }
    )
  }
}
