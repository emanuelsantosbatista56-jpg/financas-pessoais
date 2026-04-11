'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ConfiguracoesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')

  const [novaSenha, setNovaSenha] = useState('')
  const [confirmaSenha, setConfirmaSenha] = useState('')
  const [salvandoSenha, setSalvandoSenha] = useState(false)
  const [mensagemSenha, setMensagemSenha] = useState('')
  const [erroSenha, setErroSenha] = useState('')

  async function carregar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email ?? '')
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    if (profile) setNome(profile.name ?? '')
  }

  useEffect(() => { carregar() }, [])

  async function salvarPerfil() {
    setSalvando(true); setMensagem(''); setErro('')
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('profiles')
      .update({ name: nome.trim(), updated_at: new Date().toISOString() })
      .eq('id', user!.id)
    if (error) { setErro('Erro ao salvar perfil.') }
    else { setMensagem('Perfil atualizado com sucesso!') }
    setSalvando(false)
  }

  async function alterarSenha() {
    setErroSenha(''); setMensagemSenha('')
    if (!novaSenha) { setErroSenha('Digite a nova senha.'); return }
    if (novaSenha.length < 6) { setErroSenha('A senha deve ter pelo menos 6 caracteres.'); return }
    if (novaSenha !== confirmaSenha) { setErroSenha('As senhas não coincidem.'); return }
    setSalvandoSenha(true)
    const { error } = await supabase.auth.updateUser({ password: novaSenha })
    if (error) { setErroSenha('Erro ao alterar senha.') }
    else { setMensagemSenha('Senha alterada com sucesso!'); setNovaSenha(''); setConfirmaSenha('') }
    setSalvandoSenha(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-400 text-sm mt-1">Gerencie sua conta e preferências</p>
      </div>

      {/* Perfil */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-lg mb-5">Perfil</h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl">
            {nome ? nome[0].toUpperCase() : email[0]?.toUpperCase() ?? 'U'}
          </div>
          <div>
            <p className="text-white font-medium">{nome || 'Sem nome'}</p>
            <p className="text-gray-500 text-sm">{email}</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2 font-medium">Nome completo</label>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2 font-medium">Email</label>
            <input type="email" value={email} disabled
              className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-gray-500 cursor-not-allowed" />
            <p className="text-gray-600 text-xs mt-1">O email não pode ser alterado</p>
          </div>
        </div>
        {mensagem && <div className="mt-4 p-3 bg-green-900/50 border border-green-800 rounded-xl text-green-300 text-sm">{mensagem}</div>}
        {erro && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erro}</div>}
        <button onClick={salvarPerfil} disabled={salvando}
          className="mt-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
          {salvando ? 'Salvando...' : 'Salvar perfil'}
        </button>
      </div>

      {/* Segurança */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-lg mb-5">Segurança</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2 font-medium">Nova senha</label>
            <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-2 font-medium">Confirmar nova senha</label>
            <input type="password" value={confirmaSenha} onChange={(e) => setConfirmaSenha(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors" />
          </div>
        </div>
        {mensagemSenha && <div className="mt-4 p-3 bg-green-900/50 border border-green-800 rounded-xl text-green-300 text-sm">{mensagemSenha}</div>}
        {erroSenha && <div className="mt-4 p-3 bg-red-900/50 border border-red-800 rounded-xl text-red-300 text-sm">{erroSenha}</div>}
        <button onClick={alterarSenha} disabled={salvandoSenha}
          className="mt-5 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
          {salvandoSenha ? 'Alterando...' : 'Alterar senha'}
        </button>
      </div>

      {/* Sobre */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-white font-semibold text-lg mb-5">Sobre o sistema</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-gray-800">
            <span className="text-gray-400">Versão</span>
            <span className="text-white">1.0.0</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-800">
            <span className="text-gray-400">Banco de dados</span>
            <span className="text-green-400">✓ Conectado</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-800">
            <span className="text-gray-400">PWA</span>
            <span className="text-green-400">✓ Instalável</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-400">Hospedagem</span>
            <span className="text-white">Vercel</span>
          </div>
        </div>
      </div>

      {/* Sair */}
      <div className="bg-gray-900 border border-red-900/50 rounded-2xl p-6">
        <h2 className="text-red-400 font-semibold text-lg mb-2">Sair da conta</h2>
        <p className="text-gray-400 text-sm mb-5">Você será desconectado de todos os dispositivos.</p>
        <button onClick={sair}
          className="bg-red-600 hover:bg-red-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors">
          Sair da conta
        </button>
      </div>
    </div>
  )
}