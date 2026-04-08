'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [modo, setModo] = useState<'login' | 'cadastro'>('login')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit() {
    setErro('')
    setMensagem('')
    setCarregando(true)

    if (modo === 'cadastro') {
      const { error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { name: nome } },
      })
      if (error) {
        setErro(error.message)
      } else {
        setMensagem('Cadastro realizado! Verifique seu email para confirmar a conta.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
      if (error) {
        setErro('Email ou senha incorretos.')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    }

    setCarregando(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo e título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <span className="text-white text-2xl">💰</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Finanças Pessoais</h1>
          <p className="text-gray-400 mt-2">Controle total do seu dinheiro</p>
        </div>

        {/* Card do formulário */}
        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">

          {/* Tabs login / cadastro */}
          <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
            <button
              onClick={() => { setModo('login'); setErro(''); setMensagem('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                modo === 'login'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => { setModo('cadastro'); setErro(''); setMensagem('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                modo === 'cadastro'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Criar conta
            </button>
          </div>

          {/* Campo nome (só no cadastro) */}
          {modo === 'cadastro' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome completo
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Campo email */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Campo senha */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Mensagem de erro */}
          {erro && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">
              {erro}
            </div>
          )}

          {/* Mensagem de sucesso */}
          {mensagem && (
            <div className="mb-4 p-3 bg-green-900/50 border border-green-800 rounded-xl text-green-300 text-sm">
              {mensagem}
            </div>
          )}

          {/* Botão principal */}
          <button
            onClick={handleSubmit}
            disabled={carregando}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {carregando
              ? 'Aguarde...'
              : modo === 'login' ? 'Entrar' : 'Criar minha conta'
            }
          </button>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Seus dados são privados e protegidos
        </p>
      </div>
    </div>
  )
}