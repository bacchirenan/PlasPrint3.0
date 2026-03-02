'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
    { name: 'Assistente IA', path: '/dashboard/assistente' },
    { name: 'Fichas', path: '/dashboard/fichas' },
    { name: 'Produção', path: '/dashboard/producao' },
    { name: 'Oee e Teep', path: '/dashboard/oee' },
    { name: 'Canudos', path: '/dashboard/canudos' },
    { name: 'Relatórios', path: '/dashboard/relatorios' },
    { name: 'Configurações', path: '/dashboard/configuracoes' },
]

export default function Navbar({ userRole }: { userRole?: string }) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    // Filtra itens de admin se necessário
    const filteredItems = NAV_ITEMS.filter(item => {
        if (item.path === '/dashboard/configuracoes') {
            return userRole === 'admin' || userRole === 'master'
        }
        return true
    })

    return (
        <nav style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 0 20px 0',
            background: 'linear-gradient(to bottom, rgba(10, 25, 41, 0.95), transparent)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backdropFilter: 'blur(10px)'
        }}>
            {/* Logo Centralizado */}
            <h1 style={{
                fontSize: '48px',
                fontWeight: 800,
                color: '#fff',
                margin: '0 0 40px 0',
                letterSpacing: '-2px',
                textShadow: '0 0 30px rgba(59, 130, 246, 0.3)'
            }}>
                PlasPrint <span style={{ color: 'var(--primary-accent)' }}>IA</span>
            </h1>

            {/* Links de Navegação (Tabs) */}
            <div style={{
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
                padding: '8px 20px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
                {filteredItems.map((item) => {
                    const isActive = pathname === item.path
                    return (
                        <Link
                            key={item.path}
                            href={item.path}
                            className={`nav-tab ${isActive ? 'active' : ''}`}
                        >
                            {item.name}
                        </Link>
                    )
                })}

                {/* Logout (Discreto no final) */}
                <button
                    onClick={handleLogout}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'rgba(255,255,255,0.3)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginLeft: '20px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                    }}
                >
                    Sair
                </button>
            </div>
        </nav>
    )
}
