import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages, system } = await request.json()

    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: system }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
        }),
      }
    )

    const data = await response.json()
    console.log('Gemini status:', response.status)
    console.log('Gemini data:', JSON.stringify(data).substring(0, 500))

    if (data.error) {
      console.error('Gemini error:', data.error)
      return NextResponse.json({ content: [{ text: `Erro Gemini: ${data.error.message}` }] })
    }

    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!texto) {
      console.error('Sem texto na resposta:', JSON.stringify(data))
      return NextResponse.json({ content: [{ text: 'Resposta vazia do Gemini.' }] })
    }

    return NextResponse.json({ content: [{ text: texto }] })
  } catch (error) {
    console.error('Erro:', error)
    return NextResponse.json({ content: [{ text: `Erro: ${error}` }] })
  }
}