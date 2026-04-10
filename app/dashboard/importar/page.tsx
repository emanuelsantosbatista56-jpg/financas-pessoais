'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface TransacaoImportada {
  data: string
  descricao: string
  valor: number
  tipo: 'income' | 'expense'
  selecionada: boolean
}

export default function ImportarPage() {
  const supabase = createClient()
  const [etapa, setEtapa] = useState<'upload' | 'preview' | 'sucesso'>('upload')
  const [transacoes, setTransacoes] = useState<TransacaoImportada[]>([])
  const [contas, setContas] = useState<{ id: string; name: string }[]>([])
  const [contaId, setContaId] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [banco, setBanco] = useState('nubank')
  const [importadas, setImportadas] = useState(0)

  async function carregarContas() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('accounts').select('id, name')
      .eq('user_id', user!.id).eq('is_active', true)
    setContas(data ?? [])
    if (data && data.length > 0) setContaId(data[0].id)
  }

  function processarCSV(texto: string, bancoParsed: string): TransacaoImportada[] {
    const linhas = texto.split('\n').filter(l => l.trim())
    const resultado: TransacaoImportada[] = []

    if (bancoParsed === 'nubank') {
      // Formato Nubank: Data,Categoria,Título,Valor
      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(',')
        if (cols.length < 4) continue
        const dataRaw = cols[0]?.trim()
        const descricao = cols[2]?.trim() || cols[1]?.trim()
        const valorRaw = cols[cols.length - 1]?.trim().replace('"', '').replace('"', '')
        const valor = parseFloat(valorRaw?.replace(',', '.') ?? '0')
        if (!dataRaw || isNaN(valor)) continue

        // Data no formato YYYY-MM-DD ou DD/MM/YYYY
        let data = dataRaw
        if (dataRaw.includes('/')) {
          const [d, m, a] = dataRaw.split('/')
          data = `${a}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
        }

        resultado.push({
          data,
          descricao: descricao || 'Sem descrição',
          valor: Math.abs(valor),
          tipo: valor < 0 ? 'expense' : 'income',
          selecionada: true,
        })
      }
    } else if (bancoParsed === 'inter') {
      // Formato Inter: Data;Tipo;Descrição;Valor
      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(';')
        if (cols.length < 4) continue
        const dataRaw = cols[0]?.trim()
        const descricao = cols[2]?.trim()
        const valorRaw = cols[3]?.trim().replace('R$', '').trim()
        const valor = parseFloat(valorRaw?.replace('.', '').replace(',', '.') ?? '0')
        if (!dataRaw || isNaN(valor)) continue

        let data = dataRaw
        if (dataRaw.includes('/')) {
          const [d, m, a] = dataRaw.split('/')
          data = `${a}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
        }

        resultado.push({
          data,
          descricao: descricao || 'Sem descrição',
          valor: Math.abs(valor),
          tipo: valor < 0 ? 'expense' : 'income',
          selecionada: true,
        })
      }
    } else {
      // Formato genérico: tenta detectar automaticamente
      const separador = linhas[0].includes(';') ? ';' : ','
      for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(separador)
        if (cols.length < 3) continue
        const dataRaw = cols[0]?.trim()
        const descricao = cols[1]?.trim()
        const valorRaw = cols[cols.length - 1]?.trim()
        const valor = parseFloat(valorRaw?.replace(/[R$\s.]/g, '').replace(',', '.') ?? '0')
        if (!dataRaw || isNaN(valor)) continue

        let data = dataRaw
        if (dataRaw.includes('/')) {
          const partes = dataRaw.split('/')
          if (partes.length === 3) {
            data = partes[0].length === 4
              ? `${partes[0]}-${partes[1]?.padStart(2,'0')}-${partes[2]?.padStart(2,'0')}`
              : `${partes[2]}-${partes[1]?.padStart(2,'0')}-${partes[0]?.padStart(2,'0')}`
          }
        }

        resultado.push({
          data,
          descricao: descricao || 'Sem descrição',
          valor: Math.abs(valor),
          tipo: valor < 0 ? 'expense' : 'income',
          selecionada: true,
        })
      }
    }

    return resultado.slice(0, 200) // limite de 200 transações
  }

  async function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setErro('')

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setErro('Por favor, selecione um arquivo CSV ou TXT.')
      return
    }

    setCarregando(true)
    await carregarContas()

    const reader = new FileReader()
    reader.onload = (ev) => {
      const texto = ev.target?.result as string
      const resultado = processarCSV(texto, banco)
      if (resultado.length === 0) {
        setErro('Nenhuma transação encontrada. Verifique o formato do arquivo.')
        setCarregando(false)
        return
      }
      setTransacoes(resultado)
      setEtapa('preview')
      setCarregando(false)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function toggleTransacao(index: number) {
    setTransacoes(prev => prev.map((t, i) => i === index ? { ...t, selecionada: !t.selecionada } : t))
  }

  function toggleTipo(index: number) {
    setTransacoes(prev => prev.map((t, i) => i === index
      ? { ...t, tipo: t.tipo === 'income' ? 'expense' : 'income' }
      : t
    ))
  }

  function selecionarTodas(selecionar: boolean) {
    setTransacoes(prev => prev.map(t => ({ ...t, selecionada: selecionar })))
  }

  async function importar() {
    const selecionadas = transacoes.filter(t => t.selecionada)
    if (selecionadas.length === 0) { setErro('Selecione pelo menos uma transação.'); return }
    if (!contaId) { setErro('Selecione uma conta.'); return }

    setCarregando(true); setErro('')
    const { data: { user } } = await supabase.auth.getUser()

    const registros = selecionadas.map(t => ({
      user_id: user!.id,
      account_id: contaId,
      type: t.tipo,
      amount: t.valor,
      description: t.descricao,
      date: t.data,
      is_paid: true,
    }))

    const { error } = await supabase.from('transactions').insert(registros)

    if (error) {
      setErro('Erro ao importar. Tente novamente.')
      setCarregando(false)
      return
    }

    setImportadas(selecionadas.length)
    setEtapa('sucesso')
    setCarregando(false)
  }

  const selecionadas = transacoes.filter(t => t.selecionada)
  const totalReceitas = selecionadas.filter(t => t.tipo === 'income').reduce((a, t) => a + t.valor, 0)
  const totalDespesas = selecionadas.filter(t => t.tipo === 'expense').reduce((a, t) => a + t.valor, 0)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Importar Extrato</h1>
        <p className="text-gray-400 text-sm mt-1">Importe transações do seu banco via arquivo CSV</p>
      </div>

      {/* Etapas */}
      <div className="flex items-center gap-2">
        {['Upload', 'Revisão', 'Concluído'].map((label, i) => {
          const etapaNum = i === 0 ? 'upload' : i === 1 ? 'preview' : 'sucesso'
          const ativo = etapa === etapaNum
          const concluido = (etapa === 'preview' && i === 0) || (etapa === 'sucesso' && i <= 1)
          return (
            <div key={label} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                ativo ? 'bg-indigo-600 text-white' :
                concluido ? 'bg-green-600 text-white' :
                'bg-gray-800 text-gray-500'
              }`}>
                {concluido ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${ativo ? 'text-white' : 'text-gray-500'}`}>{label}</span>
              {i < 2 && <div className="w-8 h-px bg-gray-700 mx-1" />}
            </div>
          )
        })}
      </div>

      {/* Etapa 1: Upload */}
      {etapa === 'upload' && (
        <div className="space-y-5">
          {/* Seleção de banco */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Selecione seu banco</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'nubank', nome: 'Nubank', emoji: '💜' },
                { id: 'inter', nome: 'Inter', emoji: '🟠' },
                { id: 'itau', nome: 'Itaú', emoji: '🏦' },
                { id: 'generico', nome: 'Outro banco', emoji: '🏛️' },
              ].map((b) => (
                <button key={b.id} onClick={() => setBanco(b.id)}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    banco === b.id
                      ? 'border-indigo-500 bg-indigo-600/20 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                  }`}>
                  <div className="text-3xl mb-2">{b.emoji}</div>
                  <p className="text-sm font-medium">{b.nome}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Upload */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-4">Selecione o arquivo CSV</h3>
            <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-700 rounded-xl cursor-pointer hover:border-indigo-500 hover:bg-indigo-600/5 transition-all">
              <div className="text-4xl mb-3">📂</div>
              <p className="text-gray-300 font-medium">Clique para selecionar o arquivo</p>
              <p className="text-gray-500 text-sm mt-1">CSV ou TXT · máximo 200 transações</p>
              <input type="file" accept=".csv,.txt" onChange={handleArquivo} className="hidden" />
            </label>

            {carregando && (
              <div className="text-center mt-4 text-indigo-400 text-sm">Processando arquivo...</div>
            )}
            {erro && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>
            )}
          </div>

          {/* Instruções */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <h3 className="text-white font-semibold mb-3">Como exportar o extrato do Nubank</h3>
            <ol className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">1.</span> Abra o app do Nubank</li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">2.</span> Vá em "Minha conta" → "Extrato"</li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">3.</span> Toque no ícone de compartilhar (canto superior direito)</li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">4.</span> Selecione "Exportar como CSV"</li>
              <li className="flex gap-2"><span className="text-indigo-400 font-bold">5.</span> Salve o arquivo e faça o upload aqui</li>
            </ol>
          </div>
        </div>
      )}

      {/* Etapa 2: Preview */}
      {etapa === 'preview' && (
        <div className="space-y-5">
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-gray-400 text-sm">Transações selecionadas</p>
              <p className="text-2xl font-bold text-white mt-1">{selecionadas.length} <span className="text-gray-500 text-sm font-normal">de {transacoes.length}</span></p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-gray-400 text-sm">Receitas</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{fmt(totalReceitas)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-gray-400 text-sm">Despesas</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{fmt(totalDespesas)}</p>
            </div>
          </div>

          {/* Conta destino */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <label className="block text-sm text-gray-300 mb-2 font-medium">Importar para a conta</label>
            <select value={contaId} onChange={(e) => setContaId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors">
              {contas.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Lista de transações */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
              <p className="text-white font-semibold">{transacoes.length} transações encontradas</p>
              <div className="flex gap-2">
                <button onClick={() => selecionarTodas(true)} className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors">Selecionar todas</button>
                <span className="text-gray-600">·</span>
                <button onClick={() => selecionarTodas(false)} className="text-gray-400 hover:text-white text-xs transition-colors">Desmarcar todas</button>
              </div>
            </div>

            <div className="divide-y divide-gray-800 max-h-96 overflow-y-auto">
              {transacoes.map((t, i) => (
                <div key={i} className={`flex items-center gap-3 px-5 py-3 transition-colors ${t.selecionada ? '' : 'opacity-40'}`}>
                  <input type="checkbox" checked={t.selecionada} onChange={() => toggleTransacao(i)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{t.descricao}</p>
                    <p className="text-gray-500 text-xs">{new Date(t.data + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                  </div>
                  <button onClick={() => toggleTipo(i)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      t.tipo === 'income' ? 'bg-green-900/30 text-green-400 hover:bg-red-900/30 hover:text-red-400' : 'bg-red-900/30 text-red-400 hover:bg-green-900/30 hover:text-green-400'
                    }`}>
                    {t.tipo === 'income' ? '📈 Receita' : '📉 Despesa'}
                  </button>
                  <p className={`font-bold text-sm min-w-[90px] text-right ${t.tipo === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.tipo === 'income' ? '+' : '-'}{fmt(t.valor)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {erro && <div className="p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}

          <div className="flex gap-3">
            <button onClick={() => { setEtapa('upload'); setTransacoes([]) }}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl text-sm font-medium transition-colors">
              Voltar
            </button>
            <button onClick={importar} disabled={carregando || selecionadas.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-medium transition-colors">
              {carregando ? 'Importando...' : `Importar ${selecionadas.length} transações`}
            </button>
          </div>
        </div>
      )}

      {/* Etapa 3: Sucesso */}
      {etapa === 'sucesso' && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-white mb-2">Importação concluída!</h2>
          <p className="text-gray-400 mb-8">
            <span className="text-green-400 font-bold">{importadas} transações</span> foram importadas com sucesso.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setEtapa('upload'); setTransacoes([]) }}
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
              Importar mais
            </button>
            <a href="/dashboard/transacoes"
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
              Ver transações
            </a>
          </div>
        </div>
      )}
    </div>
  )
}