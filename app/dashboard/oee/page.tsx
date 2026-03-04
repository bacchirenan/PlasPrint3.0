'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import type { OeeRow } from '@/lib/types'
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

function fmtP(n: number) {
    return (n * 100).toFixed(2) + '%'
}

const LAYOUT_BASE = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#93b8f0', family: 'inherit', size: 11 },
    margin: { t: 40, b: 50, l: 40, r: 20 },
}

export default function OeePage() {
    const [rows, setRows] = useState<OeeRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

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
            const res = await fetch('/api/data/oee')
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
        if (!filtered.length) return { oee: 0, teep: 0 }

        // OEE Médio: Excluir M29 conforme regra de negócio
        const no29 = filtered.filter(r => !r.maquina.includes('29-CX'))
        const oeeSum = no29.reduce((a, r) => a + (isNaN(r.oee) ? 0 : r.oee), 0)
        const oeeCount = no29.filter(r => !isNaN(r.oee)).length

        // TEEP Médio: Inclui todas as máquinas, ignora NaN (paradas previstas)
        const teepSum = filtered.reduce((a, r) => a + (isNaN(r.teep) ? 0 : r.teep), 0)
        const teepCount = filtered.filter(r => !isNaN(r.teep)).length

        return {
            oee: oeeCount > 0 ? oeeSum / oeeCount : 0,
            teep: teepCount > 0 ? teepSum / teepCount : 0,
        }
    }, [filtered])

    // ─ Gráfico Evolução Temporal
    const chartTimeline = useMemo(() => {
        const daily: Record<string, { oeeSum: number, oeeCount: number, teepSum: number, teepCount: number }> = {}
        for (const r of filtered) {
            if (!daily[r.data]) daily[r.data] = { oeeSum: 0, oeeCount: 0, teepSum: 0, teepCount: 0 }
            if (!isNaN(r.oee)) {
                daily[r.data].oeeSum += r.oee
                daily[r.data].oeeCount++
            }
            daily[r.data].teepSum += r.teep
            daily[r.data].teepCount++
        }
        const dates = Object.keys(daily).sort()
        return {
            x: dates,
            oee: dates.map(d => daily[d].oeeCount > 0 ? daily[d].oeeSum / daily[d].oeeCount : 0),
            teep: dates.map(d => daily[d].teepCount > 0 ? daily[d].teepSum / daily[d].teepCount : 0),
        }
    }, [filtered])

    // ─ Gráfico por Hora
    const chartHourly = useMemo(() => {
        const hourly: Record<number, { oeeSum: number, oeeCount: number, teepSum: number, teepCount: number }> = {}
        for (const r of filtered) {
            if (!hourly[r.hora]) hourly[r.hora] = { oeeSum: 0, oeeCount: 0, teepSum: 0, teepCount: 0 }
            if (!isNaN(r.oee)) {
                hourly[r.hora].oeeSum += r.oee
                hourly[r.hora].oeeCount++
            }
            hourly[r.hora].teepSum += r.teep
            hourly[r.hora].teepCount++
        }
        const hours = Array.from({ length: 24 }, (_, i) => i).filter(h => hourly[h])
        return {
            x: hours,
            oee: hours.map(h => hourly[h].oeeCount > 0 ? hourly[h].oeeSum / hourly[h].oeeCount : 0),
            teep: hours.map(h => hourly[h].teepCount > 0 ? hourly[h].teepSum / hourly[h].teepCount : 0),
        }
    }, [filtered])

    // ─ Gráfico por Máquina
    const chartByMaq = useMemo(() => {
        const acc: Record<string, { oeeSum: number, oeeCount: number }> = {}
        for (const r of filtered) {
            const k = cleanMaqKey(r.maquina)
            if (!acc[k]) acc[k] = { oeeSum: 0, oeeCount: 0 }
            if (!isNaN(r.oee)) {
                acc[k].oeeSum += r.oee
                acc[k].oeeCount++
            }
        }
        const xs = MAQ_ORDER.filter(k => acc[k])
        return { x: xs, y: xs.map(k => acc[k].oeeCount > 0 ? acc[k].oeeSum / acc[k].oeeCount : 0) }
    }, [filtered])

    // ─ Heatmap de OEE
    const chartHeatmap = useMemo(() => {
        const acc: Record<number, Record<string, number>> = {}
        const dates = new Set<string>()
        for (const r of filtered) {
            if (!acc[r.hora]) acc[r.hora] = {}
            if (!isNaN(r.oee)) {
                acc[r.hora][r.data] = r.oee
                dates.add(r.data)
            }
        }
        const sortedDates = Array.from(dates).sort()
        const sortedHours = Object.keys(acc).map(Number).sort((a, b) => a - b)

        const z = sortedHours.map(h => sortedDates.map(d => (acc[h][d] || 0) * 100))

        return { x: sortedDates, y: sortedHours, z }
    }, [filtered])

    const toggleMaq = (k: string) => {
        setSelMaqs(prev => prev.includes(k) ? prev.filter(m => m !== k) : [...prev, k])
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)' }}>Analisando indicadores de eficiência...</p>
            </div>
        )
    }

    return (
        <div className="page-container" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            width: '100%',
            maxWidth: '1400px',
            margin: '0 auto',
            padding: '0 20px' // Mesma borda da Navbar
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Indicadores de Eficiência</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Análise detalhada de OEE e TEEP por máquina, turno e horário</p>
                </div>
                <button className="btn btn-secondary" onClick={load} style={{ height: 40, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>↻</button>
            </div>

            {/* Filtros / Menu Bar */}
            <div className="card" style={{ padding: '20px', width: '100%' }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 auto', minWidth: '280px' }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Período de Análise</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, flex: 1, minWidth: '130px' }} />
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>até</span>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, flex: 1, minWidth: '130px' }} />
                        </div>
                    </div>

                    <div style={{ flex: '2 1 auto', minWidth: '300px' }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Seleção de Máquinas</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {MAQ_ORDER.map(k => (
                                <button key={k}
                                    style={{ padding: '8px 16px', fontSize: 12, borderRadius: 8, fontWeight: 600, transition: 'all 0.2s' }}
                                    className={`machine-tab ${selMaqs.includes(k) ? 'active' : ''}`}
                                    onClick={() => toggleMaq(k)}>
                                    {k}
                                </button>
                            ))}
                            <button
                                onClick={() => setSelMaqs(selMaqs.length === MAQ_ORDER.length ? [] : MAQ_ORDER)}
                                style={{ padding: '8px 12px', fontSize: 11, color: 'var(--primary-accent)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                {selMaqs.length === MAQ_ORDER.length ? 'DESELECIONAR TODAS' : 'SELECIONAR TODAS'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>OEE Médio</div>
                    <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--primary-accent)' }}>{fmtP(metrics.oee)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Indústria (Exclui M29)</div>
                </div>
                <div className="card" style={{ padding: 24, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>TEEP Médio</div>
                    <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--info)' }}>{fmtP(metrics.teep)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Tempo Calendário Total</div>
                </div>
            </div>

            {/* Evolução Temporal */}
            <div className="card" style={{ padding: 20 }}>
                <div className="card-title">Evolução Temporal OEE e TEEP</div>
                <Plot
                    data={[
                        { type: 'scatter', mode: 'lines+markers', name: 'OEE', x: chartTimeline.x, y: chartTimeline.oee, line: { color: '#4466b1', width: 3 }, marker: { size: 6 } },
                        { type: 'scatter', mode: 'lines+markers', name: 'TEEP', x: chartTimeline.x, y: chartTimeline.teep, line: { color: '#00adef', width: 3 }, marker: { size: 6 } },
                    ]}
                    layout={{ ...LAYOUT_BASE, height: 350, yaxis: { tickformat: '.0%', range: [0, 1.1] }, legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.2 } }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
                {/* OEE por Hora */}
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title">Eficiência por Horário</div>
                    <Plot
                        data={[
                            { type: 'bar', name: 'OEE', x: chartHourly.x, y: chartHourly.oee, marker: { color: '#4466b1' } },
                            { type: 'bar', name: 'TEEP', x: chartHourly.x, y: chartHourly.teep, marker: { color: '#00adef' } },
                        ]}
                        layout={{ ...LAYOUT_BASE, barmode: 'group', height: 320, yaxis: { tickformat: '.0%' }, xaxis: { tickmode: 'linear', dtick: 1 } }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* OEE por Máquina */}
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title">OEE por Máquina</div>
                    <Plot
                        data={[{
                            type: 'bar', x: chartByMaq.x, y: chartByMaq.y,
                            text: chartByMaq.y.map(fmtP), textposition: 'auto',
                            marker: { color: ['#1a335f', '#4466b1', '#00adef', '#09a38c', '#89c153'] }
                        }]}
                        layout={{ ...LAYOUT_BASE, height: 320, yaxis: { visible: false } }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Heatmap */}
            <div className="card" style={{ padding: 20 }}>
                <div className="card-title">Mapa de Calor: Consistência de OEE</div>
                <Plot
                    data={[{
                        type: 'heatmap',
                        x: chartHeatmap.x,
                        y: chartHeatmap.y,
                        z: chartHeatmap.z,
                        colorscale: [[0, '#0a1929'], [0.2, '#1a335f'], [0.5, '#4466b1'], [0.8, '#09a38c'], [1, '#89c153']],
                        zmin: 0, zmax: 100,
                        hovertemplate: 'Data: %{x}<br>Hora: %{y}h<br>OEE: %{z:.1f}%<extra></extra>'
                    }]}
                    layout={{ ...LAYOUT_BASE, height: 450, xaxis: { tickangle: -45 }, yaxis: { title: 'Hora', dtick: 1 } }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>
        </div>
    )
}
