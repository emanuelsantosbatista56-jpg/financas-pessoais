'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Conta { id: string; name: string }
interface Categoria { id: string; name: string; color: string; type: string }
interface Recorrencia {
  id: string; description: string; amount: number; type: string
  day_of_month: number; is_active: boolean; last_generated: string | null
  accounts: { name: string } | null
  categories: { name: string; color: string } | null
}

export default function RecorrenciasPage() {
  const supabase = createClient()
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  // Formulário
  const [tipo, setTipo] = useState<'income' | 'expense'>('expense')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [diaDoMes, setDiaDoMes] = useState('1')
  const [contaId, setContaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: rec }, { data: ct }, { data: ca }] = await Promise.all([
      supabase.from('recurring_transactions')
        .select('*, accounts(name), categories(name, color)')
        .eq('user_id', user!.id)
        .order('day_of_month'),
      supabase.from('accounts').select('id, name').eq('user_id', user!.id).eq('is_active', true),
      supabase.from('categories').select('id, name, color, type').eq('user_id', user!.id),
    ])
    setRecorrencias((rec as Recorrencia[]) ?? [])
    setContas(ct ?? [])
    setCategorias(ca ?? [])
    if (ct && ct.length > 0) setContaId(ct[0].id)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!descricao.trim()) { setErro('Digite uma descrição.'); return }
    if (!valor || isNaN(parseFloat(valor))) { setErro('Digite um valor válido.'); return }
    if (!contaId) { setErro('Selecione uma conta.'); return }
    setSalvando(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('recurring_transactions').insert({
      user_id: user!.id,
      account_id: contaId,
      category_id: categoriaId || null,
      type: tipo,
      amount: parseFloat(valor.replace(',', '.')),
      description: descricao.trim(),
      day_of_month: parseInt(diaDoMes),
    })

    if (error) { setErro('Erro ao salvar.') } else {
      setDescricao(''); setValor(''); setDiaDoMes('1'); setCategoriaId('')
      setModalAberto(false); carregar()
    }
    setSalvando(false)
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from('recurring_transactions').update({ is_active: !ativo }).eq('id', id)
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta recorrência?')) return
    await supabase.from('recurring_transactions').delete().eq('id', id)
    carregar()
  }

  async function gerarDoMes() {
    setGerando(true); setMensagem(''); setErro('')
    const { data: { user } } = await supabase.auth.getUser()

    const hoje = new Date()
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const ativas = recorrencias.filter(r => r.is_active)
    let geradas = 0

    for (const rec of ativas) {
      // Verifica se já foi gerada este mês
      if (rec.last_generated && rec.last_generated.startsWith(mesAtual)) continue

      const dia = Math.min(rec.day_of_month, new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate())
      const data = `${mesAtual}-${String(dia).padStart(2, '0')}`

      const { error } = await supabase.from('transactions').insert({
        user_id: user!.id,
        account_id: (rec as any).account_id,
        category_id: (rec as any).category_id || null,
        type: rec.type,
        amount: rec.amount,
        description: rec.description,
        date: data,
        is_paid: true,
      })

      if (!error) {
        await supabase.from('recurring_transactions')
          .update({ last_generated: data })
          .eq('id', rec.id)

        // Atualiza saldo da conta
        const { data: contaAtual } = await supabase
          .from('accounts').select('balance').eq('id', (rec as any).account_id).single()
        if (contaAtual) {
          const novoSaldo = rec.type === 'income'
            ? Number(contaAtual.balance) + Number(rec.amount)
            : Number(contaAtual.balance) - Number(rec.amount)
          await supabase.from('accounts').update({ balance: novoSaldo }).eq('id', (rec as any).account_id)
        }
        geradas++
      }
    }

    if (geradas === 0) {
      setMensagem('Todas as transações recorrentes deste mês já foram geradas!')
    } else {
      setMensagem(`✅ ${geradas} transação${geradas !== 1 ? 'ões' : ''} gerada${geradas !== 1 ? 's' : ''} com sucesso!`)
    }
    setGerando(false)
    carregar()
  }

  const ativas = recorrencias.filter(r => r.is_active)
  const totalMensalDespesas = ativas.filter(r => r.type === 'expense').reduce((a, r) => a + Number(r.amount), 0)
  const totalMensalReceitas = ativas.filter(r => r.type === 'income').reduce((a, r) => a + Number(r.amount), 0)
  const categoriasFiltradas = categorias.filter(c => c.type === tipo || c.type === 'both')
  const mesAtual = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Recorrências</h1>
          <p className="text-gray-400 text-sm mt-1">Transações que se repetem todo mês automaticamente</p>
        </div>
        <div className="flex gap-3">
          <button onClick={gerarDoMes} disabled={gerando || ativas.length === 0}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2">
            {gerando ? '⏳ Gerando...' : `⚡ Gerar transações de ${mesAtual}`}
          </button>
          <button onClick={() => setModalAberto(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            + Nova recorrência
          </button>
        </div>
      </div>

      {mensagem && (
        <div className="p-4 bg-green-900/50 border border-green-800 rounded-2xl text-green-300 text-sm">
          {mensagem}
        </div>
      )}

      {/* Resumo */}
      {recorrencias.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Receitas mensais</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{fmt(totalMensalReceitas)}</p>
            <p className="text-gray-600 text-xs mt-1">{ativas.filter(r => r.type === 'income').length} recorrências</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Despesas mensais</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{fmt(totalMensalDespesas)}</p>
            <p className="text-gray-600 text-xs mt-1">{ativas.filter(r => r.type === 'expense').length} recorrências</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <p className="text-gray-400 text-sm">Balanço mensal fixo</p>
            <p className={`text-2xl font-bold mt-1 ${totalMensalReceitas - totalMensalDespesas >= 0 ? 'text-white' : 'text-red-400'}`}>
              {fmt(totalMensalReceitas - totalMensalDespesas)}
            </p>
          </div>
        </div>
      )}

      {/* Como funciona */}
      <div className="bg-indigo-900/20 border border-indigo-800/50 rounded-2xl p-4">
        <p className="text-indigo-300 text-sm font-medium mb-1">💡 Como funciona</p>
        <p className="text-gray-400 text-xs">
          Cadastre suas transações fixas mensais (salário, aluguel, assinaturas...). 
          No início de cada mês, clique em <strong className="text-white">"Gerar transações"</strong> e todas serão criadas automaticamente nas suas contas.
        </p>
      </div>

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : recorrencias.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🔁</div>
          <h3 className="text-white font-semibold mb-2">Nenhuma recorrência cadastrada</h3>
          <p className="text-gray-400 text-sm mb-6">Adicione salário, aluguel, assinaturas e outras transações fixas.</p>
          <button onClick={() => setModalAberto(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Adicionar recorrência
          </button>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <p className="text-white font-semibold">{recorrencias.length} recorrência{recorrencias.length !== 1 ? 's' : ''} cadastrada{recorrencias.length !== 1 ? 's' : ''}</p>
            <p className="text-gray-500 text-xs">Ordenadas por dia do mês</p>
          </div>
          <div className="divide-y divide-gray-800">
            {recorrencias.map((r) => {
              const jáGerada = r.last_generated?.startsWith(
                `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
              )
              return (
                <div key={r.id} className={`flex items-center justify-between px-5 py-4 transition-colors group ${r.is_active ? 'hover:bg-gray-800/50' : 'opacity-50'}`}>
                  <div className="flex items-center gap-4">
                    {/* Dia do mês */}
                    <div className="w-12 h-12 bg-gray-800 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
                      <p className="text-white font-bold text-lg leading-none">
                        {String(r.day_of_month).padStart(2, '0')}
                      </p>
                      <p className="text-gray-500 text-xs">todo mês</p>
                    </div>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${r.type === 'income' ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
                      {r.type === 'income' ? '📈' : '📉'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{r.description}</p>
                        {jáGerada && <span className="text-xs px-2 py-0.5 bg-green-900/30 text-green-400 rounded-full">✓ gerada</span>}
                        {!r.is_active && <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded-full">pausada</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {r.accounts && <span className="text-gray-500 text-xs">{r.accounts.name}</span>}
                        {r.categories && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            backgroundColor: r.categories.color + '30', color: r.categories.color
                          }}>
                            {r.categories.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className={`font-bold text-lg ${r.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                      {r.type === 'income' ? '+' : '-'}{fmt(Number(r.amount))}
                    </p>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => toggleAtivo(r.id, r.is_active)}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${r.is_active ? 'bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'}`}>
                        {r.is_active ? 'Pausar' : 'Ativar'}
                      </button>
                      <button onClick={() => excluir(r.id)}
                        className="text-gray-700 hover:text-red-400 transition-colors text-sm">✕</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Nova recorrência</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="flex bg-gray-800 rounded-xl p-1 mb-5">
              <button onClick={() => setTipo('expense')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tipo === 'expense' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                📉 Despesa
              </button>
              <button onClick={() => setTipo('income')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tipo === 'income' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                📈 Receita
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Descrição</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Salário, Aluguel, Netflix..."
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
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Dia do mês</label>
                  <input type="number" value={diaDoMes} onChange={(e) => setDiaDoMes(e.target.value)}
                    min="1" max="31"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Conta</label>
                <select value={contaId} onChange={(e) => setContaId(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                  {contas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {categoriasFiltradas.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Categoria (opcional)</label>
                  <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="">Sem categoria</option>
                    {categoriasFiltradas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {erro && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalAberto(false); setErro('') }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className={`flex-1 text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 ${tipo === 'income' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}