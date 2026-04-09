'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Divida {
  id: string; name: string; total_amount: number; remaining_amount: number
  interest_rate: number; monthly_payment: number | null
  start_date: string | null; end_date: string | null
  creditor: string | null; is_active: boolean
}

export default function DividasPage() {
  const supabase = createClient()
  const [dividas, setDividas] = useState<Divida[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [modalPagamento, setModalPagamento] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [valorPagamento, setValorPagamento] = useState('')

  // Formulário
  const [nome, setNome] = useState('')
  const [valorTotal, setValorTotal] = useState('')
  const [valorRestante, setValorRestante] = useState('')
  const [taxaJuros, setTaxaJuros] = useState('')
  const [parcela, setParcela] = useState('')
  const [credor, setCredor] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('debts').select('*')
      .eq('user_id', user!.id).eq('is_active', true)
      .order('created_at', { ascending: false })
    setDividas(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!nome.trim()) { setErro('Digite o nome da dívida.'); return }
    if (!valorTotal || isNaN(parseFloat(valorTotal))) { setErro('Digite o valor total.'); return }
    setSalvando(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const total = parseFloat(valorTotal.replace(',', '.'))
    const restante = parseFloat(valorRestante.replace(',', '.')) || total
    const { error } = await supabase.from('debts').insert({
      user_id: user!.id,
      name: nome.trim(),
      total_amount: total,
      remaining_amount: restante,
      interest_rate: parseFloat(taxaJuros.replace(',', '.')) || 0,
      monthly_payment: parseFloat(parcela.replace(',', '.')) || null,
      creditor: credor || null,
      start_date: dataInicio || null,
      end_date: dataFim || null,
    })
    if (error) { setErro('Erro ao salvar.') } else {
      setNome(''); setValorTotal(''); setValorRestante(''); setTaxaJuros('')
      setParcela(''); setCredor(''); setDataInicio(''); setDataFim('')
      setModalAberto(false); carregar()
    }
    setSalvando(false)
  }

  async function registrarPagamento(id: string) {
    if (!valorPagamento || isNaN(parseFloat(valorPagamento))) return
    const divida = dividas.find(d => d.id === id)
    if (!divida) return
    const pago = parseFloat(valorPagamento.replace(',', '.'))
    const novoRestante = Math.max(Number(divida.remaining_amount) - pago, 0)
    const quitada = novoRestante === 0
    await supabase.from('debts').update({
      remaining_amount: novoRestante,
      is_active: !quitada
    }).eq('id', id)
    setValorPagamento(''); setModalPagamento(null); carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta dívida?')) return
    await supabase.from('debts').update({ is_active: false }).eq('id', id)
    carregar()
  }

  function simularParcelas(divida: Divida) {
    if (!divida.monthly_payment || !divida.interest_rate) return null
    const taxa = Number(divida.interest_rate) / 100
    let saldo = Number(divida.remaining_amount)
    let meses = 0
    let totalJuros = 0
    while (saldo > 0 && meses < 600) {
      const juros = saldo * taxa
      totalJuros += juros
      saldo = saldo + juros - Number(divida.monthly_payment)
      if (saldo < 0) saldo = 0
      meses++
    }
    return { meses, totalJuros, totalPago: Number(divida.remaining_amount) + totalJuros }
  }

  const totalDividas = dividas.reduce((a, d) => a + Number(d.remaining_amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dívidas</h1>
          <p className="text-gray-400 text-sm mt-1">Controle e simule o pagamento de dívidas</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          + Nova dívida
        </button>
      </div>

      {/* Resumo */}
      {dividas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Total em dívidas</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{fmt(totalDividas)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Número de dívidas</p>
            <p className="text-2xl font-bold text-white mt-1">{dividas.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Parcela mensal total</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">
              {fmt(dividas.reduce((a, d) => a + Number(d.monthly_payment ?? 0), 0))}
            </p>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : dividas.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">📉</div>
          <h3 className="text-white font-semibold mb-2">Nenhuma dívida registrada</h3>
          <p className="text-gray-400 text-sm mb-6">Registre suas dívidas para controlar e simular pagamentos.</p>
          <button onClick={() => setModalAberto(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Registrar dívida
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {dividas.map((divida) => {
            const percentualPago = Math.min(
              ((Number(divida.total_amount) - Number(divida.remaining_amount)) / Number(divida.total_amount)) * 100, 100
            )
            const simulacao = simularParcelas(divida)

            return (
              <div key={divida.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 group hover:border-gray-700 transition-colors">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-white font-bold text-lg">{divida.name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {divida.creditor && <span className="text-gray-500 text-xs">📍 {divida.creditor}</span>}
                      {divida.interest_rate > 0 && <span className="text-yellow-400 text-xs">📊 {Number(divida.interest_rate)}% a.m.</span>}
                      {divida.monthly_payment && <span className="text-gray-400 text-xs">💳 Parcela: {fmt(Number(divida.monthly_payment))}</span>}
                      {divida.end_date && <span className="text-gray-400 text-xs">📅 Até {new Date(divida.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                    </div>
                  </div>
                  <button onClick={() => excluir(divida.id)}
                    className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm">✕</button>
                </div>

                {/* Progresso de pagamento */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>{percentualPago.toFixed(0)}% pago</span>
                    <span>Restante: <span className="text-red-400 font-medium">{fmt(Number(divida.remaining_amount))}</span></span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-3">
                    <div className="h-3 rounded-full bg-green-500 transition-all" style={{ width: `${percentualPago}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Pago: {fmt(Number(divida.total_amount) - Number(divida.remaining_amount))}</span>
                    <span>Total: {fmt(Number(divida.total_amount))}</span>
                  </div>
                </div>

                {/* Simulação */}
                {simulacao && (
                  <div className="bg-gray-800/50 rounded-xl p-3 mb-4 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-gray-500 text-xs">Parcelas restantes</p>
                      <p className="text-white font-bold">{simulacao.meses}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Total de juros</p>
                      <p className="text-yellow-400 font-bold text-sm">{fmt(simulacao.totalJuros)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Total a pagar</p>
                      <p className="text-red-400 font-bold text-sm">{fmt(simulacao.totalPago)}</p>
                    </div>
                  </div>
                )}

                <button onClick={() => setModalPagamento(divida.id)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border border-green-800 text-green-400 hover:bg-green-900/20 transition-colors">
                  💰 Registrar pagamento
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nova dívida */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Nova dívida</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome da dívida</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Financiamento do carro, Empréstimo..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Credor (opcional)</label>
                <input type="text" value={credor} onChange={(e) => setCredor(e.target.value)}
                  placeholder="Ex: Banco Itaú, Nubank..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Valor total</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)}
                      placeholder="0,00" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Valor restante</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" value={valorRestante} onChange={(e) => setValorRestante(e.target.value)}
                      placeholder="Igual ao total" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Taxa de juros (% a.m.)</label>
                  <input type="number" value={taxaJuros} onChange={(e) => setTaxaJuros(e.target.value)}
                    placeholder="0,00" step="0.01"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Parcela mensal</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" value={parcela} onChange={(e) => setParcela(e.target.value)}
                      placeholder="0,00" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Data de início</label>
                  <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Data de término</label>
                  <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
            </div>
            {erro && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalAberto(false); setErro('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                {salvando ? 'Salvando...' : 'Salvar dívida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pagamento */}
      {modalPagamento && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Registrar pagamento</h2>
              <button onClick={() => { setModalPagamento(null); setValorPagamento('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Dívida: <span className="text-white font-medium">{dividas.find(d => d.id === modalPagamento)?.name}</span>
            </p>
            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
              <input type="number" value={valorPagamento} onChange={(e) => setValorPagamento(e.target.value)}
                placeholder="Valor pago" step="0.01"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModalPagamento(null); setValorPagamento('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={() => registrarPagamento(modalPagamento)} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl text-sm font-medium transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}