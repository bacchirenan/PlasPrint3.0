'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
    role: 'user' | 'model'
    parts: { text: string }[]
}

export default function AssistentePage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const chatEndRef = useRef<HTMLDivElement>(null)

    const handleSend = async () => {
        if (!input.trim() || loading) return

        const userMsg: Message = { role: 'user', parts: [{ text: input }] }
        setMessages(prev => [userMsg, ...prev]) // Adiciona no início para aparecer embaixo
        const currentInput = input
        setInput('')
        setLoading(true)

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentInput,
                    history: messages.slice(0, 6).reverse()
                })
            })

            const data = await res.json()
            if (!res.ok) {
                console.error("Erro no chat:", data)
                setMessages(prev => [{ role: 'model', parts: [{ text: `❌ ${data.error || 'Erro desconhecido'}` }] }, ...prev])
                return
            }

            setMessages(prev => [{ role: 'model', parts: [{ text: data.text }] }, ...prev])
        } catch (e: any) {
            console.error("Falha no fetch:", e)
            setMessages(prev => [{ role: 'model', parts: [{ text: `❌ Falha ao conectar com o assistente: ${e.message}` }] }, ...prev])
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="page-container" style={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '900px',
            margin: '0 auto',
            paddingTop: '40px'
        }}>

            {/* Título de Boas Vindas */}
            {messages.length === 0 && (
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: 12 }}>Como posso te ajudar hoje?</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '16px' }}>Analise dados de produção e custos em segundos com IA.</p>
                </div>
            )}

            {/* Barra de Input (Sempre no topo) */}
            <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '8px',
                display: 'flex',
                gap: 12,
                boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
                backdropFilter: 'blur(10px)',
                position: 'sticky',
                top: '20px',
                zIndex: 10
            }}>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder="Pergunte sobre dados de produção, OEE, TEEP ou fichas técnicas..."
                    className="assistente-input"
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        padding: '12px 20px',
                        fontSize: '16px',
                        outline: 'none'
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    style={{
                        background: 'var(--primary-accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        padding: '0 24px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: '0 0 20px rgba(59, 130, 246, 0.4)'
                    }}
                >
                    {loading ? '...' : (
                        <>
                            ENVIAR
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </>
                    )}
                </button>
            </div>

            {/* Loading animado no topo das respostas */}
            {loading && (
                <div style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary-accent)',
                    margin: '30px 0'
                }}>
                    <div className="spinner-sm" />
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1 }}>PLASMANDO RESPOSTA...</span>
                </div>
            )}

            {/* Histórico de Mensagens (Abaixo da barra) */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 24,
                marginTop: 40,
                paddingBottom: 100
            }}>
                {messages.map((m, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
                        animation: 'fadeInUp 0.3s ease-out'
                    }}>
                        <div style={{
                            maxWidth: '90%',
                            padding: '16px 24px',
                            borderRadius: m.role === 'user' ? '20px 20px 2px 20px' : '20px 20px 20px 2px',
                            background: m.role === 'user' ? 'var(--primary-accent)' : 'rgba(255, 255, 255, 0.05)',
                            border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                            color: '#fff',
                            fontSize: '16px',
                            lineHeight: 1.6,
                            boxShadow: m.role === 'user' ? '0 10px 25px rgba(59, 130, 246, 0.2)' : 'none',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {m.parts[0].text}
                        </div>
                        <span style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            marginTop: 8,
                            textTransform: 'uppercase',
                            letterSpacing: 1
                        }}>
                            {m.role === 'user' ? 'Você' : 'PlasPrint IA'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
