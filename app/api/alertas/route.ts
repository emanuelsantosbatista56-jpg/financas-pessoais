import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { tipo, dados } = await request.json()

    const { data: profile } = await supabase
      .from('profiles').select('name').eq('id', user.id).single()

    const nome = profile?.name ?? 'Usuário'
    const email = user.email!

    let assunto = ''
    let html = ''

    if (tipo === 'orcamento_estourado') {
      assunto = `⚠️ Orçamento estourado: ${dados.categoria}`
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #6366f1; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">💰 Finanças Pessoais</h1>
          </div>
          <div style="background: #1f2937; padding: 30px; border-radius: 0 0 12px 12px;">
            <h2 style="color: #f87171; margin-top: 0;">⚠️ Limite de orçamento excedido!</h2>
            <p style="color: #d1d5db;">Olá, <strong style="color: white;">${nome}</strong>!</p>
            <p style="color: #d1d5db;">O orçamento da categoria <strong style="color: #f87171;">${dados.categoria}</strong> foi excedido.</p>
            <div style="background: #111827; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #9ca3af; margin: 4px 0;">Gasto: <strong style="color: #f87171;">${dados.gasto}</strong></p>
              <p style="color: #9ca3af; margin: 4px 0;">Limite: <strong style="color: white;">${dados.limite}</strong></p>
              <p style="color: #9ca3af; margin: 4px 0;">Excesso: <strong style="color: #f87171;">${dados.excesso}</strong></p>
            </div>
            <p style="color: #9ca3af; font-size: 14px;">Acesse seu app para revisar seus gastos.</p>
            <a href="https://financas-pessoais-app.vercel.app/dashboard/orcamento" 
               style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 10px;">
              Ver orçamento
            </a>
          </div>
        </div>
      `
    } else if (tipo === 'meta_prazo') {
      assunto = `🎯 Meta expirando em breve: ${dados.meta}`
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #6366f1; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">💰 Finanças Pessoais</h1>
          </div>
          <div style="background: #1f2937; padding: 30px; border-radius: 0 0 12px 12px;">
            <h2 style="color: #f59e0b; margin-top: 0;">🎯 Sua meta está expirando!</h2>
            <p style="color: #d1d5db;">Olá, <strong style="color: white;">${nome}</strong>!</p>
            <p style="color: #d1d5db;">A meta <strong style="color: #f59e0b;">${dados.meta}</strong> vence em <strong style="color: white;">${dados.dias} dias</strong>.</p>
            <div style="background: #111827; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #9ca3af; margin: 4px 0;">Progresso: <strong style="color: #6366f1;">${dados.progresso}%</strong></p>
              <p style="color: #9ca3af; margin: 4px 0;">Valor atual: <strong style="color: white;">${dados.atual}</strong></p>
              <p style="color: #9ca3af; margin: 4px 0;">Valor alvo: <strong style="color: white;">${dados.alvo}</strong></p>
              <p style="color: #9ca3af; margin: 4px 0;">Falta: <strong style="color: #f59e0b;">${dados.falta}</strong></p>
            </div>
            <a href="https://financas-pessoais-app.vercel.app/dashboard/metas"
               style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 10px;">
              Ver metas
            </a>
          </div>
        </div>
      `
    } else if (tipo === 'resumo_mensal') {
      assunto = `📊 Resumo financeiro de ${dados.mes}`
      html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #6366f1; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">💰 Finanças Pessoais</h1>
          </div>
          <div style="background: #1f2937; padding: 30px; border-radius: 0 0 12px 12px;">
            <h2 style="color: white; margin-top: 0;">📊 Resumo de ${dados.mes}</h2>
            <p style="color: #d1d5db;">Olá, <strong style="color: white;">${nome}</strong>! Aqui está seu resumo financeiro.</p>
            <div style="background: #111827; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #9ca3af; margin: 8px 0;">📈 Receitas: <strong style="color: #22c55e;">${dados.receitas}</strong></p>
              <p style="color: #9ca3af; margin: 8px 0;">📉 Despesas: <strong style="color: #f87171;">${dados.despesas}</strong></p>
              <p style="color: #9ca3af; margin: 8px 0;">💰 Balanço: <strong style="color: ${dados.balanco_positivo ? '#22c55e' : '#f87171'};">${dados.balanco}</strong></p>
              <p style="color: #9ca3af; margin: 8px 0;">🏦 Saldo total: <strong style="color: white;">${dados.saldo}</strong></p>
            </div>
            <a href="https://financas-pessoais-app.vercel.app/dashboard"
               style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 10px;">
              Ver dashboard
            </a>
          </div>
        </div>
      `
    }

    // Envia email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Finanças Pessoais <onboarding@resend.dev>',
        to: email,
        subject: assunto,
        html,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      return NextResponse.json({ error: resendData.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}