'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Categoria { id: string; name: string; color: string; icon: string }
interface Orcamento {
  id: string; limit_amount: number; alert_at_percent: number; period: string
  categories: { name: string; color: string; icon: string } | null
  category_id: string
}
interface Gasto { category_id: string; total: number }

export default function OrcamentoPage() {
  const supabase = createClient()
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Formulário
  const [categoriaId, setCategoriaId] = useState('')
  const [limite, setLimite] = useState('')
  const [alertaEm, setAlertaEm] = useState('80')
  const [periodo, setPeriodo] = useState('monthly')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()

    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString()

    const [{ data: orc }, { data: cat }, { data: tr }] = await Promise.all([
      supabase.from('budgets').select('*, categories(name, color, icon)').eq('user_id', user!.id),
      supabase.from('categories').select('id, name, color, icon').eq('user_id', user!.id).eq('type', 'expense'),
      supabase.from('transactions').select('category_id, amount').eq('user_id', user!.id)
        .eq('type', 'expense').gte('date', inicioMes).lte('date', fimMes),
    ])

    // Agrupa gastos por categoria
    const gastosMap: Record<string, number> = {}
    ;(tr ?? []).forEach(t => {
      if (t.category_id) {
        gastosMap[t.category_id] = (gastosMap[t.category_id] ?? 0) + Number(t.amount)
      }
    })
    setGastos(Object.entries(gastosMap).map(([category_id, total]) => ({ category_id, total })))
    setOrcamentos((orc as Orcamento[]) ?? [])
    setCategorias(cat ?? [])
    if (cat && cat.length > 0) setCategoriaId(cat[0].id)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!categoriaId) { setErro('Selecione uma categoria.'); return }
    if (!limite || isNaN(parseFloat(limite))) { setErro('Digite o limite.'); return }
    setSalvando(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('budgets').insert({
      user_id: user!.id,
      category_id: categoriaId,
      limit_amount: parseFloat(limite.replace(',', '.')),
      alert_at_percent: parseInt(alertaEm),
      period: periodo,
    })
    if (error) { setErro('Erro ao salvar. Esta categoria já pode ter um orçamento.') }
    else { setLimite(''); setAlertaEm('80'); setModalAberto(false); carregar() }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este orçamento?')) return
    await supabase.from('budgets').delete().eq('id', id)
    carregar()
  }

  const gastoTotal = gastos.reduce((a, g) => a + g.total, 0)
  const limiteTotal = orcamentos.reduce((a, o) => a + Number(o.limit_amount), 0)
  const percentualGeral = limiteTotal > 0 ? Math.min((gastoTotal / limiteTotal) * 100, 100) : 0

  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Orçamento</h1>
          <p className="text-gray-400 text-sm mt-1 capitalize">Controle de gastos — {mesAtual}</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          + Novo orçamento
        </button>
      </div>

      {/* Resumo geral */}
      {orcamentos.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-300 font-semibold">Visão geral do mês</p>
            <span className={`text-sm font-bold ${percentualGeral > 80 ? 'text-red-400' : percentualGeral > 60 ? 'text-yellow-400' : 'text-green-400'}`}>
              {percentualGeral.toFixed(0)}% usado
            </span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-4 mb-3">
            <div className="h-4 rounded-full transition-all"
              style={{
                width: `${percentualGeral}%`,
                backgroundColor: percentualGeral > 80 ? '#ef4444' : percentualGeral > 60 ? '#f59e0b' : '#22c55e'
              }} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Gasto: <span className="text-white font-medium">{fmt(gastoTotal)}</span></span>
            <span className="text-gray-400">Limite: <span className="text-white font-medium">{fmt(limiteTotal)}</span></span>
            <span className="text-gray-400">Disponível: <span className="text-green-400 font-medium">{fmt(Math.max(limiteTotal - gastoTotal, 0))}</span></span>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : orcamentos.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-white font-semibold mb-2">Nenhum orçamento definido</h3>
          <p className="text-gray-400 text-sm mb-6">Defina limites de gastos por categoria para controlar melhor seu dinheiro.</p>
          <button onClick={() => setModalAberto(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Criar orçamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orcamentos.map((orc) => {
            const gasto = gastos.find(g => g.category_id === orc.category_id)?.total ?? 0
            const percentual = Math.min((gasto / Number(orc.limit_amount)) * 100, 100)
            const disponivel = Math.max(Number(orc.limit_amount) - gasto, 0)
            const alerta = percentual >= orc.alert_at_percent
            const estourou = gasto > Number(orc.limit_amount)
            const cat = orc.categories

            return (
              <div key={orc.id} className={`bg-gray-900 rounded-2xl p-5 group transition-colors border ${
                estourou ? 'border-red-800' : alerta ? 'border-yellow-800' : 'border-gray-800 hover:border-gray-700'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: (cat?.color ?? '#6366f1') + '25' }}>
                      {cat?.icon ?? '📂'}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{cat?.name ?? 'Categoria'}</p>
                      <p className="text-gray-500 text-xs capitalize">
                        {orc.period === 'monthly' ? 'Mensal' : orc.period === 'weekly' ? 'Semanal' : 'Anual'}
                        {alerta && !estourou && <span className="text-yellow-400 ml-2">⚠ Atenção</span>}
                        {estourou && <span className="text-red-400 ml-2">✕ Limite excedido</span>}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => excluir(orc.id)}
                    className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm">✕</button>
                </div>

                <div className="mb-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>{fmt(gasto)} gastos</span>
                    <span className={`font-medium ${estourou ? 'text-red-400' : alerta ? 'text-yellow-400' : 'text-gray-300'}`}>
                      {percentual.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div className="h-3 rounded-full transition-all"
                      style={{
                        width: `${percentual}%`,
                        backgroundColor: estourou ? '#ef4444' : alerta ? '#f59e0b' : cat?.color ?? '#6366f1'
                      }} />
                  </div>
                </div>

                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>Disponível: <span className={estourou ? 'text-red-400' : 'text-green-400'}>{estourou ? '-' + fmt(gasto - Number(orc.limit_amount)) : fmt(disponivel)}</span></span>
                  <span>Limite: {fmt(Number(orc.limit_amount))}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Novo orçamento</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Categoria</label>
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Limite de gastos</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" value={limite} onChange={(e) => setLimite(e.target.value)}
                    placeholder="0,00" step="0.01"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Período</label>
                <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                  <option value="monthly">Mensal</option>
                  <option value="weekly">Semanal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">
                  Alertar ao atingir {alertaEm}% do limite
                </label>
                <input type="range" min="50" max="100" value={alertaEm}
                  onChange={(e) => setAlertaEm(e.target.value)}
                  className="w-full accent-indigo-500" />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>50%</span><span>75%</span><span>100%</span>
                </div>
              </div>
            </div>
            {erro && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalAberto(false); setErro('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}