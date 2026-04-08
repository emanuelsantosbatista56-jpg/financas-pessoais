import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Busca transações do mês atual
  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString()
  const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString()

  const { data: transacoes } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user!.id)
    .gte('date', inicioMes)
    .lte('date', fimMes)

  // Busca saldo total das contas
  const { data: contas } = await supabase
    .from('accounts')
    .select('balance')
    .eq('user_id', user!.id)
    .eq('is_active', true)

  const totalReceitas = transacoes
    ?.filter(t => t.type === 'income')
    .reduce((acc, t) => acc + Number(t.amount), 0) ?? 0

  const totalDespesas = transacoes
    ?.filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + Number(t.amount), 0) ?? 0

  const saldoTotal = contas
    ?.reduce((acc, c) => acc + Number(c.balance), 0) ?? 0

  const formatarMoeda = (valor: number) =>
    valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

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

        {/* Saldo total */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm font-medium">Saldo total</p>
            <div className="w-10 h-10 bg-indigo-600/20 rounded-xl flex items-center justify-center">
              <span>🏦</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{formatarMoeda(saldoTotal)}</p>
          <p className="text-gray-500 text-xs mt-2">Em todas as contas ativas</p>
        </div>

        {/* Receitas do mês */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm font-medium">Receitas do mês</p>
            <div className="w-10 h-10 bg-green-600/20 rounded-xl flex items-center justify-center">
              <span>📈</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-green-400">{formatarMoeda(totalReceitas)}</p>
          <p className="text-gray-500 text-xs mt-2">
            {transacoes?.filter(t => t.type === 'income').length ?? 0} transações
          </p>
        </div>

        {/* Despesas do mês */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-400 text-sm font-medium">Despesas do mês</p>
            <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
              <span>📉</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-red-400">{formatarMoeda(totalDespesas)}</p>
          <p className="text-gray-500 text-xs mt-2">
            {transacoes?.filter(t => t.type === 'expense').length ?? 0} transações
          </p>
        </div>

      </div>

      {/* Balanço do mês */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">Balanço do mês</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-gray-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all"
              style={{
                width: totalReceitas > 0
                  ? `${Math.min((totalDespesas / totalReceitas) * 100, 100)}%`
                  : '0%'
              }}
            />
          </div>
          <span className={`text-sm font-bold ${totalReceitas - totalDespesas >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatarMoeda(totalReceitas - totalDespesas)}
          </span>
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

      {/* Estado vazio — primeiros passos */}
      {(!transacoes || transacoes.length === 0) && (
        <div className="bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-12 text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h3 className="text-white font-semibold text-lg mb-2">Tudo pronto para começar!</h3>
          <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
            Adicione suas contas bancárias e comece a registrar suas transações para ver os gráficos e relatórios aqui.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <a href="/dashboard/contas" className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Adicionar conta
            </a>
            <a href="/dashboard/transacoes" className="bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
              Registrar transação
            </a>
          </div>
        </div>
      )}

    </div>
  )
}