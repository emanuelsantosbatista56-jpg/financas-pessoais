import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages, system } = await request.json()

    const ultimaMensagem = messages[messages.length - 1].content
    const prompt = `${system}\n\nPergunta: ${ultimaMensagem}`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    )

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ content: [{ text: `Erro: ${data.error.message}` }] })
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Sem resposta.'
    return NextResponse.json({ content: [{ text: texto }] })
  } catch (error) {
    return NextResponse.json({ content: [{ text: `Erro: ${error}` }] })
  }
}