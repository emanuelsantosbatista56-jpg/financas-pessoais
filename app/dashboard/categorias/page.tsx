'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const icones = ['🍔','🚗','🏠','💊','📚','🎮','✈️','👔','💡','🛒','💰','🎁','🐾','🏋️','🎵','💻','📱','🍕','☕','🧾']
const coresPadrao = ['#6366f1','#22c55e','#3b82f6','#f59e0b','#ec4899','#14b8a6','#ef4444','#8b5cf6','#f97316','#06b6d4']

interface Categoria {
  id: string; name: string; type: string; color: string; icon: string
  parent_id: string | null
}

export default function CategoriasPage() {
  const supabase = createClient()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aba, setAba] = useState<'expense' | 'income'>('expense')

  // Formulário
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'expense' | 'income' | 'both'>('expense')
  const [cor, setCor] = useState('#6366f1')
  const [icone, setIcone] = useState('🍔')
  const [parentId, setParentId] = useState('')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user!.id)
      .order('name')
    setCategorias(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!nome.trim()) { setErro('Digite o nome da categoria.'); return }
    setSalvando(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('categories').insert({
      user_id: user!.id,
      name: nome.trim(),
      type: tipo,
      color: cor,
      icon: icone,
      parent_id: parentId || null,
    })
    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
    } else {
      setNome(''); setParentId(''); setCor('#6366f1'); setIcone('🍔')
      setModalAberto(false)
      carregar()
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta categoria?')) return
    await supabase.from('categories').delete().eq('id', id)
    carregar()
  }

  async function criarPadrao() {
    const { data: { user } } = await supabase.auth.getUser()
    const padrao = [
      // Despesas
      { name: 'Alimentação', type: 'expense', color: '#f97316', icon: '🍔' },
      { name: 'Transporte', type: 'expense', color: '#3b82f6', icon: '🚗' },
      { name: 'Moradia', type: 'expense', color: '#8b5cf6', icon: '🏠' },
      { name: 'Saúde', type: 'expense', color: '#ef4444', icon: '💊' },
      { name: 'Educação', type: 'expense', color: '#06b6d4', icon: '📚' },
      { name: 'Lazer', type: 'expense', color: '#ec4899', icon: '🎮' },
      { name: 'Vestuário', type: 'expense', color: '#f59e0b', icon: '👔' },
      { name: 'Contas e Serviços', type: 'expense', color: '#6366f1', icon: '💡' },
      { name: 'Compras', type: 'expense', color: '#14b8a6', icon: '🛒' },
      // Receitas
      { name: 'Salário', type: 'income', color: '#22c55e', icon: '💰' },
      { name: 'Freelance', type: 'income', color: '#6366f1', icon: '💻' },
      { name: 'Investimentos', type: 'income', color: '#f59e0b', icon: '📈' },
      { name: 'Outros', type: 'both', color: '#888888', icon: '🧾' },
    ]
    await supabase.from('categories').insert(
      padrao.map(c => ({ ...c, user_id: user!.id, parent_id: null }))
    )
    carregar()
  }

  const filtradas = categorias.filter(c =>
    c.type === aba || c.type === 'both'
  ).filter(c => !c.parent_id)

  const subcategorias = (parentId: string) =>
    categorias.filter(c => c.parent_id === parentId)

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Categorias</h1>
          <p className="text-gray-400 text-sm mt-1">Organize suas receitas e despesas</p>
        </div>
        <div className="flex gap-3">
          {categorias.length === 0 && (
            <button
              onClick={criarPadrao}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              ✨ Criar categorias padrão
            </button>
          )}
          <button
            onClick={() => setModalAberto(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            + Nova categoria
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="flex bg-gray-800 rounded-xl p-1 w-fit">
        <button
          onClick={() => setAba('expense')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${aba === 'expense' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          📉 Despesas
        </button>
        <button
          onClick={() => setAba('income')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${aba === 'income' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
        >
          📈 Receitas
        </button>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🏷️</div>
          <h3 className="text-white font-semibold mb-2">Nenhuma categoria ainda</h3>
          <p className="text-gray-400 text-sm mb-6">Crie categorias para organizar melhor suas finanças.</p>
          <button
            onClick={criarPadrao}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            ✨ Criar categorias padrão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map((cat) => (
            <div key={cat.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 hover:border-gray-700 transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: cat.color + '25', border: `1px solid ${cat.color}40` }}
                  >
                    {cat.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium">{cat.name}</p>
                    <p className="text-xs" style={{ color: cat.color }}>
                      {cat.type === 'expense' ? 'Despesa' : cat.type === 'income' ? 'Receita' : 'Ambos'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => { setParentId(cat.id); setTipo(cat.type as any); setModalAberto(true) }}
                    className="text-gray-500 hover:text-indigo-400 text-xs transition-colors"
                    title="Adicionar subcategoria"
                  >
                    + sub
                  </button>
                  <button
                    onClick={() => excluir(cat.id)}
                    className="text-gray-700 hover:text-red-400 transition-colors text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Subcategorias */}
              {subcategorias(cat.id).length > 0 && (
                <div className="mt-2 space-y-1 border-t border-gray-800 pt-2">
                  {subcategorias(cat.id).map(sub => (
                    <div key={sub.id} className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-gray-800 group/sub">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{sub.icon}</span>
                        <span className="text-gray-300 text-sm">{sub.name}</span>
                      </div>
                      <button
                        onClick={() => excluir(sub.id)}
                        className="text-gray-700 hover:text-red-400 text-xs opacity-0 group-hover/sub:opacity-100 transition-all"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">
                {parentId ? 'Nova subcategoria' : 'Nova categoria'}
              </h2>
              <button onClick={() => { setModalAberto(false); setErro(''); setParentId('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              {parentId && (
                <div className="p-3 bg-indigo-900/30 border border-indigo-800 rounded-xl text-indigo-300 text-sm">
                  Subcategoria de: {categorias.find(c => c.id === parentId)?.name}
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome</label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Supermercado, Uber..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {!parentId && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Tipo</label>
                  <div className="flex bg-gray-800 rounded-xl p-1">
                    {(['expense', 'income', 'both'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTipo(t)}
                        className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${tipo === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                      >
                        {t === 'expense' ? '📉 Despesa' : t === 'income' ? '📈 Receita' : '↔️ Ambos'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Ícone</label>
                <div className="grid grid-cols-10 gap-2">
                  {icones.map((i) => (
                    <button
                      key={i}
                      onClick={() => setIcone(i)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${icone === i ? 'bg-indigo-600 scale-110' : 'bg-gray-800 hover:bg-gray-700'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {coresPadrao.map((c) => (
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
                onClick={() => { setModalAberto(false); setErro(''); setParentId('') }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-xl text-sm font-medium transition-colors"
              >
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}