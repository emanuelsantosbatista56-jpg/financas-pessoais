'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const tipoLabels: Record<string, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  cash: 'Dinheiro Físico',
  investment: 'Investimento',
  digital: 'Carteira Digital',
}

const tipoIcons: Record<string, string> = {
  checking: '🏦',
  savings: '🐷',
  cash: '💵',
  investment: '📈',
  digital: '📱',
}

interface Conta {
  id: string
  name: string
  type: string
  balance: number
  color: string
}

export default function ContasPage() {
  const supabase = createClient()
  const [contas, setContas] = useState<Conta[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Formulário
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('checking')
  const [saldo, setSaldo] = useState('')
  const [cor, setCor] = useState('#6366f1')

  async function carregarContas() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setContas(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregarContas() }, [])

  async function salvarConta() {
    if (!nome.trim()) { setErro('Digite o nome da conta.'); return }
    setSalvando(true)
    setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('accounts').insert({
      user_id: user!.id,
      name: nome.trim(),
      type: tipo,
      balance: parseFloat(saldo.replace(',', '.')) || 0,
      color: cor,
    })
    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
    } else {
      setNome(''); setTipo('checking'); setSaldo(''); setCor('#6366f1')
      setModalAberto(false)
      carregarContas()
    }
    setSalvando(false)
  }

  async function excluirConta(id: string) {
    if (!confirm('Deseja excluir esta conta?')) return
    await supabase.from('accounts').update({ is_active: false }).eq('id', id)
    carregarContas()
  }

  const saldoTotal = contas.reduce((acc, c) => acc + Number(c.balance), 0)
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contas</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie suas contas bancárias e carteiras</p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span>+</span> Nova conta
        </button>
      </div>

      {/* Card saldo total */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6">
        <p className="text-indigo-200 text-sm font-medium">Patrimônio em contas</p>
        <p className="text-4xl font-bold text-white mt-1">{fmt(saldoTotal)}</p>
        <p className="text-indigo-300 text-xs mt-2">{contas.length} conta{contas.length !== 1 ? 's' : ''} ativa{contas.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Lista de contas */}
      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : contas.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🏦</div>
          <h3 className="text-white font-semibold mb-2">Nenhuma conta ainda</h3>
          <p className="text-gray-400 text-sm mb-6">Adicione sua primeira conta para começar a controlar suas finanças.</p>
          <button
            onClick={() => setModalAberto(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Adicionar conta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map((conta) => (
            <div key={conta.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-gray-700 transition-colors group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: conta.color + '30', border: `1px solid ${conta.color}50` }}
                  >
                    {tipoIcons[conta.type] ?? '🏦'}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{conta.name}</p>
                    <p className="text-gray-500 text-xs">{tipoLabels[conta.type]}</p>
                  </div>
                </div>
                <button
                  onClick={() => excluirConta(conta.id)}
                  className="text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                >
                  ✕
                </button>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Saldo atual</p>
                <p className={`text-2xl font-bold ${Number(conta.balance) >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {fmt(Number(conta.balance))}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nova conta */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Nova conta</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome da conta</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Nubank, Bradesco, Carteira..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Tipo de conta</label>
                <select
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="checking">🏦 Conta Corrente</option>
                  <option value="savings">🐷 Poupança</option>
                  <option value="cash">💵 Dinheiro Físico</option>
                  <option value="investment">📈 Investimento</option>
                  <option value="digital">📱 Carteira Digital</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Saldo inicial</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input
                    type="number"
                    value={saldo}
                    onChange={(e) => setSaldo(e.target.value)}
                    placeholder="0,00"
                    step="0.01"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Cor</label>
                <div className="flex items-center gap-3">
                  {['#6366f1','#22c55e','#3b82f6','#f59e0b','#ec4899','#14b8a6'].map((c) => (
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

            {erro && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setModalAberto(false); setErro('') }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarConta}
                disabled={salvando}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-xl text-sm font-medium transition-colors"
              >
                {salvando ? 'Salvando...' : 'Salvar conta'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}