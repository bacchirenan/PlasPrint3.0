'use client'

import React from 'react'

interface RelatorioCustosTemplateProps {
    data: any
}

export default function RelatorioCustosTemplate({ data }: RelatorioCustosTemplateProps) {
    const fmtN = (v: number) => (v || 0).toLocaleString('pt-BR')
    const fmtP = (v: number) => ((v || 0) * 100).toFixed(1) + '%'
    const fmtM = (v: number) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

    const custoMedioItem = data.custoMedioItem || 0;
    const custoRejeito = data.custoMedioItem || 0;

    const custoTotalProducao = data.custoTotalProducao || 0;
    const custoPerdaRejeito = data.custoPerdaRejeito || 0;

    const kpis = [
        { label: 'Custo Est. Produção', value: fmtM(custoTotalProducao), color: '#3b82f6' },
        { label: 'Custo de Perdas (Rejeito)', value: fmtM(custoPerdaRejeito), color: '#ef4444' },
        { label: 'Volume Produzido', value: fmtN(data.producaoTotal), color: '#64748b' },
        { label: 'Volume Rejeitado', value: fmtN(data.rejeitoImpressao), color: '#ef4444' },
    ]

    return (
        <div id="relatorio-custos-pdf" style={{
            width: '1120px',
            height: '792px',
            padding: '40px',
            background: '#ffffff',
            color: '#1e293b',
            fontFamily: 'var(--font-primary-local), sans-serif',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            boxSizing: 'border-box'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1a335f', paddingBottom: '20px' }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '32px', color: '#1a335f', fontWeight: 900 }}>Detalhamento de Custos</h1>
                    <p style={{ margin: 0, fontSize: '15px', color: '#64748b', marginTop: '6px' }}>Impacto Financeiro Baseado na Produção Analisada</p>
                </div>
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '12px 20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ marginBottom: '4px' }}><strong>Período Analisado:</strong><br />{data.periodo}</div>
                    <div><strong>Máquinas:</strong><br />{data.maquinas}</div>
                </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px' }}>
                {kpis.map((kpi, i) => (
                    <div key={i} style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', borderTop: `4px solid ${kpi.color}`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{kpi.label}</div>
                        <div style={{ fontSize: '26px', fontWeight: 900, color: kpi.color === '#ef4444' ? '#ef4444' : '#1e293b', marginTop: '10px' }}>{kpi.value}</div>
                    </div>
                ))}
            </div>

            {/* Main Area */}
            <div style={{ display: 'flex', gap: '24px', flex: 1 }}>
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', color: '#1a335f', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>Detalhamento de Custos (Estimativa Proporcional)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#f1f5f9', borderRadius: '8px' }}>
                                <span style={{ fontWeight: 600, color: '#475569' }}>Custo por Unidade Produzida (Média)</span>
                                <span style={{ fontWeight: 800, color: '#1e293b' }}>{fmtM(custoMedioItem)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#fef2f2', borderRadius: '8px' }}>
                                <span style={{ fontWeight: 600, color: '#ef4444' }}>Custo de Material Rejeitado (Estimativa / un)</span>
                                <span style={{ fontWeight: 800, color: '#ef4444' }}>{fmtM(custoRejeito)}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, background: '#1a335f', padding: '24px', borderRadius: '16px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Desperdício Financeiro Calculado</div>
                            <div style={{ fontSize: '48px', fontWeight: 900, color: '#ff8a8a' }}>{fmtM(custoPerdaRejeito)}</div>
                            <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '8px' }}>Baseado em {fmtN(data.rejeitoImpressao)} peças não aproveitadas</div>
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '16px', padding: '24px', background: '#f8fafc' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#1a335f', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>Evolução de Custos Mensais</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {data.monthlyProd.x.slice(-6).map((month: string, i: number) => {
                            const prod = data.monthlyProd.y[i] || 0;
                            const cost = prod * custoMedioItem;
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                        <span style={{ fontWeight: 700, color: '#64748b' }}>{month}</span>
                                        <span style={{ fontWeight: 800, color: '#3b82f6' }}>{fmtM(cost)}</span>
                                    </div>
                                    <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px' }}>
                                        <div style={{ height: '100%', background: '#3b82f6', borderRadius: '3px', width: `${Math.min((prod / 50000) * 100, 100)}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748b', paddingTop: '20px', borderTop: '1px solid #e2e8f0', marginTop: 'auto' }}>
                Documento Gerado Automatizadamente via PlasPrint IA Web • {new Date().toLocaleDateString('pt-BR')} • Uso Exclusivo Interno
            </div>
        </div>
    )
}
