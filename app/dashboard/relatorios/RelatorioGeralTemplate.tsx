'use client'

import React from 'react'

interface RelatorioGeralTemplateProps {
    data: any
}

export default function RelatorioGeralTemplate({ data }: RelatorioGeralTemplateProps) {
    const fmtN = (v: number) => (v || 0).toLocaleString('pt-BR')
    const fmtP = (v: number) => ((v || 0) * 100).toFixed(1) + '%'
    const fmtP2 = (v: number) => (v || 0).toFixed(2)

    const kpis = [
        { label: 'Peças Boas', value: fmtN(data.pecasBoas), color: '#09a38c' },
        { label: '% Peças Boas', value: fmtP(data.pctPeçasBoas), color: '#09a38c' },
        { label: 'Rejeito Impressão', value: fmtN(data.rejeitoImpressao), color: '#ef4444' },
        { label: '% Rejeito', value: fmtP(data.pctRejeito), color: '#ef4444' },
        { label: 'Média Horas/Dia', value: (data.mediaHorasProduzindo || 0).toFixed(1) + ' h', color: '#1a335f' },
        { label: 'Canudos Encab.', value: fmtN(data.canudosEncabeçados), color: '#00adef' },
        { label: 'Encab. por Hora', value: (data.encabecadosPorHora || 0).toFixed(1), color: '#00adef' },
        { label: 'Canudos Decorados', value: fmtN(data.canudosDecorados || 0), color: '#8b5cf6' },
        { label: 'Decorados/Hora', value: (data.decoradosPorHora || 0).toFixed(1), color: '#8b5cf6' },
    ]

    return (
        <div id="relatorio-geral-pdf" style={{
            width: '1120px',
            height: '792px',
            padding: '30px',
            background: '#ffffff',
            color: '#1e293b',
            fontFamily: 'var(--font-primary-local), sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
            boxSizing: 'border-box',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #1a335f', paddingBottom: '12px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '28px', color: '#1a335f', fontWeight: 900 }}>Relatório Geral - Impressão Digital</h1>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Dashboard Consolidado de Produtividade, Qualidade e Canudos</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b' }}>
                    <strong>Período:</strong> {data.periodo}<br />
                    <strong>Máquinas:</strong> {data.maquinas}
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                <div style={{ background: '#1a335f', padding: '12px', borderRadius: '12px', borderLeft: '6px solid #3b82f6', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase' }}>OEE Global</div>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: 'white', marginTop: '2px' }}>{fmtP2(data.oee * 100)}%</div>
                </div>
                {kpis.map((kpi, i) => (
                    <div key={i} style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', borderLeft: `6px solid ${kpi.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.label}</div>
                        <div style={{ fontSize: '20px', fontWeight: 900, color: '#1e293b', marginTop: '4px' }}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, marginTop: '5px' }}>
                {/* Diário Row */}
                <div style={{ display: 'flex', gap: '15px', flex: 1.2 }}>
                    <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', color: '#1a335f', marginBottom: '10px' }}>OEE Diário (%)</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flex: 1 }}>
                            {Array.from({ length: 27 }).map((_, i) => {
                                const day = i + 2;
                                const val = data.dailyOee.y[data.dailyOee.x.indexOf(day)] || 0;
                                return (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                        {val > 0 && <div style={{ fontSize: '8px', fontWeight: 700, color: '#475569', transform: 'rotate(-90deg)', marginBottom: '6px' }}>{Math.round(val * 100)}</div>}
                                        <div style={{ width: '100%', height: `${Math.max(val * 100, 1)}%`, background: val > 0 ? '#0ea5e9' : '#e2e8f0', borderRadius: '2px 2px 0 0' }} />
                                        <div style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', marginTop: '4px' }}>{day}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', color: '#1a335f', marginBottom: '10px' }}>Produção Diária (un)</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', flex: 1 }}>
                            {Array.from({ length: 27 }).map((_, i) => {
                                const day = i + 2;
                                const val = data.dailyProd.y[data.dailyProd.x.indexOf(day)] || 0;
                                const max = Math.max(...data.dailyProd.y, 4000);
                                return (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                        {val > 0 && <div style={{ fontSize: '8px', fontWeight: 700, color: '#475569', transform: 'rotate(-90deg)', marginBottom: '6px' }}>{(val / 1000).toFixed(1)}k</div>}
                                        <div style={{ width: '100%', height: `${Math.max((val / max) * 100, 1)}%`, background: val > 0 ? '#10b981' : '#e2e8f0', borderRadius: '2px 2px 0 0' }} />
                                        <div style={{ fontSize: '9px', fontWeight: 600, color: '#94a3b8', marginTop: '4px' }}>{day}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Mensal Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', flex: 1 }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', color: '#1a335f', marginBottom: '10px' }}>OEE Mensal (%)</h3>
                        <div style={{ display: 'flex', gap: '10px', flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                            {data.monthlyOee.x.map((month: string, i: number) => (
                                <div key={i} style={{ flex: 1, maxWidth: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                    {data.monthlyOee.y[i] > 0 && <div style={{ fontSize: '8px', fontWeight: 700, marginBottom: '2px' }}>{Math.round(data.monthlyOee.y[i] * 100)}%</div>}
                                    <div style={{ width: '100%', height: `${Math.max((data.monthlyOee.y[i] || 0) * 100, 1)}%`, background: data.monthlyOee.y[i] > 0 ? '#1a335f' : '#e2e8f0', borderRadius: '3px 3px 0 0' }} />
                                    <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>{month}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', color: '#1a335f', marginBottom: '10px' }}>TEEP Mensal (%)</h3>
                        <div style={{ display: 'flex', gap: '10px', flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                            {data.monthlyTeep.x.map((month: string, i: number) => (
                                <div key={i} style={{ flex: 1, maxWidth: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                    {data.monthlyTeep.y[i] > 0 && <div style={{ fontSize: '8px', fontWeight: 700, marginBottom: '2px' }}>{Math.round(data.monthlyTeep.y[i])}%</div>}
                                    <div style={{ width: '100%', height: `${Math.max(data.monthlyTeep.y[i] || 0, 1)}%`, background: data.monthlyTeep.y[i] > 0 ? '#00adef' : '#e2e8f0', borderRadius: '3px 3px 0 0' }} />
                                    <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>{month}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '13px', color: '#1a335f', marginBottom: '10px' }}>Produção Mensal Acumulada (un)</h3>
                        <div style={{ display: 'flex', gap: '10px', flex: 1, alignItems: 'flex-end', justifyContent: 'center' }}>
                            {data.monthlyProd.x.map((month: string, i: number) => {
                                const val = data.monthlyProd.y[i];
                                const max = Math.max(...data.monthlyProd.y, 50000);
                                return (
                                    <div key={i} style={{ flex: 1, maxWidth: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                        {val > 0 && <div style={{ fontSize: '8px', fontWeight: 700, marginBottom: '2px' }}>{val > 1000 ? (val / 1000).toFixed(1) + 'k' : val}</div>}
                                        <div style={{ width: '100%', height: `${Math.max((val / max) * 100, 1)}%`, background: val > 0 ? '#09a38c' : '#e2e8f0', borderRadius: '3px 3px 0 0' }} />
                                        <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>{month}</div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                Relatório gerado pelo sistema PlasPrint IA Web • {new Date().toLocaleDateString('pt-BR')}
            </div>
        </div>
    )
}
