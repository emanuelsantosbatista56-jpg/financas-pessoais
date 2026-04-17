import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import BottomNav from '@/components/BottomNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="min-h-screen bg-gray-950 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={user} profile={profile} />
        <main className="flex-1 p-4 lg:p-6 overflow-auto pt-16 lg:pt-6 pb-24 lg:pb-6">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}