'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const menu = [
  { href: '/dashboard',             icon: '📊', label: 'Dashboard'     },
  { href: '/dashboard/ia', icon: '🤖', label: 'IA Financeira' },
  { href: '/dashboard/transacoes',  icon: '💸', label: 'Transações'    },
  { href: '/dashboard/categorias',  icon: '🏷️', label: 'Categorias'    },
  { href: '/dashboard/contas',      icon: '🏦', label: 'Contas'        },
  { href: '/dashboard/cartoes',     icon: '💳', label: 'Cartões'       },
  { href: '/dashboard/metas',       icon: '🎯', label: 'Metas'         },
  { href: '/dashboard/orcamento',   icon: '📋', label: 'Orçamento'     },
  { href: '/dashboard/dividas',     icon: '📉', label: 'Dívidas'       },
  { href: '/dashboard/relatorios',  icon: '📈', label: 'Relatórios'    },
  { href: '/dashboard/patrimonio',  icon: '🏛️', label: 'Patrimônio'    },
  { href: '/dashboard/assinaturas', icon: '🔄', label: 'Assinaturas'   },
  { href: '/dashboard/importar', icon: '📥', label: 'Importar extrato' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)

  return (
    <>
      {/* Botão hamburguer — só no mobile */}
      <button
        onClick={() => setAberto(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-gray-900 border border-gray-700 rounded-xl flex items-center justify-center text-white"
      >
        ☰
      </button>

      {/* Overlay escuro — só no mobile quando aberto */}
      {aberto && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
          onClick={() => setAberto(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-gray-900 border-r border-gray-800 flex flex-col min-h-screen
        transform transition-transform duration-300
        ${aberto ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-lg">
              💰
            </div>
            <div>
              <p className="text-white font-bold text-sm">Finanças</p>
              <p className="text-gray-500 text-xs">Pessoais</p>
            </div>
          </div>
          <button
            onClick={() => setAberto(false)}
            className="lg:hidden text-gray-400 hover:text-white text-xl"
          >
            ✕
          </button>
        </div>

        {/* Navegação */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menu.map((item) => {
            const ativo = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAberto(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  ativo
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

        {/* Rodapé */}
        <div className="p-4 border-t border-gray-800">
          <Link
            href="/dashboard/configuracoes"
            onClick={() => setAberto(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-all"
          >
            <span className="text-base">⚙️</span>
            Configurações
          </Link>
        </div>
      </aside>
    </>
  )
}