'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Conta { id: string; name: string }
interface Categoria { id: string; name: string; color: string; type: string }
interface Transacao {
  id: string; description: string; amount: number; type: string
  date: string; is_paid: boolean; account_id: string; category_id: string | null
  accounts: { name: string } | null
  categories: { name: string; color: string } | null
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtData = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')

export default function TransacoesPage() {
  const supabase = createClient()
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [contas, setContas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [modalEditando, setModalEditando] = useState<Transacao | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'income' | 'expense'>('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroConta, setFiltroConta] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [filtrosAbertos, setFiltrosAbertos] = useState(false)
  const [ordenacao, setOrdenacao] = useState<'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'>('data_desc')

  // Formulário nova transação
  const [tipo, setTipo] = useState<'income' | 'expense'>('expense')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [contaId, setContaId] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [isPago, setIsPago] = useState(true)
  const [notas, setNotas] = useState('')
  const [erro, setErro] = useState('')

  // Formulário edição
  const [editTipo, setEditTipo] = useState<'income' | 'expense'>('expense')
  const [editDescricao, setEditDescricao] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editData, setEditData] = useState('')
  const [editContaId, setEditContaId] = useState('')
  const [editCategoriaId, setEditCategoriaId] = useState('')
  const [editIsPago, setEditIsPago] = useState(true)
  const [erroEdit, setErroEdit] = useState('')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: tr }, { data: ct }, { data: ca }] = await Promise.all([
      supabase.from('transactions')
        .select('*, accounts(name), categories(name, color)')
        .eq('user_id', user!.id)
        .order('date', { ascending: false })
        .limit(500),
      supabase.from('accounts').select('id, name').eq('user_id', user!.id).eq('is_active', true),
      supabase.from('categories').select('id, name, color, type').eq('user_id', user!.id),
    ])
    setTransacoes((tr as Transacao[]) ?? [])
    setContas(ct ?? [])
    setCategorias(ca ?? [])
    if (ct && ct.length > 0) setContaId(ct[0].id)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  function abrirEdicao(t: Transacao) {
    setModalEditando(t)
    setEditTipo(t.type as 'income' | 'expense')
    setEditDescricao(t.description)
    setEditValor(String(t.amount))
    setEditData(t.date)
    setEditContaId(t.account_id)
    setEditCategoriaId(t.category_id ?? '')
    setEditIsPago(t.is_paid)
    setErroEdit('')
  }

  async function salvarEdicao() {
    if (!editDescricao.trim()) { setErroEdit('Digite uma descrição.'); return }
    if (!editValor || isNaN(parseFloat(editValor))) { setErroEdit('Digite um valor válido.'); return }
    setSalvando(true); setErroEdit('')

    const valorNum = parseFloat(editValor.replace(',', '.'))
    const t = modalEditando!

    // Reverte saldo antigo
    const { data: contaAntiga } = await supabase.from('accounts').select('balance').eq('id', t.account_id).single()
    if (contaAntiga) {
      const saldoRevertido = t.type === 'income'
        ? Number(contaAntiga.balance) - Number(t.amount)
        : Number(contaAntiga.balance) + Number(t.amount)
      await supabase.from('accounts').update({ balance: saldoRevertido }).eq('id', t.account_id)
    }

    // Atualiza transação
    await supabase.from('transactions').update({
      account_id: editContaId,
      category_id: editCategoriaId || null,
      type: editTipo,
      amount: valorNum,
      description: editDescricao.trim(),
      date: editData,
      is_paid: editIsPago,
    }).eq('id', t.id)

    // Aplica novo saldo
    const { data: contaNova } = await supabase.from('accounts').select('balance').eq('id', editContaId).single()
    if (contaNova) {
      const novoSaldo = editTipo === 'income'
        ? Number(contaNova.balance) + valorNum
        : Number(contaNova.balance) - valorNum
      await supabase.from('accounts').update({ balance: novoSaldo }).eq('id', editContaId)
    }

    setModalEditando(null)
    carregar()
    setSalvando(false)
  }

  async function salvar() {
    if (!descricao.trim()) { setErro('Digite uma descrição.'); return }
    if (!valor || isNaN(parseFloat(valor))) { setErro('Digite um valor válido.'); return }
    if (!contaId) { setErro('Selecione uma conta.'); return }
    setSalvando(true); setErro('')

    const { data: { user } } = await supabase.auth.getUser()
    const valorNum = parseFloat(valor.replace(',', '.'))

    const { error } = await supabase.from('transactions').insert({
      user_id: user!.id, account_id: contaId,
      category_id: categoriaId || null, type: tipo,
      amount: valorNum, description: descricao.trim(),
      date: data, is_paid: isPago, notes: notas || null,
    })

    if (!error) {
      const { data: contaAtual } = await supabase.from('accounts').select('balance').eq('id', contaId).single()
      if (contaAtual) {
        const novoSaldo = tipo === 'income'
          ? Number(contaAtual.balance) + valorNum
          : Number(contaAtual.balance) - valorNum
        await supabase.from('accounts').update({ balance: novoSaldo }).eq('id', contaId)
      }
      setDescricao(''); setValor(''); setNotas(''); setCategoriaId('')
      setData(new Date().toISOString().split('T')[0])
      setModalAberto(false); carregar()
    } else { setErro('Erro ao salvar.') }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta transação?')) return
    await supabase.from('transactions').delete().eq('id', id)
    carregar()
  }

  const filtradas = transacoes
    .filter(t => {
      if (filtroTipo !== 'todos' && t.type !== filtroTipo) return false
      if (busca && !t.description.toLowerCase().includes(busca.toLowerCase())) return false
      if (filtroCategoria && (t as any).categories?.name !== filtroCategoria) return false
      if (filtroConta && (t as any).accounts?.name !== filtroConta) return false
      if (filtroDataInicio && t.date < filtroDataInicio) return false
      if (filtroDataFim && t.date > filtroDataFim) return false
      return true
    })
    .sort((a, b) => {
      if (ordenacao === 'data_desc') return b.date.localeCompare(a.date)
      if (ordenacao === 'data_asc') return a.date.localeCompare(b.date)
      if (ordenacao === 'valor_desc') return Number(b.amount) - Number(a.amount)
      return Number(a.amount) - Number(b.amount)
    })

  const totalReceitas = filtradas.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0)
  const totalDespesas = filtradas.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0)
  const temFiltrosAtivos = busca || filtroCategoria || filtroConta || filtroDataInicio || filtroDataFim || filtroTipo !== 'todos'

  function limparFiltros() {
    setBusca(''); setFiltroTipo('todos'); setFiltroCategoria('')
    setFiltroConta(''); setFiltroDataInicio(''); setFiltroDataFim('')
  }

  const categoriasFiltradas = categorias.filter(c => c.type === tipo || c.type === 'both')
  const categoriasFiltEditando = categorias.filter(c => c.type === editTipo || c.type === 'both')

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Transações</h1>
          <p className="text-gray-400 text-sm mt-1">Registre, filtre e edite receitas e despesas</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          + Nova transação
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-sm">Receitas filtradas</p>
          <p className="text-xl font-bold text-green-400 mt-1">{fmt(totalReceitas)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-sm">Despesas filtradas</p>
          <p className="text-xl font-bold text-red-400 mt-1">{fmt(totalDespesas)}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-gray-400 text-sm">Resultado</p>
          <p className={`text-xl font-bold mt-1 ${totalReceitas - totalDespesas >= 0 ? 'text-white' : 'text-red-400'}`}>
            {fmt(totalReceitas - totalDespesas)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por descrição..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm" />
          </div>
          <button onClick={() => setFiltrosAbertos(!filtrosAbertos)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${filtrosAbertos || temFiltrosAtivos ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            ⚙️ Filtros
            {temFiltrosAtivos && <span className="w-2 h-2 bg-yellow-400 rounded-full" />}
          </button>
          <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as any)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-gray-300 text-sm focus:outline-none focus:border-indigo-500 transition-colors">
            <option value="data_desc">Mais recentes</option>
            <option value="data_asc">Mais antigas</option>
            <option value="valor_desc">Maior valor</option>
            <option value="valor_asc">Menor valor</option>
          </select>
        </div>

        {filtrosAbertos && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Tipo</label>
                <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as any)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="todos">Todos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Categoria</label>
                <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">Todas</option>
                  {categorias.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Conta</label>
                <select value={filtroConta} onChange={(e) => setFiltroConta(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500">
                  <option value="">Todas</option>
                  {contas.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Período</label>
                <div className="flex gap-1">
                  <input type="date" value={filtroDataInicio} onChange={(e) => setFiltroDataInicio(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-indigo-500" />
                  <input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-xs focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>
            {temFiltrosAtivos && (
              <button onClick={limparFiltros} className="text-red-400 hover:text-red-300 text-xs transition-colors">
                ✕ Limpar filtros
              </button>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {(['todos', 'income', 'expense'] as const).map((f) => (
            <button key={f} onClick={() => setFiltroTipo(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filtroTipo === f ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {f === 'todos' ? 'Todos' : f === 'income' ? '📈 Receitas' : '📉 Despesas'}
            </button>
          ))}
          <span className="ml-auto text-gray-500 text-sm self-center">
            {filtradas.length} transaç{filtradas.length !== 1 ? 'ões' : 'ão'}
          </span>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        {carregando ? (
          <div className="text-center py-12 text-gray-500">Carregando...</div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">{temFiltrosAtivos ? '🔍' : '💸'}</div>
            <p className="text-gray-400">{temFiltrosAtivos ? 'Nenhuma transação encontrada' : 'Nenhuma transação ainda'}</p>
            {temFiltrosAtivos ? (
              <button onClick={limparFiltros} className="mt-3 text-indigo-400 text-sm underline">Limpar filtros</button>
            ) : (
              <button onClick={() => setModalAberto(true)} className="mt-4 text-indigo-400 text-sm underline">Adicionar primeira transação</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filtradas.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${t.type === 'income' ? 'bg-green-600/20' : t.type === 'transfer' ? 'bg-indigo-600/20' : 'bg-red-600/20'}`}>
                    {t.type === 'income' ? '📈' : t.type === 'transfer' ? '↔️' : '📉'}
                  </div>
                  <div>
                    <p className="text-white font-medium">{t.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-gray-500 text-xs">{fmtData(t.date)}</span>
                      {t.accounts && <span className="text-gray-600 text-xs">· {t.accounts.name}</span>}
                      {t.categories && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: t.categories.color + '30', color: t.categories.color }}>
                          {t.categories.name}
                        </span>
                      )}
                      {!t.is_paid && <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-600/20 text-yellow-400">Pendente</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className={`font-bold text-lg ${t.type === 'income' ? 'text-green-400' : t.type === 'transfer' ? 'text-indigo-400' : 'text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                  </p>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {t.type !== 'transfer' && (
                      <button onClick={() => abrirEdicao(t)}
                        className="text-gray-500 hover:text-indigo-400 transition-colors text-sm px-2 py-1 rounded-lg hover:bg-indigo-900/20">
                        ✏️
                      </button>
                    )}
                    <button onClick={() => excluir(t.id)}
                      className="text-gray-700 hover:text-red-400 transition-colors text-sm">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nova transação */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Nova transação</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="flex bg-gray-800 rounded-xl p-1 mb-5">
              <button onClick={() => setTipo('expense')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tipo === 'expense' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📉 Despesa</button>
              <button onClick={() => setTipo('income')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${tipo === 'income' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>📈 Receita</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Descrição</label>
                <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Supermercado, Salário..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Valor</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" step="0.01" min="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Data</label>
                  <input type="date" value={data} onChange={(e) => setData(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Conta</label>
                  <select value={contaId} onChange={(e) => setContaId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    {contas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
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
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Observações (opcional)</label>
                <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Alguma nota..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setIsPago(!isPago)} className={`w-11 h-6 rounded-full transition-colors relative ${isPago ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPago ? 'left-6' : 'left-1'}`} />
                </div>
                <span className="text-gray-300 text-sm font-medium">{isPago ? 'Pago / Recebido' : 'Pendente'}</span>
              </label>
            </div>
            {erro && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalAberto(false); setErro('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className={`flex-1 text-white py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-60 ${tipo === 'income' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}>
                {salvando ? 'Salvando...' : `Salvar ${tipo === 'income' ? 'receita' : 'despesa'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar transação */}
      {modalEditando && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Editar transação</h2>
              <button onClick={() => setModalEditando(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="flex bg-gray-800 rounded-xl p-1 mb-5">
              <button onClick={() => setEditTipo('expense')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${editTipo === 'expense' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>📉 Despesa</button>
              <button onClick={() => setEditTipo('income')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${editTipo === 'income' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>📈 Receita</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Descrição</label>
                <input type="text" value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Valor</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" value={editValor} onChange={(e) => setEditValor(e.target.value)} step="0.01" min="0"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Data</label>
                  <input type="date" value={editData} onChange={(e) => setEditData(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Conta</label>
                  <select value={editContaId} onChange={(e) => setEditContaId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    {contas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              {categoriasFiltEditando.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Categoria</label>
                  <select value={editCategoriaId} onChange={(e) => setEditCategoriaId(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                    <option value="">Sem categoria</option>
                    {categoriasFiltEditando.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <label className="flex items-center gap-3 cursor-pointer">
                <div onClick={() => setEditIsPago(!editIsPago)} className={`w-11 h-6 rounded-full transition-colors relative ${editIsPago ? 'bg-indigo-600' : 'bg-gray-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${editIsPago ? 'left-6' : 'left-1'}`} />
                </div>
                <span className="text-gray-300 text-sm font-medium">{editIsPago ? 'Pago / Recebido' : 'Pendente'}</span>
              </label>
            </div>
            {erroEdit && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erroEdit}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setModalEditando(null)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={salvarEdicao} disabled={salvando} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}