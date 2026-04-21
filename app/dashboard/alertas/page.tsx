'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AlertasPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [dados, setDados] = useState<any>(null)

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0]
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split('T')[0]

    const [{ data: transacoes }, { data: contas }, { data: metas }, { data: orcamentos }] = await Promise.all([
      supabase.from('transactions').select('amount, type, category_id').eq('user_id', user.id)
        .gte('date', inicioMes).lte('date', fimMes),
      supabase.from('accounts').select('balance').eq('user_id', user.id).eq('is_active', true),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('is_completed', false),
      supabase.from('budgets').select('*, categories(name)').eq('user_id', user.id),
    ])

    const totalReceitas = transacoes?.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0) ?? 0
    const totalDespesas = transacoes?.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0) ?? 0
    const saldoTotal = contas?.reduce((a, c) => a + Number(c.balance), 0) ?? 0

    const gastosCat: Record<string, number> = {}
    transacoes?.filter(t => t.type === 'expense').forEach(t => {
      if (t.category_id) gastosCat[t.category_id] = (gastosCat[t.category_id] ?? 0) + Number(t.amount)
    })

    const orcamentosEstourados = orcamentos?.filter(o => {
      const gasto = gastosCat[o.category_id] ?? 0
      return gasto > Number(o.limit_amount)
    }) ?? []

    const metasExpirando = metas?.filter(m => {
      if (!m.deadline) return false
      const dias = Math.ceil((new Date(m.deadline).getTime() - Date.now()) / 86400000)
      return dias >= 0 && dias <= 30
    }) ?? []

    setDados({
      totalReceitas, totalDespesas, saldoTotal,
      orcamentosEstourados, metasExpirando,
      gastosCat, orcamentos,
      mesAtual: hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    })
  }

  useEffect(() => { carregar() }, [])

  async function enviarAlerta(tipo: string, dadosAlerta: any) {
    setEnviando(tipo); setMensagem(''); setErro('')
    try {
      const response = await fetch('/api/alertas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, dados: dadosAlerta }),
      })
      const data = await response.json()
      if (data.success) {
        setMensagem(`✅ Email enviado para ${email}!`)
      } else {
        setErro(`Erro: ${data.error}`)
      }
    } catch {
      setErro('Erro ao enviar email.')
    }
    setEnviando(null)
  }

  async function enviarResumoMensal() {
    if (!dados) return
    await enviarAlerta('resumo_mensal', {
      mes: dados.mesAtual,
      receitas: fmt(dados.totalReceitas),
      despesas: fmt(dados.totalDespesas),
      balanco: fmt(dados.totalReceitas - dados.totalDespesas),
      balanco_positivo: dados.totalReceitas >= dados.totalDespesas,
      saldo: fmt(dados.saldoTotal),
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Alertas por Email</h1>
        <p className="text-gray-400 text-sm mt-1">Receba notificações importantes no seu email</p>
      </div>

      {/* Email configurado */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">📧</div>
          <div>
            <p className="text-white font-medium">Email configurado</p>
            <p className="text-gray-400 text-sm">{email}</p>
          </div>
          <div className="ml-auto">
            <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded-full">✓ Ativo</span>
          </div>
        </div>
      </div>

      {mensagem && (
        <div className="p-4 bg-green-900/50 border border-green-800 rounded-2xl text-green-300 text-sm">{mensagem}</div>
      )}
      {erro && (
        <div className="p-4 bg-red-900/50 border border-red-800 rounded-2xl text-red-300 text-sm">{erro}</div>
      )}

      {/* Resumo mensal */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-white font-semibold">📊 Resumo mensal</h3>
            <p className="text-gray-400 text-sm mt-1">Receba um resumo completo das suas finanças do mês</p>
          </div>
        </div>
        {dados && (
          <div className="bg-gray-800 rounded-xl p-4 mb-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Receitas</p>
              <p className="text-green-400 font-bold">{fmt(dados.totalReceitas)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Despesas</p>
              <p className="text-red-400 font-bold">{fmt(dados.totalDespesas)}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Saldo</p>
              <p className="text-white font-bold">{fmt(dados.saldoTotal)}</p>
            </div>
          </div>
        )}
        <button onClick={enviarResumoMensal} disabled={enviando === 'resumo_mensal' || !dados}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-medium transition-colors">
          {enviando === 'resumo_mensal' ? '⏳ Enviando...' : '📧 Enviar resumo por email'}
        </button>
      </div>

      {/* Orçamentos estourados */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-1">⚠️ Alertas de orçamento</h3>
        <p className="text-gray-400 text-sm mb-4">Envie alertas para orçamentos que excederam o limite</p>

        {!dados?.orcamentosEstourados?.length ? (
          <div className="text-center py-4">
            <p className="text-green-400 text-sm">✅ Nenhum orçamento estourado este mês!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dados.orcamentosEstourados.map((o: any) => {
              const gasto = dados.gastosCat[o.category_id] ?? 0
              const excesso = gasto - Number(o.limit_amount)
              return (
                <div key={o.id} className="flex items-center justify-between bg-red-900/20 border border-red-800/50 rounded-xl p-4">
                  <div>
                    <p className="text-white font-medium">{o.categories?.name}</p>
                    <p className="text-red-400 text-xs">Excesso: {fmt(excesso)}</p>
                  </div>
                  <button
                    onClick={() => enviarAlerta('orcamento_estourado', {
                      categoria: o.categories?.name,
                      gasto: fmt(gasto),
                      limite: fmt(Number(o.limit_amount)),
                      excesso: fmt(excesso),
                    })}
                    disabled={enviando === 'orcamento_estourado'}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">
                    {enviando === 'orcamento_estourado' ? '⏳' : '📧 Enviar alerta'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Metas expirando */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-1">🎯 Alertas de metas</h3>
        <p className="text-gray-400 text-sm mb-4">Metas com prazo próximo (30 dias)</p>

        {!dados?.metasExpirando?.length ? (
          <div className="text-center py-4">
            <p className="text-green-400 text-sm">✅ Nenhuma meta expirando em breve!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dados.metasExpirando.map((m: any) => {
              const dias = Math.ceil((new Date(m.deadline).getTime() - Date.now()) / 86400000)
              const pct = Math.min((Number(m.current_amount) / Number(m.target_amount)) * 100, 100)
              const falta = Number(m.target_amount) - Number(m.current_amount)
              return (
                <div key={m.id} className="flex items-center justify-between bg-yellow-900/20 border border-yellow-800/50 rounded-xl p-4">
                  <div>
                    <p className="text-white font-medium">{m.icon} {m.name}</p>
                    <p className="text-yellow-400 text-xs">{dias} dias restantes · {pct.toFixed(0)}% concluída</p>
                  </div>
                  <button
                    onClick={() => enviarAlerta('meta_prazo', {
                      meta: m.name,
                      dias,
                      progresso: pct.toFixed(0),
                      atual: fmt(Number(m.current_amount)),
                      alvo: fmt(Number(m.target_amount)),
                      falta: fmt(falta),
                    })}
                    disabled={!!enviando}
                    className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors">
                    {enviando ? '⏳' : '📧 Enviar alerta'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Aviso sobre Resend */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-4">
        <p className="text-gray-500 text-xs">
          📧 Os emails são enviados via <strong className="text-gray-400">Resend</strong> (100 emails/dia grátis).
          No plano gratuito, os emails só podem ser enviados para o email cadastrado na conta Resend.
          Para enviar para qualquer email, configure um domínio próprio no Resend.
        </p>
      </div>
    </div>
  )
}