'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import type { FichaTecnica } from '@/lib/types'
import Plot from '@/components/Plot'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isoToBr(iso: string) {
    if (!iso || iso.length !== 10) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
}

function brToIso(br: string) {
    const clean = br.replace(/\D/g, '')
    if (clean.length !== 8) return ''
    return `${clean.slice(4)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`
}

function maskDate(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

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
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null)

    // Filtros de Data
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const [dateFrom, setDateFrom] = useState('2024-01-01') // Range inicial maior para fichas
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])

    const dateFromPickerRef = useRef<HTMLInputElement>(null)
    const dateToPickerRef = useRef<HTMLInputElement>(null)

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
        let result = fichas.filter(f => {
            // Filtro de Busca
            const matchesSearch = f.referencia.toLowerCase().includes(search.toLowerCase()) ||
                f.produto.toLowerCase().includes(search.toLowerCase())
            if (!matchesSearch) return false

            // Filtro de Data (data_cadastro)
            if (f.data_cadastro) {
                const fDate = f.data_cadastro.includes(' ') ? f.data_cadastro.split(' ')[0] : f.data_cadastro
                if (fDate < dateFrom || fDate > dateTo) return false
            }

            return true
        })

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
    }, [fichas, search, sortConfig, dateFrom, dateTo])

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800 }}>Fichas Técnicas</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gestão de referências, consumos de tinta e tempos de ciclo</p>
                </div>


            </div>

            {/* --- SEÇÃO ANÁLISE FINANCEIRA (AGORA NO TOPO) --- */}
            {metrics && (
                <div style={{ marginBottom: 20 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Análise Financeira</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 20 }}>
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

                    {config !== null && (
                        <p style={{ 
                            fontSize: '0.9rem', 
                            color: 'var(--text-muted)', 
                            marginBottom: 24,
                            padding: '0 10px',
                            borderLeft: '3px solid var(--primary-bright)'
                        }}>
                            Os custos apresentados já contemplam o imposto de importação de <strong>{(config?.imposto ?? 0).toFixed(2)}%</strong> configurado no sistema.
                        </p>
                    )}

                    <div className="card" style={{ padding: '20px', marginBottom: 24 }}>
                        <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Top 10: Produtos com Maior Custo (1.000 un.)</h4>
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
                                margin: { l: 200, r: 20, t: 10, b: 30 }, // Ajustado margem esquerda para nomes maiores
                                font: { family: 'var(--font-primary-local), sans-serif' },
                                paper_bgcolor: 'transparent',
                                plot_bgcolor: 'transparent',
                                showlegend: false,
                                xaxis: { showgrid: false, zeroline: false, showticklabels: false },
                                yaxis: {
                                    tickfont: { size: 10, color: '#fff', family: 'var(--font-primary-local), sans-serif' },
                                    tickpadding: 10,
                                    automargin: true
                                }
                            }}
                            config={{ displayModeBar: false, responsive: true }}
                            style={{ width: '100%' }}
                        />
                    </div>
                </div>
            )}

            {/* --- SEÇÃO PERFORMANCE E CONSUMO --- */}
            {performanceMetrics && (
                <div style={{ marginBottom: 20, paddingTop: 0 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Análise de Performance e Consumo</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 30 }}>
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

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))', gap: 24 }}>
                        <div className="card" style={{ padding: '24px' }}>
                            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Distribuição de Tintas por Cor (%)</h4>
                            <Plot
                                data={[{
                                    values: ['cyan', 'magenta', 'yellow', 'black', 'white', 'varnish'].map(c => performanceMetrics.totalsByColor[c] || 0),
                                    labels: ['Cyan', 'Magenta', 'Yellow', 'Black', 'White', 'Varnish'],
                                    type: 'pie',
                                    hole: 0.4,
                                    marker: {
                                        colors: ['#00FFFF', '#FF00FF', '#FFFF00', '#000000', '#FFFFFF', '#d9b38c']
                                    },
                                    textinfo: 'label+percent',
                                    textposition: 'inside',
                                    insidetextfont: {
                                        family: 'var(--font-primary-local), sans-serif',
                                        color: ['#000', '#fff', '#000', '#fff', '#000', '#fff'],
                                        size: 11
                                    },
                                    showlegend: true
                                }]}
                                layout={{
                                    height: 380,
                                    margin: { t: 20, b: 20, l: 0, r: 0 },
                                    paper_bgcolor: 'transparent',
                                    font: { family: 'var(--font-primary-local), sans-serif', color: '#fff' },
                                    legend: { font: { family: 'var(--font-primary-local), sans-serif', color: '#fff' }, orientation: 'h', x: 0, y: -0.1 }
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
                                    textfont: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 10 },
                                    marker: {
                                        colors: ['#1e3a8a', '#1e40af', '#3b82f6', '#60a5fa', '#93c5fd', '#34d399', '#10b981', '#059669', '#047857', '#065f46']
                                    },
                                    showlegend: true
                                }]}
                                layout={{
                                    height: 350,
                                    margin: { t: 0, b: 0, l: 0, r: 0 },
                                    paper_bgcolor: 'transparent',
                                    font: { family: 'var(--font-primary-local), sans-serif', color: '#fff' },
                                    legend: { font: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 10 }, x: 0, y: -0.3, orientation: 'h' }
                                }}
                                config={{ displayModeBar: false, responsive: true }}
                                style={{ width: '100%' }}
                            />
                        </div>
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
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '670px' }}>
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-card)' }}>
                            <tr style={{ background: 'rgba(59, 130, 246, 0.05)' }}>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-card)' }}>Referência</th>
                                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-card)' }}>Produto / Decoração</th>
                                <th
                                    onClick={() => handleSort('ciclo')}
                                    style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid var(--border-card)' }}
                                >
                                    Ciclo (s) {sortConfig?.key === 'ciclo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </th>
                                <th
                                    onClick={() => handleSort('consumo')}
                                    style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid var(--border-card)' }}
                                >
                                    Consumo Total {sortConfig?.key === 'consumo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </th>
                                <th
                                    onClick={() => handleSort('custo')}
                                    style={{ padding: '12px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', userSelect: 'none', borderBottom: '1px solid var(--border-card)' }}
                                >
                                    Custo (1k) {sortConfig?.key === 'custo' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedData.map((f, i) => {
                                const totalInk = f.cyan + f.magenta + f.yellow + f.black + f.white + f.varnish;
                                return (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-card)', transition: 'background 0.2s' }} className="table-row-hover">
                                        <td style={{ padding: '12px 20px', fontSize: 13, fontWeight: 600 }}>{f.referencia}</td>
                                        <td style={{ padding: '12px 20px' }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary-bright)' }}>{f.produto}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{f.decoracao}</div>
                                        </td>
                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: 13 }}>{f.tempo_s}s</td>
                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{totalInk.toFixed(2)} ml</td>
                                        <td style={{ padding: '12px 20px', textAlign: 'center', fontSize: 13, color: 'var(--info)', fontWeight: 600 }}>{fmtMoeda2(f.custo_tinta_total || 0)}</td>
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
