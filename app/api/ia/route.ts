import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages, system } = await request.json()

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: system + '\n\nUsuário: ' + messages[messages.length - 1].content }] }
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
        }),
      }
    )

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ content: [{ text: `Erro: ${data.error.message}` }] })
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Não consegui processar.'
    return NextResponse.json({ content: [{ text: texto }] })
  } catch (error) {
    return NextResponse.json({ content: [{ text: `Erro interno: ${error}` }] })
  }
}