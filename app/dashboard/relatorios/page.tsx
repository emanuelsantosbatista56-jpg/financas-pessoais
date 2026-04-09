'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface GastoCategoria { name: string; color: string; icon: string; total: number }
interface ResumoMes { mes: string; receitas: number; despesas: number; saldo: number }

export default function RelatoriosPage() {
  const supabase = createClient()
  const [gastosCategoria, setGastosCategoria] = useState<GastoCategoria[]>([])
  const [resumoMeses, setResumoMeses] = useState<ResumoMes[]>([])
  const [totalReceitas, setTotalReceitas] = useState(0)
  const [totalDespesas, setTotalDespesas] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [periodoMeses, setPeriodoMeses] = useState(3)

  async function carregar() {
    setCarregando(true)
    const { data: { user } } = await supabase.auth.getUser()

    const dataInicio = new Date()
    dataInicio.setMonth(dataInicio.getMonth() - periodoMeses)
    const inicio = dataInicio.toISOString().split('T')[0]

    const { data: transacoes } = await supabase
      .from('transactions')
      .select('*, categories(name, color, icon)')
      .eq('user_id', user!.id)
      .gte('date', inicio)
      .order('date', { ascending: true })

    if (!transacoes) { setCarregando(false); return }

    // Gastos por categoria
    const catMap: Record<string, GastoCategoria> = {}
    transacoes.filter(t => t.type === 'expense').forEach(t => {
      if (t.categories) {
        const key = t.category_id ?? 'sem-categoria'
        if (!catMap[key]) catMap[key] = { name: t.categories.name, color: t.categories.color, icon: t.categories.icon, total: 0 }
        catMap[key].total += Number(t.amount)
      }
    })
    const gastosCat = Object.values(catMap).sort((a, b) => b.total - a.total)
    setGastosCategoria(gastosCat)

    // Resumo por mês
    const mesesMap: Record<string, ResumoMes> = {}
    transacoes.forEach(t => {
      const mes = t.date.substring(0, 7)
      if (!mesesMap[mes]) {
        const [ano, m] = mes.split('-')
        const nomeMes = new Date(parseInt(ano), parseInt(m) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        mesesMap[mes] = { mes: nomeMes, receitas: 0, despesas: 0, saldo: 0 }
      }
      if (t.type === 'income') mesesMap[mes].receitas += Number(t.amount)
      if (t.type === 'expense') mesesMap[mes].despesas += Number(t.amount)
      mesesMap[mes].saldo = mesesMap[mes].receitas - mesesMap[mes].despesas
    })
    setResumoMeses(Object.values(mesesMap))

    const rec = transacoes.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const desp = transacoes.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
    setTotalReceitas(rec)
    setTotalDespesas(desp)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [periodoMeses])

  const maxDesp = Math.max(...resumoMeses.map(m => m.despesas), 1)
  const maxRec = Math.max(...resumoMeses.map(m => m.receitas), 1)
  const maxBar = Math.max(maxDesp, maxRec)
  const totalGastosCat = gastosCategoria.reduce((a, g) => a + g.total, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Relatórios</h1>
          <p className="text-gray-400 text-sm mt-1">Análise detalhada das suas finanças</p>
        </div>
        <div className="flex bg-gray-800 rounded-xl p-1">
          {[1, 3, 6, 12].map((m) => (
            <button key={m} onClick={() => setPeriodoMeses(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${periodoMeses === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {m === 1 ? '1 mês' : m === 12 ? '1 ano' : `${m} meses`}
            </button>
          ))}
        </div>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Total de receitas</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{fmt(totalReceitas)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Total de despesas</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{fmt(totalDespesas)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Saldo do período</p>
          <p className={`text-2xl font-bold mt-1 ${totalReceitas - totalDespesas >= 0 ? 'text-white' : 'text-red-400'}`}>
            {fmt(totalReceitas - totalDespesas)}
          </p>
        </div>
      </div>

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Gráfico de barras por mês */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-5">Receitas vs Despesas por mês</h3>
            {resumoMeses.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Nenhum dado disponível</p>
            ) : (
              <div className="space-y-4">
                {resumoMeses.map((mes) => (
                  <div key={mes.mes}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-gray-400 text-xs capitalize">{mes.mes}</span>
                      <span className={`text-xs font-medium ${mes.saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {mes.saldo >= 0 ? '+' : ''}{fmt(mes.saldo)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-16 text-xs text-green-400 text-right">{fmt(mes.receitas)}</div>
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div className="h-2 rounded-full bg-green-500" style={{ width: `${(mes.receitas / maxBar) * 100}%` }} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 text-xs text-red-400 text-right">{fmt(mes.despesas)}</div>
                        <div className="flex-1 bg-gray-800 rounded-full h-2">
                          <div className="h-2 rounded-full bg-red-500" style={{ width: `${(mes.despesas / maxBar) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gastos por categoria */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-5">Gastos por categoria</h3>
            {gastosCategoria.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Nenhuma despesa categorizada</p>
            ) : (
              <div className="space-y-3">
                {gastosCategoria.map((cat) => {
                  const pct = totalGastosCat > 0 ? (cat.total / totalGastosCat) * 100 : 0
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{cat.icon}</span>
                          <span className="text-gray-300 text-sm">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-xs">{pct.toFixed(0)}%</span>
                          <span className="text-white text-sm font-medium">{fmt(cat.total)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-3 border-t border-gray-800 flex justify-between">
                  <span className="text-gray-400 text-sm">Total categorizado</span>
                  <span className="text-white font-bold">{fmt(totalGastosCat)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Maiores gastos */}
          {gastosCategoria.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 lg:col-span-2">
              <h3 className="text-white font-semibold mb-5">Distribuição de gastos</h3>
              <div className="flex gap-2 flex-wrap">
                {gastosCategoria.map((cat) => {
                  const pct = totalGastosCat > 0 ? (cat.total / totalGastosCat) * 100 : 0
                  return (
                    <div key={cat.name} className="flex-1 min-w-[120px] rounded-xl p-4 text-center"
                      style={{ backgroundColor: cat.color + '20', border: `1px solid ${cat.color}40` }}>
                      <div className="text-2xl mb-2">{cat.icon}</div>
                      <p className="text-xs text-gray-400 mb-1">{cat.name}</p>
                      <p className="font-bold text-sm" style={{ color: cat.color }}>{fmt(cat.total)}</p>
                      <p className="text-xs text-gray-500 mt-1">{pct.toFixed(0)}% do total</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}