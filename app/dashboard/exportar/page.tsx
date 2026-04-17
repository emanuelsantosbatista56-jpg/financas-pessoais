'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function ExportarPage() {
  const supabase = createClient()
  const relatorioRef = useRef<HTMLDivElement>(null)
  const [carregando, setCarregando] = useState(true)
  const [gerando, setGerando] = useState(false)
  const [mes, setMes] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const [dados, setDados] = useState<any>(null)

  async function carregar() {
    setCarregando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [ano, mesNum] = mes.split('-').map(Number)
    const inicio = new Date(ano, mesNum - 1, 1).toISOString().split('T')[0]
    const fim = new Date(ano, mesNum, 0).toISOString().split('T')[0]

    const [
      { data: transacoes },
      { data: contas },
      { data: metas },
      { data: dividas },
      { data: profile },
    ] = await Promise.all([
      supabase.from('transactions').select('*, categories(name, color), accounts(name)')
        .eq('user_id', user.id).gte('date', inicio).lte('date', fim).order('date', { ascending: false }),
      supabase.from('accounts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('is_completed', false),
      supabase.from('debts').select('*').eq('user_id', user.id).eq('is_active', true),
      supabase.from('profiles').select('name').eq('id', user.id).single(),
    ])

    const receitas = transacoes?.filter(t => t.type === 'income') ?? []
    const despesas = transacoes?.filter(t => t.type === 'expense') ?? []
    const totalReceitas = receitas.reduce((a, t) => a + Number(t.amount), 0)
    const totalDespesas = despesas.reduce((a, t) => a + Number(t.amount), 0)
    const saldoTotal = contas?.reduce((a, c) => a + Number(c.balance), 0) ?? 0

    // Gastos por categoria
    const gastosCat: Record<string, { total: number; color: string }> = {}
    despesas.forEach(t => {
      const cat = (t as any).categories?.name ?? 'Sem categoria'
      const color = (t as any).categories?.color ?? '#6366f1'
      if (!gastosCat[cat]) gastosCat[cat] = { total: 0, color }
      gastosCat[cat].total += Number(t.amount)
    })

    setDados({
      profile, transacoes, contas, metas, dividas,
      receitas, despesas, totalReceitas, totalDespesas, saldoTotal,
      gastosCat: Object.entries(gastosCat).sort(([,a],[,b]) => b.total - a.total),
      mesFormatado: new Date(ano, mesNum - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    })
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [mes])

  async function gerarPDF() {
  setGerando(true)
  setTimeout(() => {
    window.print()
    setGerando(false)
  }, 500)
}

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Exportar Relatório</h1>
          <p className="text-gray-400 text-sm mt-1">Baixe seu relatório financeiro em PDF</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors text-sm" />
          <button onClick={gerarPDF} disabled={gerando || carregando || !dados}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
            {gerando ? '⏳ Gerando...' : '📥 Baixar PDF'}
          </button>
        </div>
      </div>

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando dados...</div>
      ) : !dados ? (
        <div className="text-center py-12 text-gray-500">Nenhum dado disponível</div>
      ) : (
        <div ref={relatorioRef} className="bg-gray-900 rounded-2xl p-8 space-y-8" style={{ fontFamily: 'sans-serif' }}>

          {/* Cabeçalho */}
          <div className="flex items-start justify-between border-b border-gray-700 pb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-xl">💰</div>
                <h2 className="text-white text-2xl font-bold">Finanças Pessoais</h2>
              </div>
              <p className="text-gray-400 text-sm">Relatório financeiro mensal</p>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-lg capitalize">{dados.mesFormatado}</p>
              <p className="text-gray-400 text-sm">{dados.profile?.name ?? 'Usuário'}</p>
              <p className="text-gray-500 text-xs mt-1">Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          {/* Resumo principal */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Resumo do mês</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-2">Receitas</p>
                <p className="text-green-400 font-bold text-xl">{fmt(dados.totalReceitas)}</p>
                <p className="text-gray-600 text-xs mt-1">{dados.receitas.length} transações</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-2">Despesas</p>
                <p className="text-red-400 font-bold text-xl">{fmt(dados.totalDespesas)}</p>
                <p className="text-gray-600 text-xs mt-1">{dados.despesas.length} transações</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-400 text-xs mb-2">Balanço</p>
                <p className={`font-bold text-xl ${dados.totalReceitas - dados.totalDespesas >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {fmt(dados.totalReceitas - dados.totalDespesas)}
                </p>
                <p className="text-gray-600 text-xs mt-1">
                  {dados.totalReceitas > 0 ? `${Math.round((dados.totalDespesas/dados.totalReceitas)*100)}% gasto` : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Saldo das contas */}
          <div>
            <h3 className="text-white font-semibold text-lg mb-4">Saldo das contas</h3>
            <div className="space-y-2">
              {dados.contas?.map((c: any) => (
                <div key={c.id} className="flex justify-between items-center py-2.5 border-b border-gray-800">
                  <span className="text-gray-300 text-sm">{c.name}</span>
                  <span className={`font-bold text-sm ${Number(c.balance) >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {fmt(Number(c.balance))}
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="text-gray-400 font-medium text-sm">Total em contas</span>
                <span className="text-indigo-400 font-bold">{fmt(dados.saldoTotal)}</span>
              </div>
            </div>
          </div>

          {/* Gastos por categoria */}
          {dados.gastosCat.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">Gastos por categoria</h3>
              <div className="space-y-3">
                {dados.gastosCat.map(([cat, info]: [string, any]) => {
                  const pct = dados.totalDespesas > 0 ? (info.total / dados.totalDespesas) * 100 : 0
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{cat}</span>
                        <div className="flex gap-3">
                          <span className="text-gray-500">{pct.toFixed(0)}%</span>
                          <span className="text-white font-medium">{fmt(info.total)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: info.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Transações do mês */}
          {dados.transacoes && dados.transacoes.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">
                Transações do mês ({dados.transacoes.length})
              </h3>
              <div className="space-y-1">
                {dados.transacoes.slice(0, 30).map((t: any) => (
                  <div key={t.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{t.type === 'income' ? '📈' : '📉'}</span>
                      <div>
                        <p className="text-white text-sm">{t.description}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          {t.accounts && ` · ${t.accounts.name}`}
                          {t.categories && ` · ${t.categories.name}`}
                        </p>
                      </div>
                    </div>
                    <p className={`font-bold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                      {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                    </p>
                  </div>
                ))}
                {dados.transacoes.length > 30 && (
                  <p className="text-gray-500 text-xs text-center py-2">
                    + {dados.transacoes.length - 30} transações não exibidas
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Metas */}
          {dados.metas && dados.metas.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">Metas em andamento</h3>
              <div className="space-y-3">
                {dados.metas.map((m: any) => {
                  const pct = Math.min((Number(m.current_amount) / Number(m.target_amount)) * 100, 100)
                  return (
                    <div key={m.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{m.icon} {m.name}</span>
                        <span className="text-white font-medium">
                          {fmt(Number(m.current_amount))} / {fmt(Number(m.target_amount))}
                        </span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                      </div>
                      {m.deadline && (
                        <p className="text-gray-600 text-xs mt-0.5">
                          Prazo: {new Date(m.deadline + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Dívidas */}
          {dados.dividas && dados.dividas.length > 0 && (
            <div>
              <h3 className="text-white font-semibold text-lg mb-4">Dívidas em aberto</h3>
              <div className="space-y-2">
                {dados.dividas.map((d: any) => (
                  <div key={d.id} className="flex justify-between items-center py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-gray-300 text-sm">{d.name}</p>
                      {d.creditor && <p className="text-gray-600 text-xs">{d.creditor}</p>}
                    </div>
                    <p className="text-red-400 font-bold text-sm">{fmt(Number(d.remaining_amount))}</p>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-gray-400 text-sm">Total em dívidas</span>
                  <span className="text-red-400 font-bold">
                    {fmt(dados.dividas.reduce((a: number, d: any) => a + Number(d.remaining_amount), 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="border-t border-gray-700 pt-4 text-center">
            <p className="text-gray-600 text-xs">
              Relatório gerado pelo sistema Finanças Pessoais · {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}