'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

interface SidebarProps {
    profile: Profile
}

const NAV_ITEMS = [
    {
        section: 'Principal',
        items: [
            {
                href: '/dashboard/producao',
                label: 'Produção',
                id: 'nav-producao',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="9" />
                        <rect x="14" y="3" width="7" height="5" />
                        <rect x="14" y="12" width="7" height="9" />
                        <rect x="3" y="16" width="7" height="5" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/carga-maquina',
                label: 'Programação',
                id: 'nav-carga-maquina',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                        <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/oee',
                label: 'OEE e TEEP',
                id: 'nav-oee',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/fichas',
                label: 'Fichas Técnicas',
                id: 'nav-fichas',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/canudos',
                label: 'Canudos',
                id: 'nav-canudos',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="2" />
                        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/assistente',
                label: 'Assistente IA',
                id: 'nav-assistente',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/relatorios',
                label: 'Relatórios',
                id: 'nav-relatorios',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                ),
            },
        ],
    },
]

export function Sidebar({ profile }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const initials = profile.full_name
        ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : profile.email.substring(0, 2).toUpperCase()

    const roleLabel = profile.role === 'master'
        ? 'Master'
        : profile.role === 'admin'
            ? 'Administrador'
            : 'Usuário'

    return (
        <aside className="sidebar" id="sidebar">
            {/* Brand */}
            <div className="sidebar-brand">
                <div className="sidebar-brand-icon">
                    <img src="/palsprint.png" alt="Logo PlasPrint" width="32" height="32" style={{ objectFit: 'contain' }} />
                </div>
                <div className="sidebar-brand-text">
                    <h1>PlasPrint</h1>
                    <span>IA v3.0</span>
                </div>
            </div>

            {/* Navegação */}
            <nav className="sidebar-nav" aria-label="Navegação principal">
                {NAV_ITEMS.map((section) => (
                    <div key={section.section}>
                        <div className="sidebar-section-title">{section.section}</div>
                        {section.items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                id={item.id}
                                className={`nav-item ${pathname.startsWith(item.href) ? 'active' : ''}`}
                                aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        ))}
                    </div>
                ))}

                <div className="divider" />

                {/* Seção Admin/Master */}
                {(profile.role === 'master' || profile.role === 'admin') && (
                    <div>
                        <div className="sidebar-section-title">Administração</div>
                        <Link
                            href="/dashboard/configuracoes"
                            id="nav-config"
                            className={`nav-item ${pathname === '/dashboard/configuracoes' ? 'active' : ''}`}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Configurações
                        </Link>
                    </div>
                )}
            </nav>

            {/* Footer: Usuário logado */}
            <div className="sidebar-footer">
                <div className="user-card">
                    <div className="user-avatar" aria-hidden="true">{initials}</div>
                    <div className="user-info">
                        <div className="user-name">
                            {profile.full_name || profile.email.split('@')[0]}
                        </div>
                        <div className="user-role">{roleLabel}</div>
                    </div>
                    <button
                        id="logout-btn"
                        className="logout-btn"
                        onClick={handleLogout}
                        title="Sair do sistema"
                        aria-label="Sair do sistema"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>
        </aside>
    )
}
