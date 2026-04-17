'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menu = [
  { href: '/dashboard',            icon: '📊', label: 'Início'      },
  { href: '/dashboard/transacoes', icon: '💸', label: 'Transações'  },
  { href: '/dashboard/ia',         icon: '🤖', label: 'IA'          },
  { href: '/dashboard/relatorios', icon: '📈', label: 'Relatórios'  },
  { href: '/dashboard/contas',     icon: '🏦', label: 'Contas'      },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-gray-900 border-t border-gray-800 px-2 pb-safe">
      <div className="flex items-center justify-around">
        {menu.map((item) => {
          const ativo = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 py-3 px-3 rounded-xl transition-all min-w-[60px] ${
                ativo ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className={`text-2xl transition-transform ${ativo ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-xs font-medium ${ativo ? 'text-indigo-400' : 'text-gray-500'}`}>
                {item.label}
              </span>
              {ativo && (
                <div className="w-1 h-1 bg-indigo-400 rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}