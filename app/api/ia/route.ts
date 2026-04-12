import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Lista os modelos disponíveis para sua chave
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
      { method: 'GET' }
    )

    const data = await response.json()
    const modelos = data.models?.map((m: any) => m.name).join(', ') ?? 'Nenhum modelo encontrado'
    
    return NextResponse.json({ content: [{ text: `Modelos disponíveis: ${modelos}` }] })
  } catch (error) {
    return NextResponse.json({ content: [{ text: `Erro: ${error}` }] })
  }
}