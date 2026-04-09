import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString()

  const [
    { data: transacoes },
    { data: contas },
    { data: orcamentos },
    { data: metas },
    { data: ultimasTransacoes },
  ] = await Promise.all([
    supabase.from('transactions').select('*')
      .eq('user_id', user!.id).gte('date', inicioMes).lte('date', fimMes),
    supabase.from('accounts').select('balance').eq('user_id', user!.id).eq('is_active', true),
    supabase.from('budgets').select('*, categories(name, color, icon)')
      .eq('user_id', user!.id),
    supabase.from('goals').select('*').eq('user_id', user!.id).eq('is_completed', false).limit(3),
    supabase.from('transactions').select('*, categories(name, color, icon), accounts(name)')
      .eq('user_id', user!.id).order('date', { ascending: false }).limit(5),
  ])

  const totalReceitas = transacoes?.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0) ?? 0
  const totalDespesas = transacoes?.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0) ?? 0
  const saldoTotal = contas?.reduce((a, c) => a + Number(c.balance), 0) ?? 0
  const balanco = totalReceitas - totalDespesas

  // Gastos por categoria no mês
  const gastosCat: Record<string, number> = {}
  transacoes?.filter(t => t.type === 'expense' && t.category_id).forEach(t => {
    gastosCat[t.category_id] = (gastosCat[t.category_id] ?? 0) + Number(t.amount)
  })

  // Orçamentos com alertas
  const orcamentosAlerta = (orcamentos ?? []).filter(o => {
    const gasto = gastosCat[o.category_id] ?? 0
    return (gasto / Number(o.limit_amount)) * 100 >= o.alert_at_percent
  })

  const mesAtual = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">

      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1 capitalize">Resumo de {mesAtual}</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm font-medium">Saldo total</p>
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">🏦</div>
          </div>
          <p className="text-3xl font-bold text-white">{fmt(saldoTotal)}</p>
          <p className="text-gray-500 text-xs mt-2">Em todas as contas ativas</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm font-medium">Receitas do mês</p>
            <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">📈</div>
          </div>
          <p className="text-3xl font-bold text-green-400">{fmt(totalReceitas)}</p>
          <p className="text-gray-500 text-xs mt-2">{transacoes?.filter(t => t.type === 'income').length ?? 0} transações</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm font-medium">Despesas do mês</p>
            <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">📉</div>
          </div>
          <p className="text-3xl font-bold text-red-400">{fmt(totalDespesas)}</p>
          <p className="text-gray-500 text-xs mt-2">{transacoes?.filter(t => t.type === 'expense').length ?? 0} transações</p>
        </div>
      </div>

      {/* Balanço do mês */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">Balanço do mês</h3>
          <span className={`text-sm font-bold ${balanco >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {balanco >= 0 ? '+' : ''}{fmt(balanco)}
          </span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${balanco >= 0 ? 'bg-indigo-600' : 'bg-red-600'}`}
            style={{ width: totalReceitas > 0 ? `${Math.min((totalDespesas / totalReceitas) * 100, 100)}%` : '0%' }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          <span>0%</span>
          <span>
            {totalReceitas > 0
              ? `${Math.min(Math.round((totalDespesas / totalReceitas) * 100), 100)}% das receitas gastos`
              : 'Nenhuma receita registrada'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Alertas de orçamento */}
        {orcamentosAlerta.length > 0 && (
          <div className="bg-gray-900 border border-yellow-900/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-yellow-400">⚠️</span>
              <h3 className="text-white font-semibold">Alertas de orçamento</h3>
            </div>
            <div className="space-y-3">
              {orcamentosAlerta.map((o: any) => {
                const gasto = gastosCat[o.category_id] ?? 0
                const pct = Math.min((gasto / Number(o.limit_amount)) * 100, 100)
                const estourou = gasto > Number(o.limit_amount)
                return (
                  <div key={o.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-300">
                        {o.categories?.icon} {o.categories?.name}
                      </span>
                      <span className={estourou ? 'text-red-400' : 'text-yellow-400'}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: estourou ? '#ef4444' : '#f59e0b' }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{fmt(gasto)} gastos</span>
                      <span>limite: {fmt(Number(o.limit_amount))}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <Link href="/dashboard/orcamento" className="block text-center text-indigo-400 hover:text-indigo-300 text-sm mt-4 transition-colors">
              Ver orçamentos →
            </Link>
          </div>
        )}

        {/* Metas em andamento */}
        {metas && metas.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Metas em andamento</h3>
              <Link href="/dashboard/metas" className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors">Ver todas →</Link>
            </div>
            <div className="space-y-4">
              {metas.map((meta: any) => {
                const pct = Math.min((Number(meta.current_amount) / Number(meta.target_amount)) * 100, 100)
                return (
                  <div key={meta.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span>{meta.icon}</span>
                        <span className="text-gray-300 text-sm">{meta.name}</span>
                      </div>
                      <span className="text-xs font-medium" style={{ color: meta.color }}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: meta.color }} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                      <span>{fmt(Number(meta.current_amount))}</span>
                      <span>{fmt(Number(meta.target_amount))}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Últimas transações */}
        <div className={`bg-gray-900 border border-gray-800 rounded-2xl p-5 ${orcamentosAlerta.length === 0 && (!metas || metas.length === 0) ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Últimas transações</h3>
            <Link href="/dashboard/transacoes" className="text-indigo-400 hover:text-indigo-300 text-xs transition-colors">Ver todas →</Link>
          </div>
          {!ultimasTransacoes || ultimasTransacoes.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 text-sm">Nenhuma transação ainda</p>
              <Link href="/dashboard/transacoes" className="text-indigo-400 hover:text-indigo-300 text-sm underline mt-2 block">
                Adicionar primeira transação
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {ultimasTransacoes.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${t.type === 'income' ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
                      {t.categories?.icon ?? (t.type === 'income' ? '📈' : '📉')}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{t.description}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-gray-500 text-xs">{new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                        {t.accounts && <p className="text-gray-600 text-xs">· {t.accounts.name}</p>}
                        {t.categories && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: t.categories.color + '25', color: t.categories.color }}>
                            {t.categories.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className={`font-bold text-sm ${t.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                    {t.type === 'income' ? '+' : '-'}{fmt(Number(t.amount))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Acesso rápido */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h3 className="text-white font-semibold mb-4">Acesso rápido</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/dashboard/transacoes', icon: '💸', label: 'Nova transação', cor: 'bg-indigo-600/20 hover:bg-indigo-600/30' },
              { href: '/dashboard/contas', icon: '🏦', label: 'Ver contas', cor: 'bg-blue-600/20 hover:bg-blue-600/30' },
              { href: '/dashboard/metas', icon: '🎯', label: 'Minhas metas', cor: 'bg-green-600/20 hover:bg-green-600/30' },
              { href: '/dashboard/relatorios', icon: '📊', label: 'Relatórios', cor: 'bg-purple-600/20 hover:bg-purple-600/30' },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className={`${item.cor} rounded-xl p-4 flex flex-col items-center gap-2 transition-colors text-center`}>
                <span className="text-2xl">{item.icon}</span>
                <span className="text-gray-300 text-xs font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}