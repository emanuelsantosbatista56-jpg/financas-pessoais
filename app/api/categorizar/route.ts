import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { descricao, categorias } = await request.json()

    const listaCategorias = categorias.map((c: any) => c.name).join(', ')

    const prompt = `Você é um sistema de categorização financeira. 
Com base na descrição da transação, escolha a categoria mais adequada da lista.
Responda APENAS com o nome exato da categoria, sem explicações.
Se nenhuma categoria for adequada, responda "Sem categoria".

Categorias disponíveis: ${listaCategorias}

Descrição da transação: "${descricao}"

Categoria:`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 50, temperature: 0.1 },
        }),
      }
    )

    const data = await response.json()
    const categoria = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    return NextResponse.json({ categoria })
  } catch (error) {
    return NextResponse.json({ categoria: '' })
  }
}