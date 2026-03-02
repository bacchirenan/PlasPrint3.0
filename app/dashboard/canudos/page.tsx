'use client'

import { useEffect, useState, useMemo } from 'react'
import type { CanudoRow } from '@/lib/types'
import Plot from '@/components/Plot'

export default function CanudosPage() {
    const [rows, setRows] = useState<CanudoRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/data/canudos')
                const data = await res.json()
                setRows(data.data)
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const stats = useMemo(() => {
        const boas = rows.reduce((a, r) => a + r.pecas_boas, 0)
        const perdas = rows.reduce((a, r) => a + r.perdas, 0)
        return { boas, perdas, total: boas + perdas, pctPerda: (boas + perdas) > 0 ? perdas / (boas + perdas) : 0 }
    }, [rows])

    const chartByDay = useMemo(() => {
        const acc: Record<string, { boas: number, perdas: number }> = {}
        for (const r of rows) {
            if (!acc[r.data]) acc[r.data] = { boas: 0, perdas: 0 }
            acc[r.data].boas += r.pecas_boas
            acc[r.data].perdas += r.perdas
        }
        const dates = Object.keys(acc).sort()
        return { x: dates, boas: dates.map(d => acc[d].boas), perdas: dates.map(d => acc[d].perdas) }
    }, [rows])

    if (loading) return <div className="spinner-container"><div className="spinner" /></div>

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Gestão de Canudos</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Monitoramento de produção e controle de perdas</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div className="card">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Produção Total</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--success)' }}>{stats.boas.toLocaleString()}</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Perdas</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--danger)' }}>{stats.perdas.toLocaleString()}</div>
                </div>
                <div className="card">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Índice de Perda</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--warning)' }}>{(stats.pctPerda * 100).toFixed(2)}%</div>
                </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
                <div className="card-title">Produção vs Perdas (Diário)</div>
                <Plot
                    data={[
                        { type: 'bar', name: 'Peças Boas', x: chartByDay.x, y: chartByDay.boas, marker: { color: '#22c55e' } },
                        { type: 'bar', name: 'Perdas', x: chartByDay.x, y: chartByDay.perdas, marker: { color: '#ef4444' } },
                    ]}
                    layout={{
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent',
                        barmode: 'stack',
                        height: 350,
                        font: { color: '#93b8f0' },
                        margin: { t: 40, b: 50, l: 40, r: 20 },
                        legend: { orientation: 'h', x: 0.5, xanchor: 'center', y: -0.2 }
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                />
            </div>
        </div>
    )
}
