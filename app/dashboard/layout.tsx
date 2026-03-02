import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import { ToastProvider } from '@/components/ToastProvider'
import type { Profile } from '@/lib/types'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    // Buscar perfil do usuário
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const userProfile: Profile = profile || {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuário',
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    return (
        <ToastProvider>
            <div className="dashboard-root">
                <Navbar userRole={userProfile.role} />
                <main className="main-content-fluid">
                    {children}
                </main>
            </div>
        </ToastProvider>
    )
}
