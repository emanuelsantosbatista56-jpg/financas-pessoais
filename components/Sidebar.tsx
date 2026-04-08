'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menu = [
  { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  { href: '/dashboard/transacoes', icon: '💸', label: 'Transações' },
  { href: '/dashboard/categorias', icon: '🏷️', label: 'Categorias' },
  { href: '/dashboard/contas', icon: '🏦', label: 'Contas' },
  { href: '/dashboard/cartoes', icon: '💳', label: 'Cartões' },
  { href: '/dashboard/metas', icon: '🎯', label: 'Metas' },
  { href: '/dashboard/orcamento', icon: '📋', label: 'Orçamento' },
  { href: '/dashboard/dividas', icon: '📉', label: 'Dívidas' },
  { href: '/dashboard/relatorios', icon: '📈', label: 'Relatórios' },
  { href: '/dashboard/patrimonio', icon: '🏛️', label: 'Patrimônio' },
  { href: '/dashboard/assinaturas', icon: '🔄', label: 'Assinaturas' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-lg">
            💰
          </div>
          <div>
            <p className="text-white font-bold text-sm">Finanças</p>
            <p className="text-gray-500 text-xs">Pessoais</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 p-4 space-y-1">
        {menu.map((item) => {
          const ativo = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${ativo
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Rodapé da sidebar */}
      <div className="p-4 border-t border-gray-800">
        <Link
          href="/dashboard/configuracoes"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
        >
          <span className="text-base">⚙️</span>
          Configurações
        </Link>
      </div>
    </aside>
  )
}