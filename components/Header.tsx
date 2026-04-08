'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  user: { email?: string }
  profile: { name?: string } | null
}

export default function Header({ user, profile }: HeaderProps) {
  const router = useRouter()
  const supabase = createClient()

  const nomeExibido = profile?.name || user.email?.split('@')[0] || 'Usuário'

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const hoje = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long'
  })

  return (
    <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm capitalize">{hoje}</p>
        <h2 className="text-white font-semibold">Olá, {nomeExibido} 👋</h2>
      </div>

      <div className="flex items-center gap-3">
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