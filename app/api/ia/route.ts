import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages, system } = await request.json()

    const ultimaMensagem = messages[messages.length - 1].content
    const prompt = `${system}\n\nPergunta: ${ultimaMensagem}`

    // Tenta vários modelos em sequência
    const modelos = [
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
    ]

    let texto = ''
    let erros = []

    for (const modelo of modelos) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${modelo}:generateContent?key=${process.env.GEMINI_API_KEY}`,
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

      if (!data.error && data.candidates?.[0]?.content?.parts?.[0]?.text) {
        texto = data.candidates[0].content.parts[0].text
        break
      }

      erros.push(`${modelo}: ${data.error?.message ?? 'sem resposta'}`)
    }

    if (!texto) {
      return NextResponse.json({ content: [{ text: `Modelos tentados: ${erros.join(' | ')}` }] })
    }

    return NextResponse.json({ content: [{ text: texto }] })
  } catch (error) {
    return NextResponse.json({ content: [{ text: `Erro: ${error}` }] })
  }
}