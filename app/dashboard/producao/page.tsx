'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import type { ProducaoRow } from '@/lib/types'
import Plot from '@/components/Plot'

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Converte yyyy-mm-dd → dd/mm/aaaa (exibição)
function isoToBr(iso: string) {
    if (!iso || iso.length !== 10) return ''
    const [y, m, d] = iso.split('-')
    return `${d}/${m}/${y}`
}

// Converte dd/mm/aaaa → yyyy-mm-dd (interno)
function brToIso(br: string) {
    const clean = br.replace(/\D/g, '')
    if (clean.length !== 8) return ''
    return `${clean.slice(4)}-${clean.slice(2, 4)}-${clean.slice(0, 2)}`
}

// Aplica máscara dd/mm/aaaa enquanto digita
function maskDate(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 8)
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}
const MAQ_MAP: Record<string, string> = {
    '28': '28-CX-360G', '29': '29-CX-360G',
    '180': '180-CX-360G', '181': '181-CX-360G', '182': '182-CX-360G',
}

// Helper para normalizar nomes de máquinas (remove espaços e poe em upper)
function normMaq(m: string) {
    return (m || '').replace(/\s+/g, '').toUpperCase()
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
    font: {
        color: '#93b8f0',
        family: 'var(--font-primary-local), sans-serif',
        size: 12
    },
    margin: { t: 40, b: 50, l: 10, r: 10 },
}

export default function ProducaoPage() {
    const [rows, setRows] = useState<ProducaoRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [dtView, setDtView] = useState<'motivo' | 'maquina'>('motivo')

    // Refs para os date pickers ocultos
    const dateFromPickerRef = useRef<HTMLInputElement>(null)
    const dateToPickerRef = useRef<HTMLInputElement>(null)

    // Filtros
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const [dateFrom, setDateFrom] = useState(yesterday)
    const [dateTo, setDateTo] = useState(yesterday)
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
        const selNorms = selMaqs.map(k => normMaq(MAQ_MAP[k])).filter(Boolean)
        const result = rows.filter(r => {
            if (!selNorms.includes(normMaq(r.maquina))) return false
            if (r.data < dateFrom || r.data > dateTo) return false
            return true
        })
        return result
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
            // Usa o nome completo da máquina conforme mapeado ou original
            const k = r.maquina.trim()
            acc[k] = (acc[k] || 0) + r.pecas_boas
        }

        // Ordena conforme MAQ_ORDER para manter consistência
        const sortedFullNames = MAQ_ORDER.map(k => MAQ_MAP[k])

        return {
            x: sortedFullNames,
            y: sortedFullNames.map(name => acc[name] || 0),
            text: sortedFullNames.map(name => fmtN(acc[name] || 0))
        }
    }, [filtered])

    // ─ Gráfico Diário
    const chartDaily = useMemo(() => {
        const acc: Record<string, number> = {}
        for (const r of filtered) {
            acc[r.data] = (acc[r.data] || 0) + r.pecas_boas
        }
        const datesIso = Object.keys(acc).sort()
        const ys = datesIso.map(d => acc[d])

        // Formatar datas para dd/mm (remover ano)
        const datesDisplay = datesIso.map(d => {
            const [, m, day] = d.split('-')
            return `${day}/${m}`
        })

        return {
            x: datesDisplay,
            y: ys,
            media: ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0
        }
    }, [filtered])

    // ─ Gráfico Horas Produzidas por Máquina (Média Diária)
    const chartProducedHours = useMemo(() => {
        const acc: Record<string, Record<string, number>> = {} // { data: { maq: segundos } }
        const dates = new Set<string>()

        for (const r of filtered) {
            if (r.registro.toLowerCase().includes('produção')) {
                if (!acc[r.data]) acc[r.data] = {}
                acc[r.data][r.maquina] = (acc[r.data][r.maquina] || 0) + r.tempo_segundos
                dates.add(r.data)
            }
        }

        const nDays = dates.size || 1
        const totals: Record<string, number> = {}
        for (const d of Array.from(dates)) {
            for (const m in acc[d]) {
                totals[m] = (totals[m] || 0) + acc[d][m]
            }
        }

        const activeMaqs = MAQ_ORDER.filter(k => selMaqs.includes(k))
        const yValues = activeMaqs.map(k => {
            const name = normMaq(MAQ_MAP[k])
            let total = 0
            for (const mName in totals) {
                if (normMaq(mName) === name) total += totals[mName]
            }
            return total / (3600 * nDays)
        })

        return {
            x: activeMaqs.map(cleanMaqKey),
            y: yValues,
            text: yValues.map(v => v.toFixed(1)),
            avg: yValues.length ? yValues.reduce((a, b) => a + b, 0) / yValues.length : 0
        }
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
            if (!r.produto || r.produto.toUpperCase().includes('SEM PECA')) continue
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
                .filter(e => e.h >= 1) // Apenas paradas com 1h ou mais no total
                .sort((a, b) => a.h - b.h)
                .slice(-15)
            return { mode: 'motivo', x: sorted.map(e => e.h), y: sorted.map(e => e.reg) }
        } else {
            const acc: Record<string, Record<string, number>> = {}
            const totalByReason: Record<string, number> = {}
            for (const r of filtStop) {
                const maq = cleanMaqKey(r.maquina)
                const hours = r.tempo_segundos / 3600
                if (!acc[maq]) acc[maq] = {}
                acc[maq][r.registro] = (acc[maq][r.registro] || 0) + hours
                totalByReason[r.registro] = (totalByReason[r.registro] || 0) + hours
            }
            const reasons = Object.entries(totalByReason)
                .filter(([_, h]) => h >= 1) // Apenas motivos com 1h ou mais no total acumulado
                .map(([reg]) => reg)
                .sort()
            return { mode: 'maquina', acc, reasons }
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
                <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Controle de Produção <span style={{ opacity: 0.3, fontSize: 12 }}>(v2.0.1)</span></h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{filtered.length} registros no período selecionado</p>
            </div>

            {/* Filtros */}
            <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>De</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="dd/mm/aaaa"
                                value={isoToBr(dateFrom)}
                                onChange={e => {
                                    const masked = maskDate(e.target.value)
                                    const iso = brToIso(masked)
                                    if (iso) setDateFrom(iso)
                                }}
                                maxLength={10}
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px 0 0 8px', borderRight: 'none', color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, width: 112, outline: 'none' }} />
                            <button
                                onClick={() => dateFromPickerRef.current?.showPicker()}
                                title="Abrir calendário"
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 8px 8px 0', color: 'var(--text-muted)', padding: '8px 10px', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>
                                📅
                            </button>
                            <input
                                ref={dateFromPickerRef}
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none', top: 0, right: 0 }} />
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Até</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="dd/mm/aaaa"
                                value={isoToBr(dateTo)}
                                onChange={e => {
                                    const masked = maskDate(e.target.value)
                                    const iso = brToIso(masked)
                                    if (iso) setDateTo(iso)
                                }}
                                maxLength={10}
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px 0 0 8px', borderRight: 'none', color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, width: 112, outline: 'none' }} />
                            <button
                                onClick={() => dateToPickerRef.current?.showPicker()}
                                title="Abrir calendário"
                                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderLeft: 'none', borderRadius: '0 8px 8px 0', color: 'var(--text-muted)', padding: '8px 10px', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}>
                                📅
                            </button>
                            <input
                                ref={dateToPickerRef}
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none', top: 0, right: 0 }} />
                        </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {[
                    { label: 'Total Peças', value: fmtN(metrics.total), color: 'var(--primary-bright)' },
                    { label: 'Peças Boas', value: fmtN(metrics.boas), color: 'var(--success)' },
                    { label: 'Rejeitos', value: fmtN(metrics.rej), color: 'var(--danger)' },
                    { label: '% Boas', value: `${(metrics.pctBoas * 100).toFixed(1)}%`, color: 'var(--success)' },
                    { label: '% Rejeitos', value: `${(metrics.pctRej * 100).toFixed(1)}%`, color: 'var(--danger)' },
                ].map(card => (
                    <div key={card.label} className="card" style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2, fontWeight: 700 }}>{card.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: card.color }}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Por Máquina */}
            <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Peças Boas por Máquina</div>
                <Plot
                    data={[{
                        type: 'bar',
                        x: chartByMaq.x,
                        y: chartByMaq.y,
                        text: chartByMaq.text,
                        textposition: 'outside',
                        textfont: {
                            color: '#fff',
                            weight: 800,
                            family: 'var(--font-primary-local), sans-serif',
                            size: 13
                        },
                        marker: {
                            color: ['#1a335f', '#1a335f', '#00adef', '#09a38c', '#89c153'],
                            line: { width: 0 }
                        },
                        cliponaxis: false
                    }]}
                    layout={{
                        ...LAYOUT_BASE,
                        height: 380,
                        yaxis: { visible: false, range: [0, Math.max(...chartByMaq.y, 10) * 1.15] },
                        xaxis: {
                            title: {
                                text: 'Máquina',
                                font: { size: 14, color: '#fff', family: 'var(--font-primary-local), sans-serif' },
                                standoff: 25
                            },
                            tickfont: { size: 10, color: '#fff', weight: 700, family: 'var(--font-primary-local), sans-serif' }
                        },
                        showlegend: false,
                        margin: { t: 50, b: 80, l: 40, r: 40 }
                    }}
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
                        textposition: 'outside',
                        textfont: { color: 'white', family: 'var(--font-primary-local), sans-serif' },
                        marker: { color: '#00adef' },
                        cliponaxis: false
                    }]}
                    layout={{
                        ...LAYOUT_BASE, height: 320,
                        yaxis: { visible: false, range: [0, Math.max(...chartDaily.y, 10) * 1.25] },
                        xaxis: {
                            tickfont: { family: 'var(--font-primary-local), sans-serif', size: 11 },
                            type: 'category'
                        },
                        margin: { t: 40, b: 40, l: 20, r: 20 },
                        shapes: [
                            {
                                type: 'line', x0: 0, x1: 1, xref: 'paper', y0: chartDaily.media, y1: chartDaily.media,
                                line: { color: 'rgba(255,255,255,0.4)', dash: 'dash', width: 1.5 }
                            }
                        ],
                        annotations: [
                            {
                                xref: 'paper', yref: 'y', x: 1, y: chartDaily.media,
                                xanchor: 'right', yanchor: 'top',
                                text: `Média: ${fmtN(Math.round(chartDaily.media))}`,
                                font: { color: 'rgba(255,255,255,0.6)', size: 11, family: 'var(--font-primary-local), sans-serif' },
                                showarrow: false,
                                yshift: -5
                            }
                        ],
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>

            {/* Horária + Turnos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Evolução Horária</div>
                    <Plot
                        data={[{
                            type: 'bar', x: chartHourly.x, y: chartHourly.y,
                            marker: { color: '#00adef' }, text: chartHourly.y.map(fmtN),
                            textposition: 'inside', insidetextanchor: 'end',
                            textfont: { color: 'white', family: 'var(--font-primary-local), sans-serif', weight: 800 }
                        }]}
                        layout={{
                            ...LAYOUT_BASE,
                            height: 280,
                            yaxis: { visible: false },
                            xaxis: {
                                tickmode: 'array',
                                tickvals: chartHourly.x,
                                tickfont: { family: 'var(--font-primary-local), sans-serif', size: 10, color: '#fff' }
                            },
                            margin: { t: 20, b: 40, l: 20, r: 20 }
                        }}
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
                            marker: { colors: ['#00adef', '#09a38c', '#1a335f'], line: { width: 0 } },
                            textfont: { family: 'var(--font-primary-local), sans-serif', color: '#fff' },
                            sort: false, rotation: 180
                        }]}
                        layout={{
                            ...LAYOUT_BASE, height: 280, showlegend: true,
                            legend: {
                                orientation: 'h', x: 0.5, xanchor: 'center', y: -0.1,
                                font: { family: 'var(--font-primary-local), sans-serif', color: '#fff' }
                            }
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Operadores e Top Produtos Lado a Lado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Operadores */}
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Peças Produzidas por Operador</div>
                    <Plot
                        data={[{
                            type: 'bar', x: chartByOp.y.map(s => s.replace(' - ', '<br>')), y: chartByOp.x,
                            text: chartByOp.x.map(fmtN), textposition: 'outside',
                            textfont: { color: 'white', family: 'var(--font-primary-local), sans-serif', weight: 800, size: 10 },
                            marker: { color: ['#1a335f', '#4466b1', '#00adef', '#09a38c'] },
                            cliponaxis: false
                        }]}
                        layout={{
                            ...LAYOUT_BASE, height: 420,
                            yaxis: { visible: false, range: [0, Math.max(...chartByOp.x, 10) * 1.25] },
                            xaxis: {
                                tickfont: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 9 },
                                tickangle: 0,
                                automargin: true
                            },
                            margin: { t: 40, b: 60, l: 40, r: 40 }
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Top Produtos */}
                <div className="card" style={{ padding: 20 }}>
                    <div className="card-title" style={{ marginBottom: 16 }}>Top 10 Produtos Mais Fabricados</div>
                    <Plot
                        data={[{
                            type: 'bar', x: chartTopProd.y.map(s => s.length > 15 ? s.substring(0, 15) + '...' : s), y: chartTopProd.x,
                            text: chartTopProd.x.map(fmtN), textposition: 'outside',
                            textfont: { color: 'white', family: 'var(--font-primary-local), sans-serif', weight: 800, size: 9 },
                            marker: { color: chartTopProd.x, colorscale: [[0, '#1a335f'], [0.5, '#00adef'], [1, '#89c153']], showscale: false },
                            cliponaxis: false
                        }]}
                        layout={{
                            ...LAYOUT_BASE, height: 450,
                            yaxis: { visible: false, range: [0, Math.max(...chartTopProd.x, 10) * 1.3] },
                            xaxis: {
                                tickfont: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 8 },
                                tickangle: 0,
                                automargin: true
                            },
                            margin: { t: 40, b: 60, l: 40, r: 40 }
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            {/* Paradas */}
            <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div className="card-title">Análise de Paradas (Downtime)</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className={`btn ${dtView === 'motivo' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '4px 12px' }}
                            onClick={() => setDtView('motivo')}>
                            Por Motivo
                        </button>
                        <button className={`btn ${dtView === 'maquina' ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '4px 12px' }}
                            onClick={() => setDtView('maquina')}>
                            Por Máquina
                        </button>
                    </div>
                </div>
                {dtView === 'motivo' ? (
                    <Plot
                        data={[{
                            type: 'bar',
                            x: (chartDowntime.y as string[]).map(s => s.length > 12 ? s.substring(0, 12) + '...' : s), y: chartDowntime.x as number[],
                            text: (chartDowntime.x as number[]).map(h => `${h.toFixed(2)}h`),
                            textposition: 'outside',
                            textfont: { color: 'white', family: 'var(--font-primary-local), sans-serif', weight: 800, size: 10 },
                            marker: {
                                color: chartDowntime.x as number[],
                                colorscale: [[0, '#4466b1'], [0.5, '#1a335f'], [1, '#f87171']], showscale: false
                            },
                            cliponaxis: false
                        }]}
                        layout={{
                            ...LAYOUT_BASE, height: 500,
                            yaxis: { visible: false, range: [0, Math.max(...(chartDowntime.x as number[]), 1) * 1.3] },
                            xaxis: {
                                tickfont: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 8.5 },
                                tickangle: 0,
                                automargin: true
                            },
                            margin: { t: 40, b: 60, l: 40, r: 40 }
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                ) : (
                    <Plot
                        data={(chartDowntime.reasons || []).map((reason, idx) => {
                            const colors = [
                                '#7c4dff', '#00796b', '#00acc1', '#2e7d32', '#546e7a',
                                '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6',
                                '#06b6d4', '#10b981', '#fbbf24', '#f87171', '#a855f7',
                                '#6366f1', '#14b8a6', '#f97316', '#d946ef', '#4ade80'
                            ]
                            return {
                                type: 'bar',
                                name: reason,
                                x: MAQ_ORDER.map(k => MAQ_MAP[k]),
                                y: MAQ_ORDER.map(k => (chartDowntime.acc as any)[k]?.[reason] || 0),
                                text: MAQ_ORDER.map(k => {
                                    const val = (chartDowntime.acc as any)[k]?.[reason] || 0
                                    return val > 0.05 ? `${val.toFixed(2)} h` : ''
                                }),
                                textposition: 'inside',
                                textfont: { color: 'white', family: 'var(--font-primary-local), sans-serif', weight: 800, size: 9 },
                                marker: { color: colors[idx % colors.length], line: { width: 0 } },
                            }
                        })}
                        layout={{
                            ...LAYOUT_BASE,
                            height: 520,
                            barmode: 'stack',
                            showlegend: true,
                            legend: {
                                orientation: 'h', x: 0.5, xanchor: 'center', y: -0.3,
                                font: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 9 },
                                title: { text: 'Motivo da Parada', font: { family: 'var(--font-primary-local), sans-serif', size: 11, color: '#93b8f0' } }
                            },
                            xaxis: {
                                title: { text: 'Máquina', font: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 12 } },
                                tickfont: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 10 }
                            },
                            yaxis: {
                                title: { text: 'Horas Paradas', font: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 12 } },
                                tickfont: { family: 'var(--font-primary-local), sans-serif', color: '#fff', size: 10 },
                                gridcolor: 'rgba(255,255,255,0.05)'
                            },
                            margin: { t: 40, b: 120, l: 60, r: 40 }
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                )}
            </div>
        </div>
    )
}
