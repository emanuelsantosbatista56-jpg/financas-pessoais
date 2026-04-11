'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
}

const sugestoesIniciais = [
  'Como estão meus gastos este mês?',
  'Onde estou gastando mais dinheiro?',
  'Estou conseguindo poupar?',
  'Como posso reduzir meus gastos?',
  'Quando vou atingir minha meta?',
  'Tenho dívidas preocupantes?',
]

export default function IAPage() {
  const supabase = createClient()
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [contextoCarregado, setContextoCarregado] = useState(false)
  const [contexto, setContexto] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  async function carregarContexto() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString()
    const inicioAno = new Date(hoje.getFullYear(), 0, 1).toISOString()

    const [
      { data: transacoesMes },
      { data: transacoesAno },
      { data: contas },
      { data: metas },
      { data: orcamentos },
      { data: dividas },
      { data: assinaturas },
    ] = await Promise.all([
      supabase.from('transactions').select('*, categories(name)')
        .eq('user_id', user.id).gte('date', inicioMes).lte('date', fimMes),
      supabase.from('transactions').select('amount, type, date, categories(name)')
        .eq('user_id', user.id).gte('date', inicioAno),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('is_completed', false),
      supabase.from('budgets').select('*, categories(name)').eq('user_id', user.id),
      supabase.from('debts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('is_active', true),
    ])

    const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`

    const receitasMes = transacoesMes?.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0) ?? 0
    const despesasMes = transacoesMes?.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0) ?? 0
    const saldoTotal = contas?.reduce((a, c) => a + Number(c.balance), 0) ?? 0

    const gastosCat: Record<string, number> = {}
    transacoesMes?.filter(t => t.type === 'expense').forEach(t => {
      const cat = (t as any).categories?.name ?? 'Sem categoria'
      gastosCat[cat] = (gastosCat[cat] ?? 0) + Number(t.amount)
    })

    const gastosMeses: Record<string, { rec: number; desp: number }> = {}
    transacoesAno?.forEach(t => {
      const mes = t.date.substring(0, 7)
      if (!gastosMeses[mes]) gastosMeses[mes] = { rec: 0, desp: 0 }
      if (t.type === 'income') gastosMeses[mes].rec += Number(t.amount)
      if (t.type === 'expense') gastosMeses[mes].desp += Number(t.amount)
    })

    const totalAssinaturas = assinaturas?.reduce((a, s) => {
      if (s.billing_cycle === 'yearly') return a + Number(s.amount) / 12
      if (s.billing_cycle === 'weekly') return a + Number(s.amount) * 4.33
      return a + Number(s.amount)
    }, 0) ?? 0

    const totalDividas = dividas?.reduce((a, d) => a + Number(d.remaining_amount), 0) ?? 0

    const ctx = `
Você é um assistente financeiro pessoal chamado FinIA. Analise os dados financeiros do usuário e responda de forma clara, direta e em português brasileiro. Seja amigável mas objetivo. Use emojis com moderação. Dê conselhos práticos baseados nos dados reais.

DADOS FINANCEIROS ATUAIS (${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}):

SALDO E CONTAS:
${contas?.map(c => `- ${c.name}: ${fmt(Number(c.balance))}`).join('\n') ?? 'Nenhuma conta'}
- Saldo total: ${fmt(saldoTotal)}

MÊS ATUAL:
- Receitas: ${fmt(receitasMes)}
- Despesas: ${fmt(despesasMes)}
- Balanço: ${fmt(receitasMes - despesasMes)} (${receitasMes > 0 ? ((despesasMes / receitasMes) * 100).toFixed(0) : 0}% das receitas gastos)

GASTOS POR CATEGORIA (mês atual):
${Object.entries(gastosCat).sort(([,a],[,b]) => b-a).map(([cat, val]) => `- ${cat}: ${fmt(val)}`).join('\n') || '- Nenhum gasto categorizado'}

HISTÓRICO MENSAL (ano):
${Object.entries(gastosMeses).sort().map(([mes, v]) => `- ${mes}: receitas ${fmt(v.rec)}, despesas ${fmt(v.desp)}`).join('\n') || '- Sem histórico'}

METAS:
${metas?.map(m => `- ${m.name}: ${fmt(Number(m.current_amount))} de ${fmt(Number(m.target_amount))} (${((Number(m.current_amount)/Number(m.target_amount))*100).toFixed(0)}%)${m.deadline ? ` · prazo: ${new Date(m.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}`).join('\n') || '- Nenhuma meta'}

ORÇAMENTOS:
${orcamentos?.map(o => {
  const gasto = gastosCat[(o as any).categories?.name ?? ''] ?? 0
  const pct = (gasto / Number(o.limit_amount)) * 100
  return `- ${(o as any).categories?.name}: ${fmt(gasto)} de ${fmt(Number(o.limit_amount))} (${pct.toFixed(0)}%)`
}).join('\n') || '- Nenhum orçamento'}

DÍVIDAS:
${dividas?.map(d => `- ${d.name}: ${fmt(Number(d.remaining_amount))} restantes${d.interest_rate > 0 ? ` · juros: ${d.interest_rate}% a.m.` : ''}`).join('\n') || '- Nenhuma dívida'}
- Total em dívidas: ${fmt(totalDividas)}

ASSINATURAS (custo mensal):
${assinaturas?.map(s => `- ${s.name}: ${fmt(Number(s.amount))}/${s.billing_cycle === 'yearly' ? 'ano' : s.billing_cycle === 'weekly' ? 'semana' : 'mês'}`).join('\n') || '- Nenhuma assinatura'}
- Total mensal em assinaturas: ${fmt(totalAssinaturas)}

Responda sempre com base nesses dados reais. Se o usuário perguntar algo que não está nos dados, diga que não tem essa informação disponível.
`
    setContexto(ctx)
    setContextoCarregado(true)
  }

  useEffect(() => { carregarContexto() }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  async function enviar(texto?: string) {
    const pergunta = texto ?? input.trim()
    if (!pergunta || carregando) return

    const novasMensagens: Mensagem[] = [...mensagens, { role: 'user', content: pergunta }]
    setMensagens(novasMensagens)
    setInput('')
    setCarregando(true)

    try {
      const response = await fetch('/api/ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: contexto,
          messages: novasMensagens.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()
      const resposta = data.content?.[0]?.text ?? 'Desculpe, não consegui processar sua pergunta.'
      setMensagens(prev => [...prev, { role: 'assistant', content: resposta }])
    } catch (error) {
      console.error('Erro:', error)
      setMensagens(prev => [...prev, {
        role: 'assistant',
        content: `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`
      }])
    }

    setCarregando(false)
  }

  function formatarTexto(texto: string) {
    return texto
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-xl">🤖</div>
        <div>
          <h1 className="text-xl font-bold text-white">FinIA — Assistente Financeiro</h1>
          <p className="text-gray-400 text-xs">
            {contextoCarregado ? '✅ Dados carregados — pronto para analisar' : '⏳ Carregando seus dados...'}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensagens.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <div className="text-5xl mb-4">💬</div>
              <h3 className="text-white font-semibold text-lg mb-2">Olá! Sou sua IA financeira</h3>
              <p className="text-gray-400 text-sm mb-8 max-w-md">
                Analisei seus dados financeiros e estou pronto para responder suas dúvidas, dar dicas e ajudar a melhorar suas finanças.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {sugestoesIniciais.map((s) => (
                  <button key={s} onClick={() => enviar(s)} disabled={!contextoCarregado}
                    className="text-left px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-indigo-500 rounded-xl text-gray-300 text-sm transition-all disabled:opacity-50">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0 mt-1">🤖</div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-gray-800 text-gray-200 rounded-bl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <div dangerouslySetInnerHTML={{ __html: formatarTexto(msg.content) }} />
                ) : msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm ml-2 flex-shrink-0 mt-1">👤</div>
              )}
            </div>
          ))}

          {carregando && (
            <div className="flex justify-start">
              <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0">🤖</div>
              <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-sm">
                <div className="flex gap-1 items-center h-4">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-gray-800 p-4">
          {mensagens.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {['Resumo do mês', 'Dicas de economia', 'Status das metas', 'Análise de dívidas'].map((s) => (
                <button key={s} onClick={() => enviar(s)} disabled={carregando}
                  className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder={contextoCarregado ? 'Pergunte sobre suas finanças...' : 'Carregando dados...'}
              disabled={!contextoCarregado || carregando}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 text-sm" />
            <button onClick={() => enviar()} disabled={!input.trim() || carregando || !contextoCarregado}
              className="w-11 h-11 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white rounded-xl transition-colors flex items-center justify-center">
              <span className="text-lg">↑</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}