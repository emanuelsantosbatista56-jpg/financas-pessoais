'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface GastoCategoria { name: string; color: string; icon: string; total: number }
interface ResumoMes { mes: string; receitas: number; despesas: number }

export default function RelatoriosPage() {
  const supabase = createClient()
  const [gastosCategoria, setGastosCategoria] = useState<GastoCategoria[]>([])
  const [resumoMeses, setResumoMeses] = useState<ResumoMes[]>([])
  const [totalReceitas, setTotalReceitas] = useState(0)
  const [totalDespesas, setTotalDespesas] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [periodoMeses, setPeriodoMeses] = useState(3)
  const [abaGrafico, setAbaGrafico] = useState<'pizza' | 'barras'>('pizza')

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
        const key = t.category_id ?? 'sem'
        if (!catMap[key]) catMap[key] = { name: t.categories.name, color: t.categories.color, icon: t.categories.icon, total: 0 }
        catMap[key].total += Number(t.amount)
      }
    })
    setGastosCategoria(Object.values(catMap).sort((a, b) => b.total - a.total))

    // Resumo por mês
    const mesesMap: Record<string, ResumoMes> = {}
    transacoes.forEach(t => {
      const mes = t.date.substring(0, 7)
      if (!mesesMap[mes]) {
        const [ano, m] = mes.split('-')
        const nomeMes = new Date(parseInt(ano), parseInt(m) - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        mesesMap[mes] = { mes: nomeMes, receitas: 0, despesas: 0 }
      }
      if (t.type === 'income') mesesMap[mes].receitas += Number(t.amount)
      if (t.type === 'expense') mesesMap[mes].despesas += Number(t.amount)
    })
    setResumoMeses(Object.values(mesesMap))

    const rec = transacoes.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
    const desp = transacoes.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
    setTotalReceitas(rec)
    setTotalDespesas(desp)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [periodoMeses])

  const totalGastosCat = gastosCategoria.reduce((a, g) => a + g.total, 0)

  const CustomTooltipPizza = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm">
          <p className="text-white font-medium">{d.icon} {d.name}</p>
          <p className="text-gray-300">{fmt(d.total)}</p>
          <p className="text-gray-500">{((d.total / totalGastosCat) * 100).toFixed(1)}%</p>
        </div>
      )
    }
    return null
  }

  const CustomTooltipBarras = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm">
          <p className="text-gray-400 mb-2 capitalize">{label}</p>
          {payload.map((p: any) => (
            <p key={p.name} style={{ color: p.color }} className="font-medium">
              {p.name === 'receitas' ? '📈' : '📉'} {fmt(p.value)}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
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

          {/* Gráfico de gastos por categoria */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-semibold">Gastos por categoria</h3>
              <div className="flex bg-gray-800 rounded-lg p-0.5">
                <button onClick={() => setAbaGrafico('pizza')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${abaGrafico === 'pizza' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>
                  Pizza
                </button>
                <button onClick={() => setAbaGrafico('barras')}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${abaGrafico === 'barras' ? 'bg-indigo-600 text-white' : 'text-gray-400'}`}>
                  Barras
                </button>
              </div>
            </div>

            {gastosCategoria.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-3">📊</p>
                <p>Nenhuma despesa categorizada ainda</p>
              </div>
            ) : abaGrafico === 'pizza' ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={gastosCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="total"
                    >
                      {gastosCategoria.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltipPizza />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legenda */}
                <div className="w-full space-y-2 mt-2">
                  {gastosCategoria.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-gray-300 text-sm">{cat.icon} {cat.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-xs">{((cat.total / totalGastosCat) * 100).toFixed(0)}%</span>
                        <span className="text-white text-sm font-medium">{fmt(cat.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {gastosCategoria.map((cat) => {
                  const pct = totalGastosCat > 0 ? (cat.total / totalGastosCat) * 100 : 0
                  return (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span className="text-gray-300 text-sm">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500 text-xs">{pct.toFixed(0)}%</span>
                          <span className="text-white text-sm font-medium">{fmt(cat.total)}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2.5">
                        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cat.color }} />
                      </div>
                    </div>
                  )
                })}
                <div className="pt-3 border-t border-gray-800 flex justify-between">
                  <span className="text-gray-400 text-sm">Total</span>
                  <span className="text-white font-bold">{fmt(totalGastosCat)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Gráfico de barras por mês */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-5">Receitas vs Despesas por mês</h3>
            {resumoMeses.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-4xl mb-3">📅</p>
                <p>Nenhum dado disponível</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={resumoMeses} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltipBarras />} cursor={{ fill: '#ffffff08' }} />
                  <Legend formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value === 'receitas' ? 'Receitas' : 'Despesas'}</span>} />
                  <Bar dataKey="receitas" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="despesas" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Cards de categoria coloridos */}
          {gastosCategoria.length > 0 && (
            <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Distribuição de gastos</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {gastosCategoria.slice(0, 8).map((cat) => {
                  const pct = totalGastosCat > 0 ? (cat.total / totalGastosCat) * 100 : 0
                  return (
                    <div key={cat.name} className="rounded-2xl p-4 text-center transition-transform hover:scale-105"
                      style={{ backgroundColor: cat.color + '18', border: `1px solid ${cat.color}35` }}>
                      <div className="text-3xl mb-2">{cat.icon}</div>
                      <p className="text-xs text-gray-400 mb-1 truncate">{cat.name}</p>
                      <p className="font-bold text-sm" style={{ color: cat.color }}>{fmt(cat.total)}</p>
                      <p className="text-xs text-gray-600 mt-1">{pct.toFixed(0)}% do total</p>
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