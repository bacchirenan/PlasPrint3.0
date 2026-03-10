'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import type { OeeRow, ProducaoRow } from '@/lib/types'
import Plot from '@/components/Plot'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MAQ_MAP: Record<string, string> = {
    '28': '28-CX-360G', '29': '29-CX-360G',
    '180': '180-CX-360G', '181': '181-CX-360G', '182': '182-CX-360G',
}
const MAQ_ORDER = ['28', '29', '180', '181', '182']

function normMaq(m: string) {
    return (m || '').replace(/\s+/g, '').toUpperCase()
}

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

function cleanMaqKey(name: string) {
    return name.split('-')[0].trim()
}

function fmtP(n: number) {
    return (n * 100).toFixed(2) + '%'
}

const LAYOUT_BASE = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#93b8f0', family: 'var(--font-primary-local), sans-serif', size: 11 },
    margin: { t: 40, b: 50, l: 40, r: 20 },
}

export default function OeePage() {
    const [rows, setRows] = useState<OeeRow[]>([])
    const [producaoRows, setProducaoRows] = useState<ProducaoRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Refs para os date pickers ocultos
    const dateFromPickerRef = useRef<HTMLInputElement>(null)
    const dateToPickerRef = useRef<HTMLInputElement>(null)

    // Filtros
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const [dateFrom, setDateFrom] = useState(yesterday)
    const [dateTo, setDateTo] = useState(yesterday)
    const [selMaqs, setSelMaqs] = useState<string[]>(MAQ_ORDER)
    const [selRegs, setSelRegs] = useState<string[]>([])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/data/oee')
            const json = await res.json()
            if (json.error) throw new Error(json.error)
            setRows(json.data)
            setProducaoRows(json.producao || [])
        } catch (e) {
            setError(String(e))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const allRegistros = useMemo(() => {
        const blacklist = [
            '0019', '0067', '0068', '0101', '0102', '0110', '0308', '0309', '0310', '0314', '0339', '0344', '0508', '1101', '1127',
            '0002', '0022', '0063', '0097', '0130', '0505', '1102', '1108', '1120'
        ]
        const set = new Set<string>()
        producaoRows.forEach(r => {
            if (r.registro) {
                const code = r.registro.split(' ')[0]
                if (!blacklist.includes(code)) {
                    set.add(r.registro)
                }
            }
        })
        return Array.from(set).sort()
    }, [producaoRows])

    // Filtros padrão iniciais (0999, 1100 e Produção)
    const hasInitializedRegs = useRef(false)
    useEffect(() => {
        if (!loading && producaoRows.length > 0 && !hasInitializedRegs.current) {
            const defaults = allRegistros.filter(r => {
                const code = r.split(' ')[0]
                return code === '0999' || code === '1100' || r.toLowerCase().includes('produção')
            })
            if (defaults.length > 0) {
                setSelRegs(defaults)
                hasInitializedRegs.current = true
            }
        }
    }, [loading, producaoRows, allRegistros])

    const hourToRegsMap = useMemo(() => {
        const map: Record<string, Set<string>> = {}
        producaoRows.forEach(r => {
            const mNorm = normMaq(r.maquina)
            const key = `${mNorm}|${r.data}|${r.hora}`
            if (!map[key]) map[key] = new Set()
            map[key].add(r.registro)
        })
        return map
    }, [producaoRows])

    const filtered = useMemo(() => {
        const selNorms = selMaqs.map(k => normMaq(MAQ_MAP[k])).filter(Boolean)
        return rows.filter(r => {
            const mNorm = normMaq(r.maquina)
            if (!selNorms.includes(mNorm)) return false
            if (r.data < dateFrom || r.data > dateTo) return false

            if (selRegs.length > 0) {
                const key = `${mNorm}|${r.data}|${r.hora}`
                const regs = hourToRegsMap[key]
                if (!regs || !selRegs.some(sr => regs.has(sr))) return false
            }

            return true
        })
    }, [rows, selMaqs, dateFrom, dateTo, selRegs, hourToRegsMap])

    // ─ Métricas Gerais
    const metrics = useMemo(() => {
        if (!filtered.length) return { oee: 0, teep: 0 }
        const validOeeRows = filtered.filter(r => r.is_valid_oee !== false)
        const oee = validOeeRows.length > 0 ? validOeeRows.reduce((a, r) => a + r.oee, 0) / validOeeRows.length : 0
        const teep = filtered.reduce((a, r) => a + r.teep, 0) / filtered.length
        return { oee, teep }
    }, [filtered])

    const chartProducedHours = useMemo(() => {
        const selNorms = selMaqs.map(k => normMaq(MAQ_MAP[k])).filter(Boolean)
        const filtProd = producaoRows.filter(r => {
            if (!selNorms.includes(normMaq(r.maquina))) return false
            if (r.data < dateFrom || r.data > dateTo) return false
            return true
        })

        const acc: Record<string, Record<string, number>> = {}
        const dates = new Set<string>()

        for (const r of filtProd) {
            const isMatch = selRegs.length === 0
                ? r.registro.toLowerCase().includes('produção')
                : selRegs.includes(r.registro)

            if (isMatch) {
                const mNorm = normMaq(r.maquina)
                if (!acc[r.data]) acc[r.data] = {}
                acc[r.data][mNorm] = (acc[r.data][mNorm] || 0) + r.tempo_segundos
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

        const items = MAQ_ORDER.filter(k => selMaqs.includes(k)).map(k => {
            const name = normMaq(MAQ_MAP[k])
            const total = totals[name] || 0
            const hours = total / (3600 * nDays)
            return { key: k, hours }
        })

        const yValues = items.map(i => i.hours)

        return {
            x: items.map(i => cleanMaqKey(i.key)),
            y: yValues,
            text: yValues.map(v => v.toFixed(1)),
            avg: yValues.length ? yValues.reduce((a, b) => a + b, 0) / yValues.length : 0
        }
    }, [producaoRows, selMaqs, dateFrom, dateTo, selRegs])

    // ─ Gráfico Evolução Temporal
    const chartTimeline = useMemo(() => {
        const daily: Record<string, { oeeSum: number, oeeN: number, teepSum: number, teepN: number }> = {}
        for (const r of filtered) {
            if (!daily[r.data]) daily[r.data] = { oeeSum: 0, oeeN: 0, teepSum: 0, teepN: 0 }
            if (r.is_valid_oee !== false) {
                daily[r.data].oeeSum += r.oee
                daily[r.data].oeeN++
            }
            daily[r.data].teepSum += r.teep
            daily[r.data].teepN++
        }
        const dates = Object.keys(daily).sort()
        const labels = dates.map(d => { const [, m, day] = d.split('-'); return `${day}/${m}` })
        return {
            x: labels,
            oee: dates.map(d => daily[d].oeeN > 0 ? daily[d].oeeSum / daily[d].oeeN : 0),
            teep: dates.map(d => daily[d].teepN > 0 ? daily[d].teepSum / daily[d].teepN : 0),
        }
    }, [filtered])

    const chartHourly = useMemo(() => {
        const hourly: Record<number, { oeeSum: number, oeeN: number, teepSum: number, teepN: number }> = {}
        for (const r of filtered) {
            if (!hourly[r.hora]) hourly[r.hora] = { oeeSum: 0, oeeN: 0, teepSum: 0, teepN: 0 }
            if (r.is_valid_oee !== false) {
                hourly[r.hora].oeeSum += r.oee
                hourly[r.hora].oeeN++
            }
            hourly[r.hora].teepSum += r.teep
            hourly[r.hora].teepN++
        }
        const hours = Array.from({ length: 16 }, (_, i) => i + 6) // de 6 até 21
        return {
            x: hours.map(h => `${h}h`),
            oee: hours.map(h => (hourly[h] && hourly[h].oeeN > 0) ? hourly[h].oeeSum / hourly[h].oeeN : 0),
            teep: hours.map(h => (hourly[h] && hourly[h].teepN > 0) ? hourly[h].teepSum / hourly[h].teepN : 0),
        }
    }, [filtered])

    const chartByMaq = useMemo(() => {
        const maq: Record<string, { oeeSum: number, oeeN: number, teepSum: number, teepN: number }> = {}
        for (const r of filtered) {
            const mNorm = normMaq(r.maquina)
            if (!maq[mNorm]) maq[mNorm] = { oeeSum: 0, oeeN: 0, teepSum: 0, teepN: 0 }
            if (r.is_valid_oee !== false) {
                maq[mNorm].oeeSum += r.oee
                maq[mNorm].oeeN++
            }
            maq[mNorm].teepSum += r.teep
            maq[mNorm].teepN++
        }
        const items = MAQ_ORDER.filter(k => selMaqs.includes(k)).map(k => {
            const name = normMaq(MAQ_MAP[k])
            const oee = (maq[name] && maq[name].oeeN > 0) ? maq[name].oeeSum / maq[name].oeeN : 0
            const teep = (maq[name] && maq[name].teepN > 0) ? maq[name].teepSum / maq[name].teepN : 0
            return { key: k, oee, teep }
        })

        return {
            x: items.map(i => cleanMaqKey(i.key)),
            oee: items.map(i => i.oee),
            teep: items.map(i => i.teep)
        }
    }, [filtered, selMaqs])

    // ─ Heatmap de OEE
    const chartHeatmap = useMemo(() => {
        const acc: Record<number, Record<string, number>> = {}
        const dates = new Set<string>()
        for (const r of filtered) {
            if (r.is_valid_oee === false) continue
            if (!acc[r.hora]) acc[r.hora] = {}
            if (r.oee > 0) {
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

    const toggleReg = (r: string) => {
        setSelRegs(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
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
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Indicadores de Eficiência</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Análise detalhada de OEE e TEEP por máquina, turno e horário</p>
                </div>
            </div>

            {/* Filtros / Menu Bar */}
            <div className="card" style={{ padding: '20px', width: '100%' }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 auto', minWidth: '280px' }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Período de Análise</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>até</span>
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
                    </div>

                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Seleção de Máquinas</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
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

                    <div style={{ flex: '1 1 100%', marginTop: 8 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Filtro por Paradas (Registro)</label>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxHeight: '120px', overflowY: 'auto', padding: '10px', background: 'rgba(0,0,0,0.1)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            {allRegistros.map(reg => (
                                <button key={reg}
                                    onClick={() => toggleReg(reg)}
                                    style={{
                                        padding: '5px 12px',
                                        fontSize: 10,
                                        borderRadius: 20,
                                        border: '1px solid var(--border)',
                                        background: selRegs.includes(reg) ? 'var(--primary-accent)' : 'transparent',
                                        color: selRegs.includes(reg) ? '#fff' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}>
                                    {reg}
                                </button>
                            ))}
                            {allRegistros.length === 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nenhum registro encontrado</span>}
                        </div>
                        {selRegs.length > 0 && (
                            <button
                                onClick={() => setSelRegs([])}
                                style={{ marginTop: 8, fontSize: 10, color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                ✕ LIMPAR FILTRO DE PARADAS
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="card" style={{ padding: '16px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>OEE Médio</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--primary-accent)' }}>{fmtP(metrics.oee)}</div>
                </div>
                <div className="card" style={{ padding: '16px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, fontWeight: 700 }}>TEEP Médio</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--info)' }}>{fmtP(metrics.teep)}</div>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                    <div className="card-title" style={{ marginBottom: 16 }}>OEE por Máquina</div>
                    <Plot
                        data={chartByMaq.x.map((mKey, idx) => {
                            const colors = ['#1a335f', '#4466b1', '#00adef', '#09a38c', '#89c153']
                            return {
                                type: 'bar',
                                name: `Máquina ${mKey}`,
                                x: [mKey],
                                y: [chartByMaq.oee[idx]],
                                text: [fmtP(chartByMaq.oee[idx])],
                                textposition: 'outside',
                                textfont: { color: 'white', size: 12, weight: 800, family: 'var(--font-primary-local), sans-serif' },
                                marker: {
                                    color: colors[idx % colors.length],
                                },
                                cliponaxis: false
                            }
                        })}
                        layout={{
                            ...LAYOUT_BASE,
                            height: 400,
                            showlegend: false,
                            yaxis: { visible: false, range: [0, Math.max(...chartByMaq.oee, 0.5) * 1.3] },
                            xaxis: {
                                type: 'category',
                                tickfont: { color: 'white', weight: 700, family: 'var(--font-primary-local), sans-serif', size: 12 }
                            },
                        }}
                        config={{ displayModeBar: false, responsive: true }}
                        style={{ width: '100%' }}
                    />
                </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
                <div className="card-title" style={{ marginBottom: 16 }}>Horas Produzidas por Máquina</div>
                <Plot
                    data={chartProducedHours.x.map((mKey, idx) => {
                        const colors = ['#1a335f', '#4466b1', '#00adef', '#09a38c', '#89c153']
                        return {
                            type: 'bar',
                            name: `Máquina ${mKey}`,
                            x: [mKey],
                            y: [chartProducedHours.y[idx]],
                            text: [chartProducedHours.text[idx]],
                            textposition: 'outside',
                            textfont: { color: 'white', size: 14, weight: 800, family: 'var(--font-primary-local), sans-serif' },
                            marker: {
                                color: colors[idx % colors.length]
                            },
                            cliponaxis: false
                        }
                    })}
                    layout={{
                        ...LAYOUT_BASE,
                        height: 400,
                        showlegend: false,
                        yaxis: { visible: false, range: [0, Math.max(...chartProducedHours.y, 1) * 1.3] },
                        xaxis: {
                            type: 'category',
                            tickfont: { color: 'white', weight: 700, family: 'var(--font-primary-local), sans-serif', size: 12 }
                        },
                        shapes: [{
                            type: 'line', x0: 0, x1: 1, xref: 'paper',
                            y0: chartProducedHours.avg, y1: chartProducedHours.avg,
                            line: { color: 'rgba(255,255,255,0.6)', dash: 'dash', width: 2 }
                        }],
                        annotations: [{
                            xref: 'paper', yref: 'y', x: 1, y: chartProducedHours.avg,
                            text: `Média: ${chartProducedHours.avg.toFixed(1)} h/dia`,
                            showarrow: false, font: { color: 'white', size: 12, family: 'var(--font-primary-local), sans-serif' },
                            xanchor: 'right', yshift: 15
                        }]
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>
        </div>
    )
}
