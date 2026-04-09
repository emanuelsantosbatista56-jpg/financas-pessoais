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
    { data: metas },
    { data: ultimasTransacoes },
  ] = await Promise.all([
    supabase.from('transactions').select('*')
      .eq('user_id', user!.id).gte('date', inicioMes).lte('date', fimMes),
    supabase.from('accounts').select('balance').eq('user_id', user!.id).eq('is_active', true),
    supabase.from('goals').select('*').eq('user_id', user!.id).eq('is_completed', false).limit(3),
    supabase.from('transactions')
      .select('*, categories(name, color, icon), accounts(name)')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .limit(5),
  ])

  const totalReceitas = transacoes?.filter(t => t.type === 'income').reduce((a, t) => a + Number(t.amount), 0) ?? 0
  const totalDespesas = transacoes?.filter(t => t.type === 'expense').reduce((a, t) => a + Number(t.amount), 0) ?? 0
  const saldoTotal = contas?.reduce((a, c) => a + Number(c.balance), 0) ?? 0
  const balanco = totalReceitas - totalDespesas
  const mesAtual = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">

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

      {/* Balanço */}
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
          <span>{totalReceitas > 0 ? `${Math.min(Math.round((totalDespesas / totalReceitas) * 100), 100)}% das receitas gastos` : 'Nenhuma receita registrada'}</span>
        </div>
      </div>

      {/* Linha 2: Últimas transações + Metas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Últimas transações */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Últimas transações</h3>
            <Link href="/dashboard/transacoes" className="text-indigo-400 hover:text-indigo-300 text-xs">Ver todas →</Link>
          </div>
          {!ultimasTransacoes || ultimasTransacoes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-3">Nenhuma transação ainda</p>
              <Link href="/dashboard/transacoes" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                Adicionar transação
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {ultimasTransacoes.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${t.type === 'income' ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
                      {t.categories?.icon ?? (t.type === 'income' ? '📈' : '📉')}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{t.description}</p>
                      <p className="text-gray-500 text-xs">
                        {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        {t.accounts && ` · ${t.accounts.name}`}
                      </p>
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

        {/* Metas */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Metas em andamento</h3>
            <Link href="/dashboard/metas" className="text-indigo-400 hover:text-indigo-300 text-xs">Ver todas →</Link>
          </div>
          {!metas || metas.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-sm mb-3">Nenhuma meta criada</p>
              <Link href="/dashboard/metas" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm transition-colors">
                Criar meta
              </Link>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      {/* Acesso rápido */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-4">Acesso rápido</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/dashboard/transacoes', icon: '💸', label: 'Nova transação', bg: 'bg-indigo-600/20 hover:bg-indigo-600/30' },
            { href: '/dashboard/contas',     icon: '🏦', label: 'Ver contas',      bg: 'bg-blue-600/20 hover:bg-blue-600/30' },
            { href: '/dashboard/metas',      icon: '🎯', label: 'Minhas metas',    bg: 'bg-green-600/20 hover:bg-green-600/30' },
            { href: '/dashboard/relatorios', icon: '📊', label: 'Relatórios',      bg: 'bg-purple-600/20 hover:bg-purple-600/30' },
          ].map((item) => (
            <Link key={item.href} href={item.href}
              className={`${item.bg} rounded-xl p-4 flex flex-col items-center gap-2 transition-colors text-center`}>
              <span className="text-2xl">{item.icon}</span>
              <span className="text-gray-300 text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

    </div>
  )
}