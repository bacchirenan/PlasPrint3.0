'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import type { ProducaoRow } from '@/lib/types'
import Plot from '@/components/Plot'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MAQ_MAP: Record<string, string> = {
    '28': '28-CX-360G', '29': '29-CX-360G',
    '180': '180- CX-360G', '181': '181- CX-360G', '182': '182- CX-360G',
}
const MAQ_ORDER = ['28', '29', '180', '181', '182']

function cleanMaqKey(name: string) {
    return name.split('-')[0].trim()
}

function fmtN(n: number) {
    return n.toLocaleString('pt-BR')
}

function median(arr: number[]) {
    if (!arr.length) return 0
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const LAYOUT_BASE = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#93b8f0', family: 'inherit', size: 12 },
    margin: { t: 40, b: 50, l: 10, r: 10 },
}

export default function ProducaoPage() {
    const [rows, setRows] = useState<ProducaoRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [dtView, setDtView] = useState<'motivo' | 'maquina'>('motivo')

    // Filtros
    const today = new Date().toISOString().split('T')[0]
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
    })
    const [dateTo, setDateTo] = useState(today)
    const [selMaqs, setSelMaqs] = useState<string[]>(MAQ_ORDER)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/data/producao')
            const json = await res.json()
            if (json.error) throw new Error(json.error)
            setRows(json.data)
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        const selOriginals = selMaqs.map(k => MAQ_MAP[k]).filter(Boolean)
        return rows.filter(r => {
            if (!selOriginals.some(m => r.maquina === m)) return false
            if (r.data < dateFrom || r.data > dateTo) return false
            return true
        })
    }, [rows, selMaqs, dateFrom, dateTo])

    const metrics = useMemo(() => {
        const total = filtered.reduce((a, r) => a + r.producao_total, 0)
        const boas = filtered.reduce((a, r) => a + r.pecas_boas, 0)
        const rej = filtered.reduce((a, r) => a + r.rejeito, 0)
        return { total, boas, rej, pctBoas: total > 0 ? boas / total : 0, pctRej: total > 0 ? rej / total : 0 }
    }, [filtered])

    // ─ Gráfico por Máquina
    const chartByMaq = useMemo(() => {
        const acc: Record<string, number> = {}
        for (const r of filtered) {
            const k = cleanMaqKey(r.maquina)
            acc[k] = (acc[k] || 0) + r.pecas_boas
        }
        const xs = MAQ_ORDER.filter(k => acc[k] !== undefined)
        return { x: xs, y: xs.map(k => acc[k]), text: xs.map(k => fmtN(acc[k])) }
    }, [filtered])

    // ─ Gráfico Diário
    const chartDaily = useMemo(() => {
        const acc: Record<string, number> = {}
        for (const r of filtered) {
            acc[r.data] = (acc[r.data] || 0) + r.pecas_boas
        }
        const dates = Object.keys(acc).sort()
        const ys = dates.map(d => acc[d])
        return { x: dates, y: ys, mediana: median(ys), media: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0 }
    }, [filtered])

    // ─ Gráfico Horário
    const chartHourly = useMemo(() => {
        const acc: Record<number, number> = {}
        for (const r of filtered) {
            acc[r.hora] = (acc[r.hora] || 0) + r.pecas_boas
        }
        const hours = Array.from({ length: 16 }, (_, i) => i + 6)
        return { x: hours, y: hours.map(h => acc[h] || 0) }
    }, [filtered])

    // ─ Gráfico por Operador
    const TARGET_OPS = ['Marcus Vinicius', 'Yuri Franco', 'Diego Matheus', 'Matheus Anzolin']
    const chartByOp = useMemo(() => {
        const acc: Record<string, number> = {}
        for (const r of filtered) {
            if (TARGET_OPS.some(t => r.operador.toLowerCase().includes(t.toLowerCase()))) {
                const k = r.operador.trim()
                acc[k] = (acc[k] || 0) + r.pecas_boas
            }
        }
        const sorted = Object.entries(acc).sort((a, b) => a[1] - b[1])
        return { x: sorted.map(e => e[1]), y: sorted.map(e => e[0]) }
    }, [filtered])

    // ─ Gráfico por Turno
    const chartByShift = useMemo(() => {
        const acc: Record<string, number> = {}
        for (const r of filtered) {
            acc[r.turno] = (acc[r.turno] || 0) + r.pecas_boas
        }
        return { labels: Object.keys(acc), values: Object.values(acc) }
    }, [filtered])

    // ─ Top Produtos
    const chartTopProd = useMemo(() => {
        const acc: Record<string, number> = {}
        for (const r of filtered) {
            if (!r.produto) continue
            const k = r.produto.trim().split(' - ').slice(1).join(' - ').trim() || r.produto.trim()
            acc[k] = (acc[k] || 0) + r.pecas_boas
        }
        const sorted = Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 10).reverse()
        return { x: sorted.map(e => e[1]), y: sorted.map(e => e[0]) }
    }, [filtered])

    // ─ Paradas (downtime)
    const chartDowntime = useMemo(() => {
        const filtStop = filtered.filter(r =>
            r.registro && !r.registro.match(/Produção|0002|0099|0063|0097/i)
        )
        if (dtView === 'motivo') {
            const acc: Record<string, number> = {}
            for (const r of filtStop) {
                acc[r.registro] = (acc[r.registro] || 0) + r.tempo_segundos
            }
            const sorted = Object.entries(acc)
                .map(([reg, sec]) => ({ reg, h: sec / 3600 }))
                .filter(e => e.h > 0)
                .sort((a, b) => a.h - b.h)
                .slice(-15)
            return { mode: 'motivo', x: sorted.map(e => e.h), y: sorted.map(e => e.reg) }
        } else {
            const acc: Record<string, Record<string, number>> = {}
            for (const r of filtStop) {
                const maq = cleanMaqKey(r.maquina)
                if (!acc[maq]) acc[maq] = {}
                acc[maq][r.registro] = (acc[maq][r.registro] || 0) + r.tempo_segundos / 3600
            }
            return { mode: 'maquina', acc }
        }
    }, [filtered, dtView])

    const toggleMaq = (k: string) => {
        setSelMaqs(prev => prev.includes(k) ? prev.filter(m => m !== k) : [...prev, k])
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)' }}>Carregando dados de produção...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="card" style={{ padding: 24 }}>
                <div style={{ color: 'var(--danger)', fontWeight: 700, marginBottom: 8 }}>⚠ Erro ao carregar dados</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{error}</div>
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={load}>Tentar novamente</button>
            </div>
        )
    }

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Título */}
            <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Controle de Produção</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} registros no período selecionado</p>
            </div>

            {/* Filtros */}
            <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>De</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Até</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13 }} />
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Máquinas</label>
                        <div style={{ display: 'flex', gap: 6 }}>
                            {MAQ_ORDER.map(k => (
                                <button key={k}
                                    className={`machine-tab ${selMaqs.includes(k) ? 'active' : ''}`}
                                    onClick={() => toggleMaq(k)}>
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button className="btn btn-secondary" onClick={load} style={{ marginLeft: 'auto' }}>
                        ↻ Atualizar
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {[
                    { label: 'Total Produzido', value: fmtN(metrics.total), color: 'var(--primary-accent)' },
                    { label: 'Peças Boas', value: fmtN(metrics.boas), color: 'var(--success)', sub: `${(metrics.pctBoas * 100).toFixed(1)}%` },
                    { label: 'Rejeitos', value: fmtN(metrics.rej), color: 'var(--danger)', sub: `${(metrics.pctRej * 100).toFixed(1)}%` },
                ].map(card => (
                    <div key={card.label} className="card" style={{ padding: 24 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{card.label}</div>
                        <div style={{ fontSize: 32, fontWeight: 900, color: card.color }}>{card.value}</div>
                        {card.sub && <div style={{ fontSize: 13, color: card.color, marginTop: 4 }}>{card.sub}</div>}
                    </div>
                ))}
            </div>

            {/* Por Máquina */}
            <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Peças Boas por Máquina</div>
                <Plot
                    data={[{
                        type: 'bar', x: chartByMaq.x, y: chartByMaq.y, text: chartByMaq.text,
                        textposition: 'inside', insidetextanchor: 'end', textfont: { color: 'white' },
                        marker: { color: ['#1a335f', '#4466b1', '#00adef', '#09a38c', '#89c153'] }
                    }]}
                    layout={{ ...LAYOUT_BASE, height: 320, yaxis: { visible: false }, showlegend: false }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>

            {/* Produção Diária */}
            <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Produção Diária (Peças Boas)</div>
                <Plot
                    data={[{
                        type: 'bar', x: chartDaily.x, y: chartDaily.y, text: chartDaily.y.map(fmtN),
                        textposition: 'outside', textfont: { color: 'white' },
                        marker: { color: '#00adef' }
                    }]}
                    layout={{
                        ...LAYOUT_BASE, height: 320, yaxis: { visible: false },
                        shapes: [
                            {
                                type: 'line', x0: 0, x1: 1, xref: 'paper', y0: chartDaily.media, y1: chartDaily.media,
                                line: { color: 'white', dash: 'dash', width: 1.5 }
                            },
                            {
                                type: 'line', x0: 0, x1: 1, xref: 'paper', y0: chartDaily.mediana, y1: chartDaily.mediana,
                                line: { color: '#f87171', dash: 'dash', width: 1.5 }
                            },
                        ],
                        annotations: [
                            {
                                xref: 'paper', yref: 'y', x: 0, y: chartDaily.media, xanchor: 'left',
                                text: `Média: ${fmtN(Math.round(chartDaily.media))}`, font: { color: 'white', size: 11 }, showarrow: false
                            },
                            {
                                xref: 'paper', yref: 'y', x: 1, y: chartDaily.mediana, xanchor: 'right',
                                text: `Mediana: ${fmtN(Math.round(chartDaily.mediana))}`, font: { color: '#f87171', size: 11 }, showarrow: false
                            },
                        ],
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>

            {/* Horária + Turnos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Evolução Horária</div>
                    <Plot
                        data={[{
                            type: 'bar', x: chartHourly.x, y: chartHourly.y,
                            marker: { color: '#00adef' }, text: chartHourly.y.map(fmtN),
                            textposition: 'inside', insidetextanchor: 'end', textfont: { color: 'white' }
                        }]}
                        layout={{ ...LAYOUT_BASE, height: 280, yaxis: { visible: false } }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Comparativo de Turnos</div>
                    <Plot
                        data={[{
                            type: 'pie', labels: chartByShift.labels, values: chartByShift.values,
                            hole: 0.5, textinfo: 'percent',
                            marker: { colors: ['#00adef', '#28a745', '#1a335f'], line: { width: 0 } },
                            sort: false, rotation: 180
                        }]}
                        layout={{
                            ...LAYOUT_BASE, height: 280, showlegend: true,
                            legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.1 }
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Operadores */}
            <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Peças Produzidas por Operador</div>
                <Plot
                    data={[{
                        type: 'bar', orientation: 'h', x: chartByOp.x, y: chartByOp.y,
                        text: chartByOp.x.map(fmtN), textposition: 'inside', insidetextanchor: 'end',
                        textfont: { color: 'white' },
                        marker: { color: ['#1a335f', '#4466b1', '#00adef', '#09a38c'] }
                    }]}
                    layout={{ ...LAYOUT_BASE, height: 280, xaxis: { visible: false } }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>

            {/* Top Produtos */}
            <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Top 10 Produtos Mais Fabricados</div>
                <Plot
                    data={[{
                        type: 'bar', orientation: 'h', x: chartTopProd.x, y: chartTopProd.y,
                        text: chartTopProd.x.map(fmtN), textposition: 'inside', insidetextanchor: 'end',
                        textfont: { color: 'white' },
                        marker: { color: chartTopProd.x, colorscale: [[0, '#1a335f'], [0.5, '#00adef'], [1, '#89c153']], showscale: false }
                    }]}
                    layout={{ ...LAYOUT_BASE, height: 420, xaxis: { visible: true } }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>

            {/* Paradas */}
            <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div className="card-title">Análise de Paradas (Downtime)</div>
                    <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }}
                        onClick={() => setDtView(v => v === 'motivo' ? 'maquina' : 'motivo')}>
                        {dtView === 'motivo' ? 'Ver por Máquina ↔' : 'Ver por Motivo ↔'}
                    </button>
                </div>
                {chartDowntime.mode === 'motivo' ? (
                    <Plot
                        data={[{
                            type: 'bar', orientation: 'h',
                            x: chartDowntime.x as number[], y: chartDowntime.y as string[],
                            text: (chartDowntime.x as number[]).map(h => `${h.toFixed(2)} h`),
                            textposition: 'inside', insidetextanchor: 'end', textfont: { color: 'white' },
                            marker: {
                                color: chartDowntime.x as number[],
                                colorscale: [[0, '#4466b1'], [0.5, '#1a335f'], [1, '#f87171']], showscale: false
                            }
                        }]}
                        layout={{ ...LAYOUT_BASE, height: 480, xaxis: { visible: true } }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>
                        Selecione &quot;Por Motivo&quot; para ver o detalhamento por máquina em stacked bar (em desenvolvimento).
                    </div>
                )}
            </div>
        </div>
    )
}
