'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Meta {
  id: string; name: string; target_amount: number
  current_amount: number; deadline: string | null
  color: string; icon: string; is_completed: boolean
}

export default function MetasPage() {
  const supabase = createClient()
  const [metas, setMetas] = useState<Meta[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [modalAporte, setModalAporte] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Formulário nova meta
  const [nome, setNome] = useState('')
  const [valorAlvo, setValorAlvo] = useState('')
  const [valorAtual, setValorAtual] = useState('')
  const [prazo, setPrazo] = useState('')
  const [cor, setCor] = useState('#6366f1')
  const [icone, setIcone] = useState('🎯')

  // Formulário aporte
  const [valorAporte, setValorAporte] = useState('')

  const icones = ['🎯','🏠','🚗','✈️','📱','💻','🎓','💍','🏖️','🐶','💰','🏋️']

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    setMetas(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!nome.trim()) { setErro('Digite o nome da meta.'); return }
    if (!valorAlvo || isNaN(parseFloat(valorAlvo))) { setErro('Digite o valor alvo.'); return }
    setSalvando(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('goals').insert({
      user_id: user!.id,
      name: nome.trim(),
      target_amount: parseFloat(valorAlvo.replace(',', '.')),
      current_amount: parseFloat(valorAtual.replace(',', '.')) || 0,
      deadline: prazo || null,
      color: cor,
      icon: icone,
    })
    if (error) { setErro('Erro ao salvar.') } else {
      setNome(''); setValorAlvo(''); setValorAtual(''); setPrazo('')
      setCor('#6366f1'); setIcone('🎯')
      setModalAberto(false); carregar()
    }
    setSalvando(false)
  }

  async function fazerAporte(metaId: string) {
    if (!valorAporte || isNaN(parseFloat(valorAporte))) return
    const { data: { user } } = await supabase.auth.getUser()
    const meta = metas.find(m => m.id === metaId)
    if (!meta) return
    const novoValor = Math.min(
      Number(meta.current_amount) + parseFloat(valorAporte.replace(',', '.')),
      Number(meta.target_amount)
    )
    const concluida = novoValor >= Number(meta.target_amount)
    await supabase.from('goals').update({
      current_amount: novoValor,
      is_completed: concluida
    }).eq('id', metaId)
    await supabase.from('goal_contributions').insert({
      goal_id: metaId,
      user_id: user!.id,
      amount: parseFloat(valorAporte.replace(',', '.')),
      date: new Date().toISOString().split('T')[0]
    })
    setValorAporte('')
    setModalAporte(null)
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta meta?')) return
    await supabase.from('goals').delete().eq('id', id)
    carregar()
  }

  function previsao(meta: Meta) {
    if (meta.deadline) {
      const dias = Math.ceil((new Date(meta.deadline).getTime() - Date.now()) / 86400000)
      if (dias < 0) return { texto: 'Prazo encerrado', cor: 'text-red-400' }
      if (dias === 0) return { texto: 'Vence hoje!', cor: 'text-yellow-400' }
      return { texto: `${dias} dias restantes`, cor: 'text-gray-400' }
    }
    return null
  }

  const metasAtivas = metas.filter(m => !m.is_completed)
  const metasConcluidas = metas.filter(m => m.is_completed)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Metas Financeiras</h1>
          <p className="text-gray-400 text-sm mt-1">Defina objetivos e acompanhe seu progresso</p>
        </div>
        <button
          onClick={() => setModalAberto(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          + Nova meta
        </button>
      </div>

      {/* Resumo */}
      {metas.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-sm">Total de metas</p>
            <p className="text-2xl font-bold text-white mt-1">{metas.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-sm">Em andamento</p>
            <p className="text-2xl font-bold text-indigo-400 mt-1">{metasAtivas.length}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-gray-400 text-sm">Concluídas</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{metasConcluidas.length}</p>
          </div>
        </div>
      )}

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : metas.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="text-white font-semibold mb-2">Nenhuma meta ainda</h3>
          <p className="text-gray-400 text-sm mb-6">Crie metas para guardar dinheiro para o que importa.</p>
          <button onClick={() => setModalAberto(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Criar primeira meta
          </button>
        </div>
      ) : (
        <>
          {/* Metas ativas */}
          {metasAtivas.length > 0 && (
            <div>
              <h2 className="text-gray-300 font-semibold mb-3">Em andamento</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metasAtivas.map((meta) => {
                  const percentual = Math.min((Number(meta.current_amount) / Number(meta.target_amount)) * 100, 100)
                  const falta = Number(meta.target_amount) - Number(meta.current_amount)
                  const prev = previsao(meta)

                  return (
                    <div key={meta.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 group hover:border-gray-700 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                            style={{ backgroundColor: meta.color + '25', border: `1px solid ${meta.color}40` }}>
                            {meta.icon}
                          </div>
                          <div>
                            <p className="text-white font-semibold">{meta.name}</p>
                            {prev && <p className={`text-xs ${prev.cor}`}>{prev.texto}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => excluir(meta.id)}
                          className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm"
                        >✕</button>
                      </div>

                      {/* Barra de progresso */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                          <span>{fmt(Number(meta.current_amount))} guardados</span>
                          <span className="font-medium" style={{ color: meta.color }}>{percentual.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-3">
                          <div
                            className="h-3 rounded-full transition-all"
                            style={{ width: `${percentual}%`, backgroundColor: meta.color }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Falta {fmt(falta)}</span>
                          <span>Meta: {fmt(Number(meta.target_amount))}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setModalAporte(meta.id)}
                        className="w-full mt-2 py-2 rounded-xl text-sm font-medium transition-colors border"
                        style={{ borderColor: meta.color + '50', color: meta.color, backgroundColor: meta.color + '10' }}
                      >
                        + Adicionar valor
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Metas concluídas */}
          {metasConcluidas.length > 0 && (
            <div>
              <h2 className="text-gray-300 font-semibold mb-3">Concluídas 🎉</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metasConcluidas.map((meta) => (
                  <div key={meta.id} className="bg-gray-900 border border-green-900/50 rounded-2xl p-5 opacity-80 group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-green-900/30 border border-green-800/50">
                          {meta.icon}
                        </div>
                        <div>
                          <p className="text-white font-semibold">{meta.name}</p>
                          <p className="text-green-400 text-xs">✓ Concluída · {fmt(Number(meta.target_amount))}</p>
                        </div>
                      </div>
                      <button onClick={() => excluir(meta.id)} className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal nova meta */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Nova meta</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome da meta</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Viagem para Europa, iPhone novo..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Valor alvo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" value={valorAlvo} onChange={(e) => setValorAlvo(e.target.value)}
                      placeholder="0,00" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2 font-medium">Já tenho</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input type="number" value={valorAtual} onChange={(e) => setValorAtual(e.target.value)}
                      placeholder="0,00" className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Prazo (opcional)</label>
                <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Ícone</label>
                <div className="grid grid-cols-6 gap-2">
                  {icones.map((i) => (
                    <button key={i} onClick={() => setIcone(i)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${icone === i ? 'bg-indigo-600 scale-110' : 'bg-gray-800 hover:bg-gray-700'}`}>
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {['#6366f1','#22c55e','#3b82f6','#f59e0b','#ec4899','#ef4444','#14b8a6','#8b5cf6'].map((c) => (
                    <button key={c} onClick={() => setCor(c)}
                      className={`w-8 h-8 rounded-full transition-transform ${cor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
            </div>
            {erro && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalAberto(false); setErro('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                {salvando ? 'Salvando...' : 'Criar meta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal aporte */}
      {modalAporte && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Adicionar valor</h2>
              <button onClick={() => { setModalAporte(null); setValorAporte('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Meta: <span className="text-white font-medium">{metas.find(m => m.id === modalAporte)?.name}</span>
            </p>
            <div className="relative mb-6">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
              <input type="number" value={valorAporte} onChange={(e) => setValorAporte(e.target.value)}
                placeholder="0,00" step="0.01"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setModalAporte(null); setValorAporte('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={() => fazerAporte(modalAporte)} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-sm font-medium transition-colors">Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}