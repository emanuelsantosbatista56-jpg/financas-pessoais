'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const tipoLabels: Record<string, string> = {
  real_estate: 'Imóvel', vehicle: 'Veículo', investment: 'Investimento', other: 'Outro'
}
const tipoIcons: Record<string, string> = {
  real_estate: '🏠', vehicle: '🚗', investment: '📈', other: '📦'
}

interface Ativo { id: string; name: string; type: string; value: number; acquisition_date: string | null; notes: string | null }
interface Divida { remaining_amount: number }

export default function PatrimonioPage() {
  const supabase = createClient()
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [dividas, setDividas] = useState<Divida[]>([])
  const [contas, setContas] = useState<{ balance: number }[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('real_estate')
  const [valor, setValor] = useState('')
  const [dataAquisicao, setDataAquisicao] = useState('')
  const [notas, setNotas] = useState('')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: at }, { data: dv }, { data: ct }] = await Promise.all([
      supabase.from('assets').select('*').eq('user_id', user!.id).order('value', { ascending: false }),
      supabase.from('debts').select('remaining_amount').eq('user_id', user!.id).eq('is_active', true),
      supabase.from('accounts').select('balance').eq('user_id', user!.id).eq('is_active', true),
    ])
    setAtivos(at ?? [])
    setDividas(dv ?? [])
    setContas(ct ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function salvar() {
    if (!nome.trim()) { setErro('Digite o nome do ativo.'); return }
    if (!valor || isNaN(parseFloat(valor))) { setErro('Digite o valor.'); return }
    setSalvando(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('assets').insert({
      user_id: user!.id, name: nome.trim(), type: tipo,
      value: parseFloat(valor.replace(',', '.')),
      acquisition_date: dataAquisicao || null,
      notes: notas || null,
    })
    if (error) { setErro('Erro ao salvar.') } else {
      setNome(''); setValor(''); setDataAquisicao(''); setNotas(''); setTipo('real_estate')
      setModalAberto(false); carregar()
    }
    setSalvando(false)
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este ativo?')) return
    await supabase.from('assets').delete().eq('id', id)
    carregar()
  }

  const totalAtivos = ativos.reduce((a, at) => a + Number(at.value), 0)
  const totalContas = contas.reduce((a, c) => a + Number(c.balance), 0)
  const totalPassivos = dividas.reduce((a, d) => a + Number(d.remaining_amount), 0)
  const patrimonioLiquido = totalAtivos + totalContas - totalPassivos

  const agrupadoPorTipo = ativos.reduce((acc, at) => {
    if (!acc[at.type]) acc[at.type] = []
    acc[at.type].push(at)
    return acc
  }, {} as Record<string, Ativo[]>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Patrimônio Líquido</h1>
          <p className="text-gray-400 text-sm mt-1">Visão completa dos seus ativos e passivos</p>
        </div>
        <button onClick={() => setModalAberto(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
          + Novo ativo
        </button>
      </div>

      {/* Cards patrimônio */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-gradient-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6">
          <p className="text-indigo-200 text-sm font-medium">Patrimônio líquido</p>
          <p className={`text-4xl font-bold mt-1 ${patrimonioLiquido >= 0 ? 'text-white' : 'text-red-300'}`}>
            {fmt(patrimonioLiquido)}
          </p>
          <p className="text-indigo-300 text-xs mt-2">Ativos − Passivos</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Total de ativos</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{fmt(totalAtivos + totalContas)}</p>
          <p className="text-gray-600 text-xs mt-1">Bens + saldo em contas</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <p className="text-gray-400 text-sm">Total de passivos</p>
          <p className="text-2xl font-bold text-red-400 mt-1">{fmt(totalPassivos)}</p>
          <p className="text-gray-600 text-xs mt-1">Dívidas em aberto</p>
        </div>
      </div>

      {/* Composição */}
      {(totalAtivos + totalContas) > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Composição dos ativos</h3>
          <div className="flex h-4 rounded-full overflow-hidden mb-3">
            {totalContas > 0 && (
              <div className="bg-indigo-500 transition-all" title="Contas"
                style={{ width: `${((totalContas) / (totalAtivos + totalContas)) * 100}%` }} />
            )}
            {Object.entries(agrupadoPorTipo).map(([tipo, items]) => {
              const total = items.reduce((a, i) => a + Number(i.value), 0)
              const cores: Record<string, string> = { real_estate: '#22c55e', vehicle: '#3b82f6', investment: '#f59e0b', other: '#8b5cf6' }
              return (
                <div key={tipo} className="transition-all" style={{ width: `${(total / (totalAtivos + totalContas)) * 100}%`, backgroundColor: cores[tipo] }} />
              )
            })}
          </div>
          <div className="flex gap-4 flex-wrap text-xs text-gray-400">
            {totalContas > 0 && <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-indigo-500" /><span>Contas ({fmt(totalContas)})</span></div>}
            {Object.entries(agrupadoPorTipo).map(([tipo, items]) => {
              const total = items.reduce((a, i) => a + Number(i.value), 0)
              const cores: Record<string, string> = { real_estate: '#22c55e', vehicle: '#3b82f6', investment: '#f59e0b', other: '#8b5cf6' }
              return <div key={tipo} className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: cores[tipo] }} /><span>{tipoLabels[tipo]} ({fmt(total)})</span></div>
            })}
          </div>
        </div>
      )}

      {carregando ? (
        <div className="text-center py-12 text-gray-500">Carregando...</div>
      ) : ativos.length === 0 ? (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🏛️</div>
          <h3 className="text-white font-semibold mb-2">Nenhum ativo registrado</h3>
          <p className="text-gray-400 text-sm mb-6">Registre imóveis, veículos e investimentos para calcular seu patrimônio real.</p>
          <button onClick={() => setModalAberto(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
            Adicionar ativo
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(agrupadoPorTipo).map(([tipo, items]) => (
            <div key={tipo} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-800 flex items-center gap-2">
                <span className="text-xl">{tipoIcons[tipo]}</span>
                <span className="text-gray-300 font-medium">{tipoLabels[tipo]}</span>
                <span className="ml-auto text-white font-bold">
                  {fmt(items.reduce((a, i) => a + Number(i.value), 0))}
                </span>
              </div>
              {items.map((ativo) => (
                <div key={ativo.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-800/50 transition-colors group border-b border-gray-800/50 last:border-0">
                  <div>
                    <p className="text-white font-medium">{ativo.name}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      {ativo.acquisition_date && <span>Adquirido em {new Date(ativo.acquisition_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                      {ativo.notes && <span>· {ativo.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-green-400 font-bold">{fmt(Number(ativo.value))}</p>
                    <button onClick={() => excluir(ativo.id)}
                      className="text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-sm">✕</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">Novo ativo</h2>
              <button onClick={() => { setModalAberto(false); setErro('') }} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Nome do ativo</label>
                <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Apartamento, Carro, Tesouro Direto..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(tipoLabels).map(([t, label]) => (
                    <button key={t} onClick={() => setTipo(t)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 justify-center ${tipo === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
                      {tipoIcons[t]} {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Valor atual</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                  <input type="number" value={valor} onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00" step="0.01"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Data de aquisição (opcional)</label>
                <input type="date" value={dataAquisicao} onChange={(e) => setDataAquisicao(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2 font-medium">Observações (opcional)</label>
                <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
                  placeholder="Ex: Financiado, valorizado..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
            </div>
            {erro && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setModalAberto(false); setErro('') }} className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white py-3 rounded-xl text-sm font-medium transition-colors">
                {salvando ? 'Salvando...' : 'Salvar ativo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}