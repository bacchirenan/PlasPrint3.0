'use client'

import React from 'react'

interface RelatorioProducaoTemplateProps {
    data: any // using any for simplicity, or we can use the exact same type as RelatorioGeral
}

export default function RelatorioProducaoTemplate({ data }: RelatorioProducaoTemplateProps) {
    const fmtN = (v: number) => (v || 0).toLocaleString('pt-BR')
    const fmtP = (v: number) => ((v || 0) * 100).toFixed(1) + '%'

    const kpis = [
        { label: 'Total Produzido', value: fmtN(data.producaoTotal) + ' un', color: '#1a335f' },
        { label: 'Peças Boas', value: fmtN(data.pecasBoas) + ' un', color: '#09a38c' },
        { label: 'Rejeito Total', value: fmtN(data.rejeitoImpressao) + ' un', color: '#ef4444' },
        { label: '% Rejeito', value: fmtP(data.pctRejeito), color: '#ef4444' },
        { label: 'OEE Médio', value: fmtP(data.oee), color: '#3b82f6' },
        { label: 'TEEP Médio', value: (data.teep || 0).toFixed(1) + '%', color: '#00adef' }
    ]

    return (
        <div id="relatorio-producao-pdf" style={{
            width: '1120px',
            height: '792px',
            padding: '30px',
            background: '#ffffff',
            color: '#1e293b',
            fontFamily: 'var(--font-primary-local), sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxSizing: 'border-box',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #1a335f', paddingBottom: '15px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '28px', color: '#1a335f', fontWeight: 900 }}>Resumo de Produção</h1>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748b', marginTop: '4px' }}>Análise de Volumes e Rejeitos por Período</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b' }}>
                    <strong>Período:</strong> {data.periodo}<br />
                    <strong>Máquinas:</strong> {data.maquinas}
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'flex', gap: '15px' }}>
                {kpis.map((kpi, i) => (
                    <div key={i} style={{ flex: 1, background: '#f8fafc', padding: '15px', borderRadius: '12px', borderLeft: `6px solid ${kpi.color}`, boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>{kpi.label}</div>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: '#1e293b', marginTop: '6px' }}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div style={{ display: 'flex', gap: '20px', flex: 1, marginTop: '10px' }}>
                {/* Left Col - Charts */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Produção Diária */}
                    <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', color: '#1a335f', marginBottom: '15px' }}>Volume Diário de Produção (Peças Boas)</h3>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flex: 1 }}>
                            {Array.from({ length: 27 }).map((_, i) => {
                                const day = i + 2;
                                const val = data.dailyProd.y[data.dailyProd.x.indexOf(day)] || 0;
                                const max = Math.max(...data.dailyProd.y, 1000);
                                return (
                                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                                        {val > 0 && <span style={{ fontSize: '9px', fontWeight: 600, color: '#64748b', marginBottom: '4px', transform: 'rotate(-45deg)' }}>{(val / 1000).toFixed(1)}k</span>}
                                        <div style={{ width: '100%', height: `${Math.max((val / max) * 100, 1)}%`, background: val > 0 ? '#09a38c' : '#e2e8f0', borderRadius: '4px 4px 0 0' }}></div>
                                        <span style={{ fontSize: '10px', marginTop: '6px', color: '#94a3b8' }}>{day}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Col - Additional Stats */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', background: '#f8fafc' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', color: '#1a335f', marginBottom: '15px' }}>Produção Mensal Acumulada</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {data.monthlyProd.x.slice(-6).map((month: string, i: number) => {
                                const val = data.monthlyProd.y[i] || 0;
                                const max = Math.max(...data.monthlyProd.y, 1000);
                                const pct = Math.max((val / max) * 100, 2);
                                return (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 600 }}>{month}</span>
                                            <span style={{ color: '#09a38c', fontWeight: 700 }}>{fmtN(val)}</span>
                                        </div>
                                        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: '#09a38c', borderRadius: '4px' }}></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    <div style={{ height: '200px', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ fontSize: '48px', fontWeight: 900, color: '#1a335f', lineHeight: 1 }}>{data.mediaHorasProduzindo.toFixed(1)}h</div>
                        <div style={{ fontSize: '14px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>Média de Horas<br />Produzindo por Dia</div>
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
