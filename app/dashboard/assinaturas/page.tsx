'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const cicloLabels: Record<string, string> = { monthly: 'Mensal', yearly: 'Anual', weekly: 'Semanal' }
const categoriaIcons: Record<string, string> = {
  streaming: '📺', musica: '🎵', software: '💻', jogos: '🎮',
  academia: '🏋️', educacao: '📚', nuvem: '☁️', outro: '📦'
}

interface Assinatura {
  id: string; name: string; amount: number; billing_cycle: string
  next_billing: string | null; category: string; color: string
  is_active: boolean; notes: string | null
}

export default function AssinaturasPage() {
  const supabase = createClient()
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [ciclo, setCiclo] = useState('monthly')
  const [proximaCobranca, setProximaCobranca] = useState('')
  const [categoria, setCategoria] = useState('streaming')
  const [cor, setCor] = useState('#6366f1')
  const [notas, setNotas] = useState('')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .order('amount', { ascending: false })
    setAssinaturas(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!nome.trim()) { setErro('Digite o nome.'); return }
    if (!valor || isNaN(parseFloat(valor))) { setErro('Digite o valor.'); return }
    setSalvando(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('subscriptions').insert({
      user_id: user!.id,
      name: nome.trim(),
      amount: parseFloat(valor.replace(',', '.')),
      billing_cycle: ciclo,
      next_billing: proximaCobranca || null,
      category: categoria,
      color: cor,
      notes: notas || null,
    })
    if (error) { setErro('Erro ao salvar.') } else {
      setNome(''); setValor(''); setProximaCobranca(''); setNotas('')
      setCiclo('monthly'); setCategoria('streaming'); setCor('#6366f1')
      setModalAberto(false); carregar()
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta assinatura?')) return
    await supabase.from('subscriptions').update({ is_active: false }).eq('id', id)
    carregar()
  }

  function valorMensal(a: Assinatura) {
    if (a.billing_cycle === 'yearly') return a.amount / 12
    if (a.billing_cycle === 'weekly') return a.amount * 4.33
    return a.amount
  }

  const totalMensal = assinaturas.reduce((acc, a) => acc + valorMensal(a), 0)
  const totalAnual = totalMensal * 12

  const proximasCobrancas = [...assinaturas]
    .filter(a => a.next_billing)
    .sort((a, b) => new Date(a.next_billing!).getTime() - new Date(b.next_billing!).getTime())
    .slice(0, 3)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Assinaturas</h1>
          <p className="text-gray-400 text-sm mt-1">Controle seus serviços recorrentes</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          + Nova assinatura
        </button>
      </div>

      {assinaturas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Custo mensal total</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{fmt(totalMensal)}</p>
            <p className="text-gray-600 text-xs mt-1">{assinaturas.length} assinatura{assinaturas.length !== 1 ? 's' : ''} ativa{assinaturas.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Custo anual total</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{fmt(totalAnual)}</p>
            <p className="text-gray-600 text-xs mt-1">Projeção 12 meses</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm mb-3">Próximas cobranças</p>
            {proximasCobrancas.length === 0 ? (
              <p className="text-gray-600 text-xs">Nenhuma data definida</p>
            ) : proximasCobrancas.map(a => (
              <div key={a.id} className="flex justify-between items-center mb-2 last:mb-0">
                <span className="text-gray-300 text-xs">{a.name}</span>
                <span className="text-xs font-medium" style={{ color: a.color }}>
                  {new Date(a.next_billing! + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : assinaturas.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🔄</div>
          <h3 className="text-white font-semibold mb-2">Nenhuma assinatura registrada</h3>
          <p className="text-gray-400 text-sm mb-6">Registre Netflix, Spotify, academia e outros serviços recorrentes.</p>
          <button onClick={() => setModalAberto(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Adicionar assinatura
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assinaturas.map((a) => {
            const mensal = valorMensal(a)
            const diasRestantes = a.next_billing
              ? Math.ceil((new Date(a.next_billing).getTime() - Date.now()) / 86400000)
              : null
            return (
              <div key={a.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 group hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl"
                      style={{ backgroundColor: a.color + '25', border: `1px solid ${a.color}40` }}>
                      {categoriaIcons[a.category] ?? '📦'}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{a.name}</p>
                      <p className="text-gray-500 text-xs">{cicloLabels[a.billing_cycle]}</p>
                    </div>
                  </div>
                  <button onClick={() => excluir(a.id)}
                    className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm">✕</button>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Valor cobrado</p>
                    <p className="text-white font-bold text-lg">{fmt(a.amount)}</p>
                    {a.billing_cycle !== 'monthly' && (
                      <p className="text-gray-500 text-xs">≈ {fmt(mensal)}/mês</p>
                    )}
                  </div>
                  {diasRestantes !== null && (
                    <div className={`text-right text-xs px-3 py-1.5 rounded-xl ${
                      diasRestantes <= 3 ? 'bg-red-900/30 text-red-400' :
                      diasRestantes <= 7 ? 'bg-yellow-900/30 text-yellow-400' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {diasRestantes <= 0 ? 'Hoje!' : `${diasRestantes}d`}
                      <p className="text-gray-600 text-xs">próx. cobrança</p>
                    </div>
                  )}
                </div>
                {a.notes && <p className="text-gray-600 text-xs mt-3 border-t border-gray-800 pt-2">{a.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Nova assinatura</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome do serviço</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Netflix, Spotify, Academia..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Valor</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" value={valor} onChange={(e) => setValor(e.target.value)}
                      placeholder="0,00" step="0.01"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Ciclo</label>
                  <select value={ciclo} onChange={(e) => setCiclo(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Categoria</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(categoriaIcons).map(([cat, icon]) => (
                    <button key={cat} onClick={() => setCategoria(cat)}
                      className={`py-2 rounded-xl text-sm flex flex-col items-center gap-1 transition-all ${categoria === cat ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      <span className="text-lg">{icon}</span>
                      <span className="text-xs capitalize">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Próxima cobrança (opcional)</label>
                <input type="date" value={proximaCobranca} onChange={(e) => setProximaCobranca(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Cor</label>
                <div className="flex gap-2">
                  {['#6366f1','#22c55e','#3b82f6','#f59e0b','#ec4899','#ef4444','#14b8a6','#8b5cf6'].map((c) => (
                    <button key={c} onClick={() => setCor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${cor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Observações (opcional)</label>
                <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ex: Plano familiar..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
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