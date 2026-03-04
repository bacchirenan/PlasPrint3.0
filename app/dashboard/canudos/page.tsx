'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import type { CanudoRow } from '@/lib/types'
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

export default function CanudosPage() {
    const [data, setData] = useState<{ encabecados: CanudoRow[], decorados: CanudoRow[] }>({ encabecados: [], decorados: [] })
    const [loading, setLoading] = useState(true)

    // Filtros
    const today = new Date().toISOString().split('T')[0]
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
    })
    const [dateTo, setDateTo] = useState(today)

    const dateFromPickerRef = useRef<HTMLInputElement>(null)
    const dateToPickerRef = useRef<HTMLInputElement>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setData({ encabecados: [], decorados: [] }) // Limpa o estado para garantir renovação
        try {
            const res = await fetch(`/api/data/canudos?t=${Date.now()}`)
            const json = await res.json()
            setData(json.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const filtered = useMemo(() => {
        const filterFn = (r: CanudoRow) => r.data >= dateFrom && r.data <= dateTo
        return {
            encabecados: data.encabecados.filter(filterFn),
            decorados: data.decorados.filter(filterFn)
        }
    }, [data, dateFrom, dateTo])

    const statsEnc = useMemo(() => {
        const boas = filtered.encabecados.reduce((a, r) => a + r.pecas_boas, 0)
        const perdas = filtered.encabecados.reduce((a, r) => a + r.perdas, 0)
        const total = boas + perdas
        return {
            boas,
            perdas,
            efficiency: total > 0 ? (boas / total) : 0,
            pctPerda: total > 0 ? (perdas / total) : 0
        }
    }, [filtered.encabecados])

    const statsDec = useMemo(() => {
        const boas = filtered.decorados.reduce((a, r) => a + r.pecas_boas, 0)
        const perdas = filtered.decorados.reduce((a, r) => a + r.perdas, 0)
        const total = boas + perdas
        return {
            boas,
            perdas,
            efficiency: total > 0 ? (boas / total) : 0,
            pctPerda: total > 0 ? (perdas / total) : 0
        }
    }, [filtered.decorados])

    const chartByDay = useMemo(() => {
        const acc: Record<string, { boas: number, perdas: number }> = {}
        for (const r of filtered.encabecados) {
            if (!acc[r.data]) acc[r.data] = { boas: 0, perdas: 0 }
            acc[r.data].boas += r.pecas_boas
            acc[r.data].perdas += r.perdas
        }
        const dates = Object.keys(acc).sort()
        return { x: dates, boas: dates.map(d => acc[d].boas), perdas: dates.map(d => acc[d].perdas) }
    }, [filtered.encabecados])

    const chartAverageByShift = useMemo(() => {
        const sums = { 'Turno A': 0, 'Turno B': 0 }
        filtered.encabecados.forEach(r => {
            if (r.turno === 'Turno A') sums['Turno A'] += r.pecas_boas
            else sums['Turno B'] += r.pecas_boas
        })
        const avgA = sums['Turno A'] / 8
        const avgB = sums['Turno B'] / 8
        return {
            x: ['Turno A', 'Turno B'],
            y: [avgA, avgB],
            globalAverage: (avgA + avgB) / 2
        }
    }, [filtered.encabecados])

    if (loading) return <div className="spinner-container"><div className="spinner" /></div>

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Gestão de Canudos</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Monitoramento de produção e controle de perdas</p>
            </div>

            {/* Filtros */}
            <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ position: 'relative' }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Período Inicial</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="text"
                                value={isoToBr(dateFrom)}
                                onChange={e => {
                                    const val = maskDate(e.target.value)
                                    if (val.length === 10) {
                                        const iso = brToIso(val)
                                        if (iso) setDateFrom(iso)
                                    }
                                }}
                                placeholder="dd/mm/aaaa"
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, width: 120, textAlign: 'center' }}
                            />
                            <button
                                className="btn-icon"
                                onClick={() => dateFromPickerRef.current?.showPicker()}
                                style={{ opacity: 0.6 }}
                            >📅</button>
                            <input
                                type="date"
                                ref={dateFromPickerRef}
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                            />
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Período Final</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="text"
                                value={isoToBr(dateTo)}
                                onChange={e => {
                                    const val = maskDate(e.target.value)
                                    if (val.length === 10) {
                                        const iso = brToIso(val)
                                        if (iso) setDateTo(iso)
                                    }
                                }}
                                placeholder="dd/mm/aaaa"
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, width: 120, textAlign: 'center' }}
                            />
                            <button
                                className="btn-icon"
                                onClick={() => dateToPickerRef.current?.showPicker()}
                                style={{ opacity: 0.6 }}
                            >📅</button>
                            <input
                                type="date"
                                ref={dateToPickerRef}
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                            />
                        </div>
                    </div>

                    <button className="btn btn-secondary" onClick={load} style={{ marginLeft: 'auto', height: '38px', borderRadius: 8 }}>↻</button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Total de Canudos Encabeçados</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--success)' }}>{statsEnc.boas.toLocaleString('pt-BR')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Perdas Encabeçados</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--danger)' }}>{statsEnc.perdas.toLocaleString('pt-BR')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Eficiência Global (Encabeçados)</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--info)' }}>{(statsEnc.efficiency * 100).toFixed(2)}%</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>% Perdas Encabeçados</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--warning)' }}>{(statsEnc.pctPerda * 100).toFixed(2)}%</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Total de Canudos Decorados</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--success)' }}>{statsDec.boas.toLocaleString('pt-BR')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Perdas Decorados</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--danger)' }}>{statsDec.perdas.toLocaleString('pt-BR')}</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>Eficiência Global (Decorados)</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--info)' }}>{(statsDec.efficiency * 100).toFixed(2)}%</div>
                </div>
                <div className="card" style={{ padding: '20px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', fontWeight: 600 }}>% Perdas Decorados</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--warning)' }}>{(statsDec.pctPerda * 100).toFixed(2)}%</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                {/* Produção Diária (Seu gráfico existente adaptado para o grid) */}
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Canudos Encabeçados por Dia</div>
                    <Plot
                        data={[
                            {
                                type: 'bar',
                                name: 'Peças Boas',
                                x: chartByDay.x,
                                y: chartByDay.boas,
                                text: chartByDay.boas.map(v => v > 0 ? v.toLocaleString('pt-BR') : ''),
                                textposition: 'outside',
                                textangle: -90,
                                textfont: { family: 'var(--font-primary-local), sans-serif', size: 11, color: '#fff' },
                                marker: { color: '#00adef' },
                                cliponaxis: false
                            },
                        ]}
                        layout={{
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            height: 380,
                            font: { family: 'var(--font-primary-local), sans-serif', color: '#93b8f0' },
                            margin: { t: 60, b: 60, l: 40, r: 20 },
                            xaxis: { tickfont: { family: 'var(--font-primary-local), sans-serif', size: 11, color: '#fff' } },
                            yaxis: { visible: false, range: [0, Math.max(...chartByDay.boas, 10) * 1.3] }
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* NOVO: Média de Peças por Hora (Por Turno) */}
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Canudos Encabeçados por Hora</div>
                    <Plot
                        data={[
                            {
                                type: 'bar',
                                x: chartAverageByShift.x,
                                y: chartAverageByShift.y,
                                text: chartAverageByShift.y.map(v => Math.round(v).toLocaleString('pt-BR')),
                                textposition: 'outside',
                                marker: { color: ['#00adef', '#1a335f'] },
                                textfont: { family: 'var(--font-primary-local), sans-serif', size: 13, color: '#fff' },
                                cliponaxis: false
                            }
                        ]}
                        layout={{
                            paper_bgcolor: 'transparent',
                            plot_bgcolor: 'transparent',
                            height: 380,
                            font: { family: 'var(--font-primary-local), sans-serif', color: '#93b8f0' },
                            margin: { t: 40, b: 40, l: 40, r: 20 },
                            xaxis: {
                                tickfont: { family: 'var(--font-primary-local), sans-serif', size: 12, color: '#fff' }
                            },
                            yaxis: {
                                visible: false,
                                range: [0, Math.max(...chartAverageByShift.y, 10) * 1.3]
                            },
                            shapes: [
                                {
                                    type: 'line',
                                    x0: 0,
                                    x1: 1,
                                    xref: 'paper',
                                    y0: chartAverageByShift.globalAverage,
                                    y1: chartAverageByShift.globalAverage,
                                    line: { color: 'rgba(255,255,255,0.4)', dash: 'dash', width: 2 }
                                }
                            ],
                            annotations: [
                                {
                                    xref: 'paper',
                                    yref: 'y',
                                    x: 1,
                                    y: chartAverageByShift.globalAverage,
                                    xanchor: 'right',
                                    yanchor: 'bottom',
                                    text: `Média Global: ${Math.round(chartAverageByShift.globalAverage).toLocaleString('pt-BR')}`,
                                    font: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 11 },
                                    showarrow: false,
                                    yshift: 5
                                }
                            ]
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

        </div>
    )
}
