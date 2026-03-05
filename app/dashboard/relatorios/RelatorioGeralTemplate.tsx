'use client'

import React from 'react'

interface RelatorioGeralTemplateProps {
    data: {
        periodo: string
        maquinas: string
        oee: number
        producaoTotal: number
        teep: number
        pecasBoas: number
        pctPeçasBoas: number
        rejeitoImpressao: number
        pctRejeito: number
        canudosEncabeçados: number
        encabecadosPorHora: number
        mediaHorasProduzindo: number

        dailyOee: { x: number[], y: number[] }
        dailyProd: { x: number[], y: number[] }

        monthlyOee: { x: string[], y: number[] }
        monthlyTeep: { x: string[], y: number[] }
        monthlyProd: { x: string[], y: number[] }
    }
}

export default function RelatorioGeralTemplate({ data }: RelatorioGeralTemplateProps) {
    const fmtN = (v: number) => v.toLocaleString('pt-BR')
    const fmtP = (v: number) => (v * 100).toFixed(1) + '%'
    const fmtP2 = (v: number) => v.toFixed(2)

    return (
        <div id="relatorio-geral-pdf" style={{
            width: '1120px', // A4 Landscape roughly
            padding: '40px',
            background: '#f8fafc',
            color: '#1e293b',
            fontFamily: 'var(--font-primary-local), sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            minHeight: '792px',
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#1a335f' }}>PlasPrint</div>
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                    Período: {data.periodo} | Máquinas: {data.maquinas}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '20px', flex: 1 }}>
                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* OEE Main Card */}
                    <div style={{
                        background: '#1a335f',
                        padding: '30px 20px',
                        borderRadius: '12px',
                        color: 'white',
                        textAlign: 'center',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}>
                        <div style={{ fontSize: '18px', fontWeight: 800, textTransform: 'uppercase', marginBottom: '10px' }}>OEE</div>
                        <div style={{ fontSize: '64px', fontWeight: 950 }}>{fmtP2(data.oee * 100)}</div>
                    </div>

                    {/* Prod and TEEP row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', background: '#09a38c', color: 'white', padding: '4px', borderRadius: '4px', fontWeight: 800, marginBottom: '8px' }}>Prod. Total</div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#09a38c' }}>{fmtN(data.producaoTotal)}</div>
                        </div>
                        <div style={{ background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: '10px', background: '#00adef', color: 'white', padding: '4px', borderRadius: '4px', fontWeight: 800, marginBottom: '8px' }}>TEEP</div>
                            <div style={{ fontSize: '18px', fontWeight: 800, color: '#00adef' }}>{data.teep.toFixed(1)}</div>
                        </div>
                    </div>

                    {/* KPI List */}
                    {[
                        { label: 'Peças Boas', value: fmtN(data.pecasBoas) + ' Mil', color: '#09a38c' },
                        { label: '% Peças Boas', value: fmtP(data.pctPeçasBoas), color: '#09a38c' },
                        { label: 'Rejeito Impressão', value: fmtN(data.rejeitoImpressao), color: '#ef4444' },
                        { label: '% Rejeito', value: fmtP(data.pctRejeito), color: '#ef4444' },
                        { label: 'Canudos Encabeçados', value: fmtN(data.canudosEncabeçados), color: '#00adef' },
                        { label: 'Encabeçados por Hora', value: data.encabecadosPorHora.toFixed(1), color: '#00adef' },
                        { label: 'Média Horas Produzindo', value: data.mediaHorasProduzindo.toFixed(1) + ' h/dia', color: '#00adef' },
                    ].map(kpi => (
                        <div key={kpi.label} style={{
                            background: 'white',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                color: 'white',
                                background: kpi.color,
                                padding: '4px 8px',
                                borderRadius: '4px',
                                width: '130px'
                            }}>{kpi.label}</div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
                        </div>
                    ))}
                </div>

                {/* Main Content Area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* OEE Diário */}
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', position: 'relative' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#64748b', textAlign: 'center', marginBottom: '20px' }}>OEE Diário</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', paddingBottom: '20px' }}>
                            {Array.from({ length: 27 }).map((_, i) => {
                                const day = i + 2;
                                const val = data.dailyOee.y[data.dailyOee.x.indexOf(day)] || 0;
                                return (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        {val > 0 && <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', transform: 'rotate(-90deg)', marginBottom: '5px' }}>{Math.round(val * 100)}%</div>}
                                        <div style={{
                                            width: '100%',
                                            height: `${val * 100}%`,
                                            background: '#00adef',
                                            borderRadius: '2px 2px 0 0'
                                        }} />
                                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>{day}</div>
                                    </div>
                                )
                            })}
                        </div>
                        {/* Average Line */}
                        <div style={{ position: 'absolute', top: '120px', left: '20px', right: '20px', borderTop: '2px dashed #ef4444', opacity: 0.4 }} />
                    </div>

                    {/* Produção Diária */}
                    <div style={{ background: 'white', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#64748b', textAlign: 'center', marginBottom: '20px' }}>Produção Diária</div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '180px', paddingBottom: '20px' }}>
                            {Array.from({ length: 27 }).map((_, i) => {
                                const day = i + 2;
                                const val = data.dailyProd.y[data.dailyProd.x.indexOf(day)] || 0;
                                const max = Math.max(...data.dailyProd.y, 4000);
                                return (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        {val > 0 && <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', transform: 'rotate(-90deg)', marginBottom: '5px' }}>{(val / 1000).toFixed(1)}k</div>}
                                        <div style={{
                                            width: '100%',
                                            height: `${(val / max) * 100}%`,
                                            background: '#09a38c',
                                            borderRadius: '2px 2px 0 0'
                                        }} />
                                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8' }}>{day}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Bottom Row Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                        {/* OEE Mensal */}
                        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '15px' }}>OEE Mensal</div>
                            <div style={{ display: 'flex', gap: '20px', height: '120px', alignItems: 'flex-end', justifyContent: 'center' }}>
                                {data.monthlyOee.x.map((month, i) => (
                                    <div key={i} style={{ flex: 1, maxWidth: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px' }}>{Math.round(data.monthlyOee.y[i] * 100)}%</div>
                                        <div style={{ width: '100%', height: `${data.monthlyOee.y[i] * 100}%`, background: '#1a335f', borderRadius: '4px 4px 0 0' }} />
                                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{month}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* TEEP Mensal */}
                        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '15px' }}>TEEP Mensal</div>
                            <div style={{ display: 'flex', gap: '20px', height: '120px', alignItems: 'flex-end', justifyContent: 'center' }}>
                                {data.monthlyTeep.x.map((month, i) => (
                                    <div key={i} style={{ flex: 1, maxWidth: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ fontSize: '10px', fontWeight: 700, marginBottom: '4px' }}>{Math.round(data.monthlyTeep.y[i])}%</div>
                                        <div style={{ width: '100%', height: `${(data.monthlyTeep.y[i] / 100) * 100}%`, background: '#00adef', borderRadius: '4px 4px 0 0' }} />
                                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{month}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Produção Mensal */}
                        <div style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '15px' }}>Produção Mensal</div>
                            <div style={{ display: 'flex', gap: '20px', height: '120px', alignItems: 'flex-end', justifyContent: 'center' }}>
                                {data.monthlyProd.x.map((month, i) => {
                                    const val = data.monthlyProd.y[i];
                                    const max = Math.max(...data.monthlyProd.y, 50000);
                                    return (
                                        <div key={i} style={{ flex: 1, maxWidth: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ fontSize: '9px', fontWeight: 700, marginBottom: '4px' }}>{val > 1000 ? (val / 1000).toFixed(1) + 'k' : val}</div>
                                            <div style={{ width: '100%', height: `${(val / max) * 100}%`, background: '#09a38c', borderRadius: '4px 4px 0 0' }} />
                                            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>{month}</div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
