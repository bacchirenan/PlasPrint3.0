'use client'

import { useState } from 'react'

export default function RelatoriosPage() {
    const [generating, setGenerating] = useState(false)

    const handleGenerate = (type: string) => {
        setGenerating(true)
        // Aqui no futuro chamaremos o componente PDF do lado do cliente ou servidor
        setTimeout(() => {
            alert(`Relatório ${type} gerado com sucesso! (Funcionalidade sendo finalizada)`)
            setGenerating(false)
        }, 2000)
    }

    return (
        <div className="page-container" style={{ maxWidth: 900 }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Repositório de Relatórios</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gere documentos analíticos consolidados em formato PDF</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {[
                    { id: 'geral', title: 'Relatório Geral (Mensal)', desc: 'Dashboard completo com todas as máquinas, OEE e TEEP.', icon: '📊' },
                    { id: 'producao', title: 'Resumo de Produção', desc: 'Foco em volumes, rejeitos e performance de operadores.', icon: '⚙️' },
                    { id: 'custos', title: 'Detalhamento de Custos', desc: 'Análise financeira baseada nos consumos das fichas técnicas.', icon: '💰' },
                ].map(rel => (
                    <div key={rel.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ fontSize: 32 }}>{rel.icon}</div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{rel.title}</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{rel.desc}</p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleGenerate(rel.id)}
                            disabled={generating}
                            style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
                        >
                            {generating ? 'Processando...' : 'Gerar PDF'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}
