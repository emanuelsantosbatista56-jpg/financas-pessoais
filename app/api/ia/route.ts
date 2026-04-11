import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { messages, system } = await request.json()

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        system,
        messages,
      }),
    })

    const data = await response.json()

    if (data.error) {
      console.error('Anthropic error:', data.error)
      return NextResponse.json({ error: data.error.message }, { status: 400 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}