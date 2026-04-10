'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

interface HeaderProps {
  user: { email?: string }
  profile: { name?: string } | null
}

interface Notificacao {
  id: string
  tipo: 'alerta' | 'info' | 'sucesso'
  titulo: string
  descricao: string
  icone: string
}

export default function Header({ user, profile }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [painelAberto, setPainelAberto] = useState(false)
  const [lidas, setLidas] = useState<string[]>([])

  const nomeExibido = profile?.name || user.email?.split('@')[0] || 'Usuário'

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  async function carregarNotificacoes() {
    const { data: { user: u } } = await supabase.auth.getUser()
    if (!u) return

    const novas: Notificacao[] = []

    const inicioMes = new Date()
    inicioMes.setDate(1)
    const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0)

    // Verifica orçamentos
    const { data: orcamentos } = await supabase
      .from('budgets')
      .select('*, categories(name, icon)')
      .eq('user_id', u.id)

    const { data: transacoes } = await supabase
      .from('transactions')
      .select('category_id, amount, type')
      .eq('user_id', u.id)
      .gte('date', inicioMes.toISOString())
      .lte('date', fimMes.toISOString())
      .eq('type', 'expense')

    const gastosCat: Record<string, number> = {}
    transacoes?.forEach(t => {
      if (t.category_id) gastosCat[t.category_id] = (gastosCat[t.category_id] ?? 0) + Number(t.amount)
    })

    orcamentos?.forEach(o => {
      const gasto = gastosCat[o.category_id] ?? 0
      const pct = (gasto / Number(o.limit_amount)) * 100
      if (pct >= 100) {
        novas.push({
          id: `orc-estourou-${o.id}`,
          tipo: 'alerta',
          titulo: `Limite excedido: ${o.categories?.name}`,
          descricao: `Você gastou mais do que o limite definido para esta categoria.`,
          icone: '🚨'
        })
      } else if (pct >= o.alert_at_percent) {
        novas.push({
          id: `orc-alerta-${o.id}`,
          tipo: 'alerta',
          titulo: `Orçamento no limite: ${o.categories?.name}`,
          descricao: `${pct.toFixed(0)}% do limite mensal atingido.`,
          icone: '⚠️'
        })
      }
    })

    // Verifica assinaturas próximas (7 dias)
    const { data: assinaturas } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', u.id)
      .eq('is_active', true)

    assinaturas?.forEach(a => {
      if (!a.next_billing) return
      const dias = Math.ceil((new Date(a.next_billing).getTime() - Date.now()) / 86400000)
      if (dias >= 0 && dias <= 7) {
        novas.push({
          id: `assin-${a.id}`,
          tipo: dias <= 2 ? 'alerta' : 'info',
          titulo: `Cobrança em ${dias === 0 ? 'hoje' : `${dias} dia${dias !== 1 ? 's' : ''}`}`,
          descricao: `${a.name} — R$ ${Number(a.amount).toFixed(2).replace('.', ',')}`,
          icone: '💳'
        })
      }
    })

    // Verifica metas próximas do prazo
    const { data: metas } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', u.id)
      .eq('is_completed', false)

    metas?.forEach(m => {
      if (!m.deadline) return
      const dias = Math.ceil((new Date(m.deadline).getTime() - Date.now()) / 86400000)
      if (dias >= 0 && dias <= 30) {
        const pct = Math.min((Number(m.current_amount) / Number(m.target_amount)) * 100, 100)
        novas.push({
          id: `meta-${m.id}`,
          tipo: dias <= 7 ? 'alerta' : 'info',
          titulo: `Meta expirando: ${m.name}`,
          descricao: `${pct.toFixed(0)}% concluída · ${dias} dia${dias !== 1 ? 's' : ''} restante${dias !== 1 ? 's' : ''}`,
          icone: '🎯'
        })
      }
    })

    // Dívidas com parcelas próximas
    const { data: dividas } = await supabase
      .from('debts')
      .select('*')
      .eq('user_id', u.id)
      .eq('is_active', true)

    if (dividas && dividas.length > 0) {
      novas.push({
        id: 'dividas-ativas',
        tipo: 'info',
        titulo: `${dividas.length} dívida${dividas.length !== 1 ? 's' : ''} em aberto`,
        descricao: `Total: R$ ${dividas.reduce((a: number, d: any) => a + Number(d.remaining_amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        icone: '📉'
      })
    }

    setNotificacoes(novas)
  }

  useEffect(() => {
    carregarNotificacoes()
    const salvas = localStorage.getItem('notif_lidas')
    if (salvas) setLidas(JSON.parse(salvas))
  }, [])

  function marcarLidas() {
    const ids = notificacoes.map(n => n.id)
    setLidas(ids)
    localStorage.setItem('notif_lidas', JSON.stringify(ids))
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const naoLidas = notificacoes.filter(n => !lidas.includes(n.id))

  const corTipo = {
    alerta: 'text-red-400 bg-red-900/20 border-red-800/50',
    info: 'text-blue-400 bg-blue-900/20 border-blue-800/50',
    sucesso: 'text-green-400 bg-green-900/20 border-green-800/50',
  }

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 lg:px-6 py-4 flex items-center justify-between relative z-30">
      <div className="pl-12 lg:pl-0">
        <p className="text-gray-400 text-sm capitalize">{hoje}</p>
        <h2 className="text-white font-semibold">Olá, {nomeExibido} 👋</h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Botão de notificações */}
        <div className="relative">
          <button
            onClick={() => { setPainelAberto(!painelAberto); if (!painelAberto) marcarLidas() }}
            className="relative w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center transition-colors"
          >
            <span className="text-lg">🔔</span>
            {naoLidas.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold">
                {naoLidas.length > 9 ? '9+' : naoLidas.length}
              </span>
            )}
          </button>

          {/* Painel de notificações */}
          {painelAberto && (
            <div className="absolute right-0 top-12 w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <p className="text-white font-semibold text-sm">Notificações</p>
                <button onClick={() => setPainelAberto(false)} className="text-gray-500 hover:text-white text-lg">✕</button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {notificacoes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-3xl mb-2">✅</p>
                    <p className="text-gray-500 text-sm">Tudo em ordem!</p>
                    <p className="text-gray-600 text-xs mt-1">Nenhuma notificação pendente</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {notificacoes.map((n) => (
                      <div key={n.id} className={`flex gap-3 p-3 rounded-xl border ${corTipo[n.tipo]}`}>
                        <span className="text-xl flex-shrink-0">{n.icone}</span>
                        <div>
                          <p className="font-medium text-sm text-white">{n.titulo}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{n.descricao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {notificacoes.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-800">
                  <p className="text-gray-600 text-xs text-center">
                    {notificacoes.length} notificaç{notificacoes.length !== 1 ? 'ões' : 'ão'} encontrada{notificacoes.length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {nomeExibido[0].toUpperCase()}
        </div>

        <button
          onClick={sair}
          className="text-gray-400 hover:text-white text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
        >
          Sair
        </button>
      </div>
    </header>
  )
}