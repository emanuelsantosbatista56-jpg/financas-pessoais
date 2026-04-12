'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Conta { id: string; name: string; balance: number; type: string }
interface Transferencia {
  id: string; amount: number; description: string; date: string
  from_account: { name: string } | null
  to_account: { name: string } | null
}

export default function TransferenciasPage() {
  const supabase = createClient()
  const [contas, setContas] = useState<Conta[]>([])
  const [transferencias, setTransferencias] = useState<Transferencia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const [valor, setValor] = useState('')
  const [contaOrigemId, setContaOrigemId] = useState('')
  const [contaDestinoId, setContaDestinoId] = useState('')
  const [descricao, setDescricao] = useState('Transferência')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: ct }, { data: tr }] = await Promise.all([
      supabase.from('accounts').select('id, name, balance, type')
        .eq('user_id', user!.id).eq('is_active', true).order('name'),
      supabase.from('transactions')
        .select('id, amount, description, date, accounts!account_id(name)')
        .eq('user_id', user!.id)
        .eq('type', 'transfer')
        .order('date', { ascending: false })
        .limit(20),
    ])
    setContas(ct ?? [])
    if (ct && ct.length >= 2) {
      setContaOrigemId(ct[0].id)
      setContaDestinoId(ct[1].id)
    }
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function transferir() {
    if (!valor || isNaN(parseFloat(valor))) { setErro('Digite um valor válido.'); return }
    if (!contaOrigemId || !contaDestinoId) { setErro('Selecione as contas.'); return }
    if (contaOrigemId === contaDestinoId) { setErro('As contas devem ser diferentes.'); return }

    const valorNum = parseFloat(valor.replace(',', '.'))
    const contaOrigem = contas.find(c => c.id === contaOrigemId)
    if (!contaOrigem || Number(contaOrigem.balance) < valorNum) {
      setErro('Saldo insuficiente na conta de origem.')
      return
    }

    setSalvando(true); setErro(''); setMensagem('')
    const { data: { user } } = await supabase.auth.getUser()

    // Registra saída na conta origem
    const { error: e1 } = await supabase.from('transactions').insert({
      user_id: user!.id,
      account_id: contaOrigemId,
      type: 'transfer',
      amount: valorNum,
      description: `${descricao} → ${contas.find(c => c.id === contaDestinoId)?.name}`,
      date: data,
      is_paid: true,
    })

    // Registra entrada na conta destino
    const { error: e2 } = await supabase.from('transactions').insert({
      user_id: user!.id,
      account_id: contaDestinoId,
      type: 'transfer',
      amount: valorNum,
      description: `${descricao} ← ${contas.find(c => c.id === contaOrigemId)?.name}`,
      date: data,
      is_paid: true,
    })

    if (e1 || e2) {
      setErro('Erro ao registrar transferência.')
      setSalvando(false)
      return
    }

    // Atualiza saldos
    const contaDestino = contas.find(c => c.id === contaDestinoId)
    await Promise.all([
      supabase.from('accounts').update({
        balance: Number(contaOrigem.balance) - valorNum
      }).eq('id', contaOrigemId),
      supabase.from('accounts').update({
        balance: Number(contaDestino!.balance) + valorNum
      }).eq('id', contaDestinoId),
    ])

    setMensagem(`✅ Transferência de ${fmt(valorNum)} realizada com sucesso!`)
    setValor('')
    setDescricao('Transferência')
    carregar()
    setSalvando(false)
  }

  const tipoIcone: Record<string, string> = {
    checking: '🏦', savings: '🐷', cash: '💵', investment: '📈', digital: '📱'
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Transferências</h1>
        <p className="text-gray-400 text-sm mt-1">Mova dinheiro entre suas contas</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Formulário de transferência */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-white font-semibold text-lg mb-5">Nova transferência</h2>

          {contas.length < 2 ? (
            <div className="text-center py-8">
              <p className="text-5xl mb-3">🏦</p>
              <p className="text-gray-400 text-sm">Você precisa de pelo menos 2 contas para fazer transferências.</p>
              <a href="/dashboard/contas" className="text-indigo-400 hover:text-indigo-300 text-sm underline mt-2 block">
                Adicionar conta
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Conta origem */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">De (origem)</label>
                <select value={contaOrigemId} onChange={(e) => setContaOrigemId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                  {contas.map(c => (
                    <option key={c.id} value={c.id}>
                      {tipoIcone[c.type] ?? '🏦'} {c.name} — {fmt(Number(c.balance))}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seta */}
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 bg-indigo-600/20 border border-indigo-600/30 rounded-full flex items-center justify-center text-indigo-400 text-xl">
                  ↓
                </div>
              </div>

              {/* Conta destino */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Para (destino)</label>
                <select value={contaDestinoId} onChange={(e) => setContaDestinoId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                  {contas.map(c => (
                    <option key={c.id} value={c.id}>
                      {tipoIcone[c.type] ?? '🏦'} {c.name} — {fmt(Number(c.balance))}
                    </option>
                  ))}
                </select>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Valor</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" value={valor} onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00" step="0.01" min="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              {/* Data */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Data</label>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Descrição (opcional)</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Transferência"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>

              {erro && <div className="p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}
              {mensagem && <div className="p-3 bg-green-900/50 border border-green-800 rounded-xl text-green-300 text-sm">{mensagem}</div>}

              <button onClick={transferir} disabled={salvando || contas.length < 2}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                {salvando ? 'Transferindo...' : '↔️ Realizar transferência'}
              </button>
            </div>
          )}
        </div>

        {/* Saldos e histórico */}
        <div className="space-y-4">
          {/* Saldos */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Saldo das contas</h3>
            {carregando ? (
              <p className="text-gray-500 text-sm">Carregando...</p>
            ) : (
              <div className="space-y-3">
                {contas.map(c => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-2">
                      <span>{tipoIcone[c.type] ?? '🏦'}</span>
                      <span className="text-gray-300 text-sm">{c.name}</span>
                    </div>
                    <span className={`font-bold text-sm ${Number(c.balance) >= 0 ? 'text-white' : 'text-red-400'}`}>
                      {fmt(Number(c.balance))}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <span className="text-gray-400 text-sm font-medium">Total</span>
                  <span className="text-indigo-400 font-bold">
                    {fmt(contas.reduce((a, c) => a + Number(c.balance), 0))}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Histórico de transferências */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Histórico de transferências</h3>
            {carregando ? (
              <p className="text-gray-500 text-sm">Carregando...</p>
            ) : transferencias.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Nenhuma transferência realizada</p>
            ) : (
              <div className="space-y-2">
                {transferencias.map(t => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div>
                      <p className="text-white text-sm font-medium">{t.description}</p>
                      <p className="text-gray-500 text-xs">{new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                    <p className="text-indigo-400 font-bold text-sm">{fmt(Number(t.amount))}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}