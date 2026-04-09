'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Cartao {
  id: string; name: string; credit_limit: number
  closing_day: number; due_day: number; color: string
}

interface Fatura {
  total: number; transacoes: any[]
}

export default function CartoesPage() {
  const supabase = createClient()
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [faturas, setFaturas] = useState<Record<string, Fatura>>({})
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string | null>(null)

  // Formulário
  const [nome, setNome] = useState('')
  const [limite, setLimite] = useState('')
  const [diaFechamento, setDiaFechamento] = useState('20')
  const [diaVencimento, setDiaVencimento] = useState('27')
  const [cor, setCor] = useState('#6366f1')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: cards } = await supabase
      .from('credit_cards')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    setCartoes(cards ?? [])

    // Busca faturas do mês atual para cada cartão
    if (cards && cards.length > 0) {
      const hoje = new Date()
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString()

      const faturasMap: Record<string, Fatura> = {}
      for (const card of cards) {
        const { data: tr } = await supabase
          .from('transactions')
          .select('*, categories(name, color)')
          .eq('credit_card_id', card.id)
          .gte('date', inicioMes)
          .lte('date', fimMes)
          .order('date', { ascending: false })

        const total = (tr ?? []).reduce((acc, t) => acc + Number(t.amount), 0)
        faturasMap[card.id] = { total, transacoes: tr ?? [] }
      }
      setFaturas(faturasMap)
    }

    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!nome.trim()) { setErro('Digite o nome do cartão.'); return }
    if (!limite || isNaN(parseFloat(limite))) { setErro('Digite o limite do cartão.'); return }
    setSalvando(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('credit_cards').insert({
      user_id: user!.id,
      name: nome.trim(),
      credit_limit: parseFloat(limite.replace(',', '.')),
      closing_day: parseInt(diaFechamento),
      due_day: parseInt(diaVencimento),
      color: cor,
    })
    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
    } else {
      setNome(''); setLimite(''); setDiaFechamento('20'); setDiaVencimento('27'); setCor('#6366f1')
      setModalAberto(false)
      carregar()
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este cartão?')) return
    await supabase.from('credit_cards').update({ is_active: false }).eq('id', id)
    carregar()
  }

  const cartaoAtivo = cartaoSelecionado ? cartoes.find(c => c.id === cartaoSelecionado) : null
  const faturaAtiva = cartaoSelecionado ? faturas[cartaoSelecionado] : null

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cartões de Crédito</h1>
          <p className="text-gray-400 text-sm mt-1">Controle seus cartões e faturas</p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          + Novo cartão
        </button>
      </div>

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : cartoes.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">💳</div>
          <h3 className="text-white font-semibold mb-2">Nenhum cartão cadastrado</h3>
          <p className="text-gray-400 text-sm mb-6">Adicione seus cartões para controlar faturas e parcelamentos.</p>
          <button onClick={() => setModalAberto(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Adicionar cartão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista de cartões */}
          <div className="space-y-4">
            {cartoes.map((cartao) => {
              const fatura = faturas[cartao.id]
              const percentual = fatura ? Math.min((fatura.total / cartao.credit_limit) * 100, 100) : 0
              const disponivel = cartao.credit_limit - (fatura?.total ?? 0)
              const ativo = cartaoSelecionado === cartao.id

              return (
                <div
                  key={cartao.id}
                  onClick={() => setCartaoSelecionado(ativo ? null : cartao.id)}
                  className={`cursor-pointer rounded-2xl p-5 transition-all group ${
                    ativo ? 'ring-2 ring-indigo-500' : 'hover:border-gray-700'
                  }`}
                  style={{ background: `linear-gradient(135deg, ${cartao.color}22, ${cartao.color}11)`, border: `1px solid ${cartao.color}40` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-2xl">💳</span>
                        <p className="text-white font-bold text-lg">{cartao.name}</p>
                      </div>
                      <p className="text-gray-400 text-xs">
                        Fecha dia {cartao.closing_day} · Vence dia {cartao.due_day}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); excluir(cartao.id) }}
                      className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Barra de uso */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Fatura atual</span>
                      <span>{percentual.toFixed(0)}% usado</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${percentual}%`,
                          backgroundColor: percentual > 80 ? '#ef4444' : percentual > 60 ? '#f59e0b' : cartao.color
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/20 rounded-xl p-3">
                      <p className="text-gray-400 text-xs mb-1">Fatura</p>
                      <p className="text-white font-bold">{fmt(fatura?.total ?? 0)}</p>
                    </div>
                    <div className="bg-black/20 rounded-xl p-3">
                      <p className="text-gray-400 text-xs mb-1">Disponível</p>
                      <p className="font-bold" style={{ color: cartao.color }}>{fmt(disponivel)}</p>
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs mt-2 text-right">Limite: {fmt(cartao.credit_limit)}</p>
                </div>
              )
            })}
          </div>

          {/* Detalhes da fatura */}
          {cartaoAtivo && faturaAtiva && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">
                Fatura de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })} — {cartaoAtivo.name}
              </h3>
              {faturaAtiva.transacoes.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhuma transação nesta fatura</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {faturaAtiva.transacoes.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                      <div>
                        <p className="text-white text-sm font-medium">{t.description}</p>
                        <p className="text-gray-500 text-xs">
                          {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          {t.categories && <span className="ml-2" style={{ color: t.categories.color }}>· {t.categories.name}</span>}
                        </p>
                      </div>
                      <p className="text-red-400 font-medium text-sm">{fmt(Number(t.amount))}</p>
                    </div>
                  ))}
                  <div className="flex justify-between pt-3 mt-2">
                    <p className="text-gray-300 font-semibold">Total da fatura</p>
                    <p className="text-white font-bold text-lg">{fmt(faturaAtiva.total)}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Novo cartão de crédito</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome do cartão</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Nubank, Itaú Platinum..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Limite total</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input
                    type="number"
                    value={limite}
                    onChange={(e) => setLimite(e.target.value)}
                    placeholder="0,00"
                    step="0.01"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Dia de fechamento</label>
                  <input
                    type="number"
                    value={diaFechamento}
                    onChange={(e) => setDiaFechamento(e.target.value)}
                    min="1" max="31"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Dia de vencimento</label>
                  <input
                    type="number"
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    min="1" max="31"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Cor do cartão</label>
                <div className="flex gap-2 flex-wrap">
                  {['#6366f1','#22c55e','#3b82f6','#f59e0b','#ec4899','#ef4444','#14b8a6','#8b5cf6'].map((c) => (
                    <button
                      key={c}
                      onClick={() => setCor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${cor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {erro && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalAberto(false); setErro('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                {salvando ? 'Salvando...' : 'Salvar cartão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}