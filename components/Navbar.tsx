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
                margin: '0 0 5px 0',
                letterSpacing: '-2px',
                textShadow: '0 0 30px rgba(59, 130, 246, 0.3)'
            }}>
                PlasPrint <span style={{ color: 'var(--primary-accent)' }}>IA</span>
            </h1>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '30px' }}>
                v2.0.1-prod | {process.env.NEXT_PUBLIC_GITHUB_REPO || 'bacchirenan/PlasPrint3.0'}
            </div>

            {/* Links de Navegação (Tabs) - Alinhado perfeitamente com a largura dos cards e filtros */}
            <div style={{
                width: '100%',
                maxWidth: '1400px',
                padding: '0 20px',
                display: 'flex',
                justifyContent: 'center'
            }}>
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '12px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '8px 16px',
                    borderRadius: '16px',
                    background: 'rgba(13, 30, 56, 0.45)', // Identidade visual dos cards
                    border: '1px solid rgba(59, 130, 246, 0.12)',
                    width: '100%',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.35)',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    {filteredItems.map((item) => {
                        const isActive = pathname === item.path
                        return (
                            <Link
                                key={item.path}
                                href={item.path}
                                className={`nav-tab ${isActive ? 'active' : ''}`}
                                style={{
                                    fontSize: '15px',
                                    padding: '12px 20px',
                                    textAlign: 'center',
                                    whiteSpace: 'nowrap', // Impede quebra interna do texto do link
                                    flex: '1 0 auto',
                                    maxWidth: '200px'
                                }}
                            >
                                {item.name}
                            </Link>
                        )
                    })}

                </div>
            </div>
        </nav>
    )
}
