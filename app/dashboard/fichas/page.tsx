'use client'

import { useEffect, useState, useMemo } from 'react'
import type { FichaTecnica } from '@/lib/types'
import Plot from '@/components/Plot'

function fmtMoeda(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
}

function fmtMoeda2(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

export default function FichasPage() {
    const [fichas, setFichas] = useState<FichaTecnica[]>([])
    const [config, setConfig] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'performance' | 'financeiro'>('performance')
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/data/fichas')
                if (!res.ok) {
                    const errData = await res.json()
                    throw new Error(errData.error || `Erro HTTP ${res.status}`)
                }
                const data = await res.json()
                setFichas(data.fichas || [])
                setConfig(data.config)
            } catch (e) {
                console.error(e)
                setError(e instanceof Error ? e.message : 'Falha ao conectar com o banco de dados')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const sortedData = useMemo(() => {
        let result = fichas.filter(f =>
            f.referencia.toLowerCase().includes(search.toLowerCase()) ||
            f.produto.toLowerCase().includes(search.toLowerCase())
        )

        if (sortConfig) {
            result.sort((a, b) => {
                let aVal: any
                let bVal: any

                if (sortConfig.key === 'consumo') {
                    aVal = (a.cyan || 0) + (a.magenta || 0) + (a.yellow || 0) + (a.black || 0) + (a.white || 0) + (a.varnish || 0)
                    bVal = (b.cyan || 0) + (b.magenta || 0) + (b.yellow || 0) + (b.black || 0) + (b.white || 0) + (b.varnish || 0)
                } else if (sortConfig.key === 'ciclo') {
                    aVal = a.tempo_s || 0
                    bVal = b.tempo_s || 0
                } else if (sortConfig.key === 'custo') {
                    aVal = a.custo_tinta_total || 0
                    bVal = b.custo_tinta_total || 0
                }

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
                return 0
            })
        }

        return result
    }, [fichas, search, sortConfig])

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    // Cálculos financeiros
    // Cálculos de Performance e Consumo
    const performanceMetrics = useMemo(() => {
        if (fichas.length === 0) return null

        const cores = ['cyan', 'magenta', 'yellow', 'black', 'white', 'varnish']
        const totalsByColor: Record<string, number> = {}
        let grandTotalVol = 0
        let totalTempo = 0

        cores.forEach(c => totalsByColor[c] = 0)

        fichas.forEach(f => {
            cores.forEach(c => {
                const val = Number(f[c as keyof FichaTecnica] || 0)
                totalsByColor[c] += val
                grandTotalVol += val
            })
            totalTempo += Number(f.tempo_s || 0)
        })

        const corMaisUsada = Object.entries(totalsByColor).sort((a, b) => b[1] - a[1])[0]

        // Mix de produtos (agrupado por nome do produto)
        const mixMap: Record<string, number> = {}
        fichas.forEach(f => {
            const cat = f.produto || 'Outros'
            mixMap[cat] = (mixMap[cat] || 0) + 1
        })

        const sortedMix = Object.entries(mixMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)

        return {
            totalFichas: fichas.length,
            volumeTotal: grandTotalVol,
            tempoMedio: totalTempo / fichas.length,
            corMaisUsada: corMaisUsada ? corMaisUsada[0].charAt(0).toUpperCase() + corMaisUsada[0].slice(1) : '-',
            totalsByColor,
            productMix: {
                labels: sortedMix.map(m => m[0]),
                values: sortedMix.map(m => m[1])
            }
        }
    }, [fichas])

    // Cálculos financeiros (existentes)
    const metrics = useMemo(() => {
        if (fichas.length === 0) return null
        const custos = fichas.map(f => f.custo_por_unidade || 0)
        return {
            media: custos.reduce((a, b) => a + b, 0) / custos.length,
            max: Math.max(...custos),
            min: Math.min(...custos),
        }
    }, [fichas])

    // Top 10
    const top10Data = useMemo(() => {
        const sorted = [...fichas]
            .sort((a, b) => (b.custo_tinta_total || 0) - (a.custo_tinta_total || 0))
            .slice(0, 10)
            .reverse() // Reverse for horizontal chart

        return {
            y: sorted.map(f => `${f.referencia} - ${f.produto}`),
            x: sorted.map(f => f.custo_tinta_total || 0),
            text: sorted.map(f => fmtMoeda2(f.custo_tinta_total || 0)),
            raw: sorted
        }
    }, [fichas])

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column' }}>
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Carregando banco de dados de fichas técnicas...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="page-container">
                <div className="card" style={{ padding: 40, textAlign: 'center', border: '1px solid var(--border)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <div style={{ color: 'var(--danger)', fontSize: 40, marginBottom: 16 }}>⚠</div>
                    <h2 style={{ marginBottom: 8 }}>Erro ao Carregar Dados</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{error}</p>
                    <button className="btn btn-primary" onClick={() => window.location.reload()}>Tentar Novamente</button>

                    <div style={{ marginTop: 40, textAlign: 'left', fontSize: 11, background: 'rgba(0,0,0,0.1)', padding: 15, borderRadius: 8 }}>
                        <div style={{ color: 'var(--text-muted)', fontWeight: 700, marginBottom: 8, textTransform: 'uppercase' }}>Dica:</div>
                        Certifique-se de que o arquivo <strong>fichas_tecnicas.db</strong> está presente na pasta raiz do projeto.
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="page-container">
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Fichas Técnicas</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gestão de referências, consumos de tinta e tempos de ciclo</p>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 32, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
                <button
                    onClick={() => setActiveTab('performance')}
                    style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'performance' ? '3px solid var(--primary-bright)' : '3px solid transparent',
                        color: activeTab === 'performance' ? 'var(--primary-bright)' : 'var(--text-muted)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: '0.2s'
                    }}
                >
                    Performance e Consumo
                </button>
                <button
                    onClick={() => setActiveTab('financeiro')}
                    style={{
                        padding: '12px 24px',
                        background: 'none',
                        border: 'none',
                        borderBottom: activeTab === 'financeiro' ? '3px solid var(--primary-bright)' : '3px solid transparent',
                        color: activeTab === 'financeiro' ? 'var(--primary-bright)' : 'var(--text-muted)',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: '0.2s'
                    }}
                >
                    Análise Financeira
                </button>
            </div>

            {/* --- SEÇÃO PERFORMANCE E CONSUMO --- */}
            {activeTab === 'performance' && performanceMetrics && (
                <div style={{ marginBottom: 40 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Análise de Performance e Consumo</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 30 }}>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Total de Fichas</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{performanceMetrics.totalFichas}</div>
                        </div>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Volume Total (ml/1k)</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{performanceMetrics.volumeTotal.toFixed(1)}</div>
                        </div>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Tempo Médio (s)</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{performanceMetrics.tempoMedio.toFixed(1)}</div>
                        </div>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Cor Mais Usada</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-bright)' }}>{performanceMetrics.corMaisUsada}</div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        <div className="card" style={{ padding: '24px' }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Distribuição de Tintas por Cor (%)</h4>
                            <Plot
                                data={[{
                                    values: Object.values(performanceMetrics.totalsByColor),
                                    labels: Object.keys(performanceMetrics.totalsByColor),
                                    type: 'pie',
                                    hole: 0.4,
                                    marker: {
                                        colors: ['#00FFFF', '#FF00FF', '#FFFF00', '#000000', '#FFFFFF', '#d9b38c']
                                    },
                                    textinfo: 'label+percent',
                                    textposition: 'inside',
                                    showlegend: true
                                }]}
                                layout={{
                                    height: 350,
                                    margin: { t: 20, b: 20, l: 0, r: 0 },
                                    paper_bgcolor: 'transparent',
                                    legend: { font: { color: '#fff' }, orientation: 'h', x: 0, y: -0.1 }
                                }}
                                config={{ displayModeBar: false, responsive: true }}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div className="card" style={{ padding: '24px' }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Mix de Produtos (Qtd de Fichas)</h4>
                            <Plot
                                data={[{
                                    values: performanceMetrics.productMix.values,
                                    labels: performanceMetrics.productMix.labels,
                                    type: 'pie',
                                    hole: 0.4,
                                    textinfo: 'percent',
                                    textposition: 'inside',
                                    marker: {
                                        colors: ['#1e3a8a', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#34d399', '#10b981', '#059669', '#047857', '#065f46']
                                    },
                                    showlegend: true
                                }]}
                                layout={{
                                    height: 350,
                                    margin: { t: 0, b: 0, l: 0, r: 0 },
                                    paper_bgcolor: 'transparent',
                                    legend: { font: { color: '#fff', size: 10 }, x: 0, y: -0.3, orientation: 'h' }
                                }}
                                config={{ displayModeBar: false, responsive: true }}
                                style={{ width: '100%' }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* --- SEÇÃO FINANCEIRA --- */}
            {activeTab === 'financeiro' && metrics && (
                <div style={{ marginBottom: 40 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Custo Médio (por Garrafa)</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary-bright)' }}>{fmtMoeda(metrics.media)}</div>
                        </div>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Produto Maior Custo (Unidade)</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--danger)' }}>{fmtMoeda(metrics.max)}</div>
                        </div>
                        <div className="card" style={{ padding: '20px' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Produto Menor Custo (Unidade)</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--success)' }}>{fmtMoeda(metrics.min)}</div>
                        </div>
                    </div>

                    {config?.imposto > 0 && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: -10, marginBottom: 24 }}>
                            *Imposto de importação de {config.imposto.toFixed(2)}% já incluído.
                        </p>
                    )}

                    <div className="card" style={{ padding: '20px' }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Top 10: Produtos com Maior Custo (1.000 un.)</h4>
                        <Plot
                            data={[
                                {
                                    type: 'bar',
                                    x: top10Data.x,
                                    y: top10Data.y,
                                    orientation: 'h',
                                    text: top10Data.text,
                                    textposition: 'inside',
                                    insidetextanchor: 'end',
                                    insidetextfont: { color: '#fff', family: 'var(--font-primary-local), sans-serif' },
                                    marker: {
                                        color: top10Data.x.map((_, i) => `rgba(59, 130, 246, ${0.4 + (i / 10) * 0.6})`),
                                        line: { width: 0 }
                                    },
                                    hoverinfo: 'x+y'
                                }
                            ]}
                            layout={{
                                autosize: true,
                                height: 400,
                                margin: { l: 250, r: 20, t: 10, b: 30 },
                                font: { family: 'var(--font-primary-local), sans-serif' },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                showlegend: false,
                                xaxis: { showgrid: false, zeroline: false, showticklabels: false },
                                yaxis: {
                                    tickfont: { size: 11, color: '#fff', family: 'var(--font-primary-local), sans-serif' },
                                    tickpadding: 15
                                }
                            }}
                            config={{ displayModeBar: false, responsive: true }}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Listagem de Fichas</h3>
                <div style={{ position: 'relative' }}>
                    <input
                        type="text"
                        placeholder="Pesquisar..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'var(--bg-input)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                            width: 250,
                            fontSize: 13,
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                    />
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '600px' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)' }}>
                            <tr style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-card)' }}>Referência</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-card)' }}>Produto / Decoração</th>
                                <th
                                    onClick={() => handleSort('ciclo')}
                                    style={{ padding: '16px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid var(--border-card)' }}
                                >
                                    Ciclo (s) {sortConfig?.key === 'ciclo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </th>
                                <th
                                    onClick={() => handleSort('consumo')}
                                    style={{ padding: '16px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid var(--border-card)' }}
                                >
                                    Consumo Total {sortConfig?.key === 'consumo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </th>
                                <th
                                    onClick={() => handleSort('custo')}
                                    style={{ padding: '16px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid var(--border-card)' }}
                                >
                                    Custo (1k) {sortConfig?.key === 'custo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </th>
                                <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-card)' }}>Dimensões</th>
                                <th style={{ padding: '16px 20px', textAlign: 'right', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-card)' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((f, i) => {
                                const totalInk = f.cyan + f.magenta + f.yellow + f.black + f.white + f.varnish;
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-card)', transition: 'background 0.2s' }} className="table-row-hover">
                                        <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--primary-bright)' }}>{f.referencia}</td>
                                        <td style={{ padding: '16px 20px' }}>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{f.produto}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.decoracao}</div>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>{f.tempo_s}s</td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>{totalInk.toFixed(2)} ml</span>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                            <span style={{ color: 'var(--info)', fontWeight: 600 }}>{fmtMoeda2(f.custo_tinta_total || 0)}</span>
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'center', fontSize: 12 }}>
                                            {f.largura} x {f.altura} mm
                                        </td>
                                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: 12, borderRadius: 6 }}>Detalhes</button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                {sortedData.length === 0 && (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>Nenhuma ficha técnica encontrada.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
