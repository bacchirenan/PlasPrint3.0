'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
    role: 'user' | 'model'
    parts: { text: string }[]
}

/**
 * Componente para renderizar uma única imagem via proxy.
 */
function ImageCard({ url, index }: { url: string; index: number }) {
    const idFromThumb = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    const idFromView  = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    const fileId = (idFromThumb || idFromView)?.[1]

    const proxiedSrc = fileId ? `/api/drive-image?id=${fileId}` : url
    const driveUrl   = fileId ? `https://drive.google.com/file/d/${fileId}/view` : url

    return (
        <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <img
                src={proxiedSrc}
                alt={`Imagem ${index + 1}`}
                style={{
                    display: 'block',
                    width: '100%',
                    maxHeight: '280px',
                    objectFit: 'contain',
                    background: 'rgba(0,0,0,0.2)',
                }}
            />
            <a
                href={driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 12px',
                    fontSize: '11px', fontWeight: 600,
                    color: 'var(--primary-accent)',
                    textDecoration: 'none',
                    borderTop: '1px solid rgba(59,130,246,0.15)',
                    background: 'rgba(59,130,246,0.05)',
                    transition: 'background 0.2s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(59,130,246,0.05)'}
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Abrir no Drive
            </a>
        </div>
    )
}

/**
 * Renderiza o conteúdo de uma mensagem da IA.
 * Detecta marcadores [IMAGEM:URL] e agrupa imagens consecutivas em grid.
 */
function renderMessageContent(text: string) {
    // Divide alternando: texto, url, texto, url, ...
    const parts = text.split(/\[IMAGEM:(https?:\/\/[^\]]+)\]/g)

    // Reagrupa em segmentos: { type: 'text' | 'image', value }
    type Seg = { type: 'text'; value: string } | { type: 'image'; value: string }
    const segments: Seg[] = []
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            if (parts[i]) segments.push({ type: 'text', value: parts[i] })
        } else {
            segments.push({ type: 'image', value: parts[i] })
        }
    }

    // Agrupa imagens consecutivas para exibir em grid
    const elements: React.ReactNode[] = []
    let imgGroup: string[] = []
    let groupStart = 0

    const flushImageGroup = (key: number) => {
        if (!imgGroup.length) return
        const cols = imgGroup.length === 1 ? 1 : imgGroup.length === 2 ? 2 : 3
        elements.push(
            <div key={`grid-${key}`} style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: '10px',
                margin: '14px 0 6px',
            }}>
                {imgGroup.map((url, idx) => (
                    <ImageCard key={url} url={url} index={idx} />
                ))}
            </div>
        )
        imgGroup = []
    }

    segments.forEach((seg, i) => {
        if (seg.type === 'image') {
            imgGroup.push(seg.value)
        } else {
            flushImageGroup(i)
            elements.push(
                <span key={`text-${i}`} style={{ whiteSpace: 'pre-wrap' }}>
                    {seg.value}
                </span>
            )
        }
    })
    flushImageGroup(segments.length) // flush final

    return <>{elements}</>
}



const suggestedQuestions = [
    { text: "Quais são os erros comuns de máquina?", icon: "⚠️" },
    { text: "Informações das máquinas DACEN", icon: "⚙️" },
    { text: "Informações das máquinas PSI", icon: "🔧" },
    { text: "Procedimentos gerais do setor", icon: "📋" }
]

export default function AssistentePage() {
    const [messages, setMessages] = useState<Message[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [navHeight, setNavHeight] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Scroll suave até o final das mensagens ao receber nova resposta
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, loading])

    // Foca o input na montagem
    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    // Mede a altura real do navbar e bloqueia scroll da página
    useEffect(() => {
        const nav = document.querySelector('nav') as HTMLElement | null
        const body = document.body
        const main = document.querySelector('main') as HTMLElement | null

        // Mede o navbar
        if (nav) setNavHeight(nav.getBoundingClientRect().height)

        // Bloqueia scroll
        const prevBodyOv = body.style.overflow
        const prevMainPb = main?.style.paddingBottom ?? ''
        const prevMainOv = main?.style.overflow ?? ''
        body.style.overflow = 'hidden'
        if (main) {
            main.style.overflow = 'hidden'
            main.style.paddingBottom = '0'
        }

        return () => {
            body.style.overflow = prevBodyOv
            if (main) {
                main.style.overflow = prevMainOv
                main.style.paddingBottom = prevMainPb
            }
        }
    }, [])

    const handleSend = async (customMessage?: string) => {
        const messageToSend = customMessage || input
        if (!messageToSend.trim() || loading) return

        const userMsg: Message = { role: 'user', parts: [{ text: messageToSend }] }
        setMessages(prev => [...prev, userMsg])
        if (!customMessage) setInput('')
        setLoading(true)

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: messageToSend,
                    history: messages.slice(-6)
                })
            })

            let data: any
            try {
                data = await res.json()
            } catch {
                data = { error: `Resposta inválida do servidor (HTTP ${res.status})` }
            }

            if (!res.ok) {
                const errMsg = data?.error || data?.details || `Falha HTTP ${res.status}`
                setMessages(prev => [...prev, { role: 'model', parts: [{ text: `❌ ${errMsg}` }] }])
                return
            }

            if (!data?.text) {
                setMessages(prev => [...prev, { role: 'model', parts: [{ text: '❌ Resposta vazia. Tente novamente.' }] }])
                return
            }

            setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }])
        } catch (e: any) {
            setMessages(prev => [...prev, { role: 'model', parts: [{ text: `❌ Erro de conexão: ${e.message}` }] }])
        } finally {
            setLoading(false)
            // Refoca o input após a resposta
            setTimeout(() => inputRef.current?.focus(), 100)
        }
    }

    return (
        /* Container externo fixo para travar scroll do body */
        <div style={{
            position: 'fixed',
            top: navHeight > 0 ? `${navHeight}px` : '160px',
            left: 0,
            right: 0,
            bottom: 0,
            overflow: 'hidden',
        }}>
            {/* Wrapper centralizado que segue a largura do menu (Navbar) e do resto do programa */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                width: '100%',
                maxWidth: '1400px',
                margin: '0 auto',
                padding: '0 40px',
                overflow: 'hidden',
            }}>

            {/* ── Seção Superior Fixa: Cabeçalho + Barra de Busca ── */}
            <div style={{
                flexShrink: 0,
                padding: '24px 0 0',
            }}>
                {/* Cabeçalho */}
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '12px',
                        background: 'rgba(59, 130, 246, 0.08)',
                        border: '1px solid rgba(59, 130, 246, 0.2)',
                        borderRadius: '30px', padding: '6px 18px', marginBottom: '16px'
                    }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 8px var(--success)' }} />
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary-accent)', letterSpacing: '0.5px' }}>
                            PLANILHA CONECTADA
                        </span>
                    </div>


                </div>

                {/* ── Barra de Busca (FIXA, nunca some) ── */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{
                        display: 'flex',
                        gap: '12px',
                        background: 'rgba(13, 30, 56, 0.92)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        borderRadius: '16px',
                        padding: '8px 8px 8px 20px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(59,130,246,0.05)',
                        alignItems: 'center',
                    }}>
                        {/* Ícone de busca */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>

                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Tire suas dúvidas sobre erros, máquinas DACEN, PSI..."
                            style={{
                                flex: 1,
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                padding: '10px 0',
                                fontSize: '15px',
                                outline: 'none',
                            }}
                        />

                        {/* Botão limpar, só aparece com texto */}
                        {input && (
                            <button
                                onClick={() => { setInput(''); inputRef.current?.focus() }}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        )}

                        <button
                            onClick={() => handleSend()}
                            disabled={loading || !input.trim()}
                            style={{
                                background: loading ? 'rgba(59,130,246,0.4)' : 'var(--primary-accent)',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '12px',
                                padding: '10px 22px',
                                fontWeight: 700,
                                fontSize: '13px',
                                letterSpacing: '0.5px',
                                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                whiteSpace: 'nowrap',
                                boxShadow: input.trim() ? '0 4px 14px rgba(59, 130, 246, 0.35)' : 'none'
                            }}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner-sm" />
                                    Buscando...
                                </>
                            ) : (
                                <>
                                    Perguntar
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="22" y1="2" x2="11" y2="13" />
                                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Sugestões rápidas — só aparecem no início */}
                    {messages.length === 0 && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                            {suggestedQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(q.text)}
                                    disabled={loading}
                                    style={{
                                        padding: '7px 14px',
                                        borderRadius: '30px',
                                        background: 'rgba(13, 30, 56, 0.6)',
                                        backdropFilter: 'blur(10px)',
                                        border: '1px solid rgba(59, 130, 246, 0.15)',
                                        color: 'var(--text-secondary)',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)'
                                        e.currentTarget.style.color = '#fff'
                                        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.12)'
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.15)'
                                        e.currentTarget.style.color = 'var(--text-secondary)'
                                        e.currentTarget.style.background = 'rgba(13, 30, 56, 0.6)'
                                    }}
                                >
                                    <span style={{ fontSize: '15px' }}>{q.icon}</span>
                                    {q.text}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Área de Mensagens (ROLÁVEL) ─────────────── */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px 0 40px',
                scrollBehavior: 'smooth',
            }}>

            {/* ── Estado Vazio ───────────────────────────── */}
            {messages.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '60px 0', opacity: 0.4 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-accent)" strokeWidth="1" style={{ margin: '0 auto 16px', display: 'block' }}>
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                        Faça uma pergunta para começar
                    </p>
                </div>
            )}

            {/* ── Fluxo de Mensagens ──── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {messages.map((m, i) => (
                    <div key={i} style={{ animation: 'fadeSlideDown 0.3s ease-out' }}>
                        {m.role === 'user' ? (
                            /* Pergunta do usuário */
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '12px',
                                justifyContent: 'flex-end',
                            }}>
                                <div style={{
                                    maxWidth: '75%',
                                    background: 'var(--primary-accent)',
                                    borderRadius: '18px 18px 4px 18px',
                                    padding: '12px 18px',
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                    color: '#fff',
                                    boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
                                    whiteSpace: 'pre-wrap',
                                }}>
                                    {m.parts[0].text}
                                </div>
                                <div style={{
                                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                                    background: 'linear-gradient(135deg, var(--primary-accent), var(--primary-bright))',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '14px', fontWeight: 700, color: '#fff'
                                }}>
                                    V
                                </div>
                            </div>
                        ) : (
                            /* Resposta da IA */
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                <div style={{
                                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                                    background: 'rgba(59, 130, 246, 0.12)',
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--primary-accent)" strokeWidth="1.5">
                                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-5h2v2h-2zm0-8h2v6h-2z" />
                                    </svg>
                                </div>
                                <div style={{
                                    flex: 1,
                                    background: 'rgba(13, 30, 56, 0.5)',
                                    backdropFilter: 'blur(10px)',
                                    border: '1px solid rgba(59, 130, 246, 0.1)',
                                    borderRadius: '4px 18px 18px 18px',
                                    padding: '16px 20px',
                                    fontSize: '14px',
                                    lineHeight: '1.7',
                                    color: 'var(--text-primary)',
                                    whiteSpace: 'pre-wrap',
                                    boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
                                }}>
                                    {renderMessageContent(m.parts[0].text)}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {/* Indicador de "digitando" */}
                {loading && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', animation: 'fadeSlideDown 0.3s ease-out' }}>
                        <div style={{
                            width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                            background: 'rgba(59, 130, 246, 0.12)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <div className="spinner-sm" />
                        </div>
                        <div style={{
                            background: 'rgba(13, 30, 56, 0.5)',
                            border: '1px solid rgba(59, 130, 246, 0.1)',
                            borderRadius: '4px 18px 18px 18px',
                            padding: '16px 20px',
                            display: 'flex',
                            gap: '5px',
                            alignItems: 'center',
                        }}>
                            <span className="dot-pulse" style={{ '--delay': '0s' } as any} />
                            <span className="dot-pulse" style={{ '--delay': '0.15s' } as any} />
                            <span className="dot-pulse" style={{ '--delay': '0.3s' } as any} />
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            </div>{/* fim da área rolável de mensagens */}

            </div>{/* fim do wrapper centralizado 1400px */}

            <style jsx global>{`
                @keyframes fadeSlideDown {
                    from { opacity: 0; transform: translateY(-8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .spinner-sm {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(59, 130, 246, 0.3);
                    border-top-color: var(--primary-accent);
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                    flex-shrink: 0;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .dot-pulse {
                    display: inline-block;
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: var(--primary-accent);
                    opacity: 0.4;
                    animation: dotPulse 1.2s ease-in-out infinite;
                    animation-delay: var(--delay, 0s);
                }
                @keyframes dotPulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50%       { opacity: 1;   transform: scale(1.1); }
                }
            `}</style>
        </div>
    )
}
