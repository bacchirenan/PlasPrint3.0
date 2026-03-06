'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import RelatorioGeralTemplate from './RelatorioGeralTemplate'
import RelatorioProducaoTemplate from './RelatorioProducaoTemplate'
import RelatorioCustosTemplate from './RelatorioCustosTemplate'
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

const MAQ_ORDER = ['28', '29', '180', '181', '182']

export default function RelatoriosPage() {
    const [generating, setGenerating] = useState(false)
    const [reportType, setReportType] = useState<string>('geral')

    // Filtros
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const [dateFrom, setDateFrom] = useState(yesterday)
    const [dateTo, setDateTo] = useState(yesterday)
    const [selMaqs, setSelMaqs] = useState<string[]>(MAQ_ORDER)

    const dateFromPickerRef = useRef<HTMLInputElement>(null)
    const dateToPickerRef = useRef<HTMLInputElement>(null)

    const toggleMaq = (k: string) => {
        setSelMaqs(prev => prev.includes(k) ? prev.filter(m => m !== k) : [...prev, k])
    }

    const [reportData, setReportData] = useState<any>(null)

    const calculateReportData = (oeeData: any[], prodData: any[], canudosData: any, fichas: any[]) => {
        const maqs = selMaqs.map(m => (m === '180' || m === '181' || m === '182') ? `${m}- CX-360G` : `${m}-CX-360G`)

        const filtrar = (rows: any[]) => rows.filter(r => {
            if (r.data < dateFrom || r.data > dateTo) return false
            if (!maqs.some(m => r.maquina === m)) return false
            return true
        })

        const fOee = filtrar(oeeData)
        const fProd = filtrar(prodData)
        const fEnc = (canudosData.encabecados || []).filter((r: any) => r.data >= dateFrom && r.data <= dateTo)
        const fDec = (canudosData.decorados || []).filter((r: any) => r.data >= dateFrom && r.data <= dateTo)

        // Totais e Médias do Período
        const validOeeRows = fOee.filter(r => r.is_valid_oee !== false)
        const oeeMed = validOeeRows.length > 0 ? validOeeRows.reduce((a, b) => a + b.oee, 0) / validOeeRows.length : 0
        const teepMed = fOee.length > 0 ? fOee.reduce((a, b) => a + b.teep, 0) / fOee.length : 0
        const prodTotal = fProd.reduce((a, b) => a + b.producao_total, 0)
        const boasTotal = fProd.reduce((a, b) => a + b.pecas_boas, 0)
        const rejTotal = fProd.reduce((a, b) => a + b.rejeito, 0)

        const encTotal = fEnc.reduce((a: number, b: any) => a + b.pecas_boas, 0)
        const decTotal = fDec.reduce((a: number, b: any) => a + b.pecas_boas, 0)

        const encDaysA = new Set<string>()
        const encDaysB = new Set<string>()
        fEnc.forEach((r: any) => {
            if (r.turno === 'Turno A') encDaysA.add(r.data)
            else encDaysB.add(r.data)
        })
        const encHoursTotal = (encDaysA.size > 0 || encDaysB.size > 0) ? (encDaysA.size * 8) + (encDaysB.size * 8) : 16

        const decDaysA = new Set<string>()
        const decDaysB = new Set<string>()
        fDec.forEach((r: any) => {
            if (r.turno === 'Turno A') decDaysA.add(r.data)
            else decDaysB.add(r.data)
        })
        const decHoursTotal = (decDaysA.size > 0 || decDaysB.size > 0) ? (decDaysA.size * 8) + (decDaysB.size * 8) : 16

        // Agrupamentos Diários (Apenas dias únicos no período)
        const dailyOee: Record<string, { sum: number, n: number }> = {}
        const dailyProd: Record<string, number> = {}

        let custoTotalReal = 0
        let custoRejeitoReal = 0
        let validCostCount = 0
        let sumCustoUnidade = 0

        fichas?.forEach(f => {
            if (f.custo_por_unidade > 0) {
                sumCustoUnidade += f.custo_por_unidade
                validCostCount++
            }
        })
        const custoMedioBase = validCostCount > 0 ? (sumCustoUnidade / validCostCount) : 0

        fOee.forEach(r => {
            if (r.is_valid_oee !== false) {
                if (!dailyOee[r.data]) dailyOee[r.data] = { sum: 0, n: 0 }
                dailyOee[r.data].sum += r.oee
                dailyOee[r.data].n++
            }
        })

        fProd.forEach(r => {
            dailyProd[r.data] = (dailyProd[r.data] || 0) + r.pecas_boas

            // Match ficha para computar custo
            const prodDesc = (r.produto || '').toLowerCase()
            const ficha = fichas?.find(f => {
                const ref = String(f.referencia || '').toLowerCase()
                const dec = String(f.decoracao || '').toLowerCase()
                return (ref && prodDesc.includes(ref)) && (dec && prodDesc.includes(dec))
            }) || fichas?.find(f => prodDesc.includes(String(f.referencia || '').toLowerCase())) // fallback na ref

            const custoItem = ficha?.custo_por_unidade || custoMedioBase
            custoTotalReal += r.pecas_boas * custoItem
            custoRejeitoReal += r.rejeito * custoItem
        })

        const sortedDates = Object.keys(dailyOee).sort()

        // Agrupamentos Mensais (Calculados do total de dados para comparação)
        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
        const monthlyStats: Record<string, { oeeSum: number, oeeN: number, teepSum: number, teepN: number, prod: number }> = {}

        // Limites para o histórico (De janeiro do ano selecionado até a data final do filtro)
        const yearBase = dateTo.split('-')[0]
        const historicLimit = dateTo

        // Processa OEE histórico
        oeeData.forEach(r => {
            // Filtro Histórico Mensal: Máquinas Selecionadas e Limite de Data
            if (r.data < `${yearBase}-01-01` || r.data > historicLimit) return
            if (!maqs.some(m => r.maquina === m)) return

            const [y, m] = r.data.split('-')
            const monthKey = `${monthNames[parseInt(m) - 1]}`
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { oeeSum: 0, oeeN: 0, teepSum: 0, teepN: 0, prod: 0 }

            if (r.is_valid_oee !== false) {
                monthlyStats[monthKey].oeeSum += r.oee
                monthlyStats[monthKey].oeeN++
            }
            monthlyStats[monthKey].teepSum += r.teep
            monthlyStats[monthKey].teepN++
        })

        // Processa Produção histórica
        prodData.forEach(r => {
            // Filtro Histórico Mensal: Máquinas Selecionadas e Limite de Data
            if (r.data < `${yearBase}-01-01` || r.data > historicLimit) return
            if (!maqs.some(m => r.maquina === m)) return

            const [y, m] = r.data.split('-')
            const monthKey = `${monthNames[parseInt(m) - 1]}`
            if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { oeeSum: 0, oeeN: 0, teepSum: 0, teepN: 0, prod: 0 }
            monthlyStats[monthKey].prod += r.pecas_boas
        })

        const monthKeys = monthNames.slice(0, parseInt(dateTo.split('-')[1]))
        // Garante que todos os meses do intervalo existam no objeto de estatísticas (mesmo que zerados)
        monthKeys.forEach(k => {
            if (!monthlyStats[k]) monthlyStats[k] = { oeeSum: 0, oeeN: 0, teepSum: 0, teepN: 0, prod: 0 }
        })

        // Cálculo de Horas Produzidas por Máquina (Média Diária)
        const accHrs: Record<string, Record<string, number>> = {}
        const uniqueDates = new Set<string>()
        let totalTimeSegundos = 0

        for (const r of fProd) {
            if (r.registro.toLowerCase().includes('produção')) {
                if (!accHrs[r.data]) accHrs[r.data] = {}
                accHrs[r.data][r.maquina] = (accHrs[r.data][r.maquina] || 0) + r.tempo_segundos
                uniqueDates.add(r.data)
                totalTimeSegundos += r.tempo_segundos
            }
        }

        const nDays = uniqueDates.size || 1
        const machineTotals: Record<string, number> = {}
        for (const d of Array.from(uniqueDates)) {
            for (const m in accHrs[d]) {
                machineTotals[m] = (machineTotals[m] || 0) + accHrs[d][m]
            }
        }

        const maqList = selMaqs.map(m => (m === '180' || m === '181' || m === '182') ? `${m}- CX-360G` : `${m}-CX-360G`)
        const values = maqList.map(name => (machineTotals[name] || 0) / (3600 * nDays))
        const avgHrsProduzindo = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0

        // Horas totais base para produtividade (média de 1 máquina pelo período)
        const logicalPeriodHours = avgHrsProduzindo * nDays

        return {
            periodo: `${isoToBr(dateFrom)} até ${isoToBr(dateTo)}`,
            maquinas: selMaqs.join(', '),
            oee: oeeMed,
            producaoTotal: prodTotal,
            teep: teepMed * 100,
            pecasBoas: boasTotal,
            pctPeçasBoas: prodTotal > 0 ? boasTotal / prodTotal : 0,
            rejeitoImpressao: rejTotal,
            pctRejeito: prodTotal > 0 ? rejTotal / prodTotal : 0,
            canudosEncabeçados: encTotal,
            encabecadosPorHora: encTotal / encHoursTotal,
            canudosDecorados: decTotal,
            decoradosPorHora: decTotal / decHoursTotal,
            mediaHorasProduzindo: avgHrsProduzindo,

            custoTotalProducao: custoTotalReal,
            custoPerdaRejeito: custoRejeitoReal,
            custoMedioItem: custoMedioBase,

            dailyOee: {
                x: sortedDates.map(d => parseInt(d.split('-')[2])),
                y: sortedDates.map(d => dailyOee[d].sum / dailyOee[d].n)
            },
            dailyProd: {
                x: sortedDates.map(d => parseInt(d.split('-')[2])),
                y: sortedDates.map(d => dailyProd[d] || 0)
            },

            monthlyOee: { x: monthKeys, y: monthKeys.map(k => monthlyStats[k].oeeN > 0 ? monthlyStats[k].oeeSum / monthlyStats[k].oeeN : 0) },
            monthlyTeep: { x: monthKeys, y: monthKeys.map(k => monthlyStats[k].teepN > 0 ? (monthlyStats[k].teepSum / monthlyStats[k].teepN) * 100 : 0) },
            monthlyProd: { x: monthKeys, y: monthKeys.map(k => monthlyStats[k].prod) }
        }
    }

    const handleGenerate = async (type: string) => {
        setReportType(type)
        setGenerating(true)
        try {
            // 1. Buscar Dados
            const [oeeRes, canRes, fichasRes] = await Promise.all([
                fetch('/api/data/oee').then(r => r.json()),
                fetch('/api/data/canudos').then(r => r.json()),
                fetch('/api/data/fichas').then(r => r.json())
            ])

            if (oeeRes.error || canRes.error) throw new Error('Falha ao obter dados básicos')

            // 2. Processar Dados
            const calc = calculateReportData(oeeRes.data, oeeRes.producao, canRes.data, fichasRes.fichas || [])
            setReportData(calc)

            // 3. Aguardar renderização e Gerar PDF
            setTimeout(async () => {
                const element = document.getElementById(`relatorio-${type}-pdf`)
                if (!element) return

                const canvas = await html2canvas(element, { scale: 2, useCORS: true })
                const imgData = canvas.toDataURL('image/png')

                const pdf = new jsPDF('l', 'px', [1120, 792])
                pdf.addImage(imgData, 'PNG', 0, 0, 1120, 792)
                const typeName = type.charAt(0).toUpperCase() + type.slice(1)
                pdf.save(`Relatorio_${typeName}_${dateFrom}_${dateTo}.pdf`)

                setGenerating(false)
                setReportData(null)
            }, 500)

        } catch (e) {
            console.error(e)
            alert('Erro ao gerar relatório: ' + e)
            setGenerating(false)
        }
    }

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Repositório de Relatórios</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gere documentos analíticos consolidados em formato PDF</p>
            </div>

            {/* Filtros Identicos aos Dashboards */}
            <div className="card" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>De</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={isoToBr(dateFrom)}
                                onChange={e => {
                                    const masked = maskDate(e.target.value)
                                    if (masked.length === 10) {
                                        const iso = brToIso(masked)
                                        if (iso) setDateFrom(iso)
                                    }
                                }}
                                style={{ width: 110, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none' }}
                            />
                            <button
                                onClick={() => dateFromPickerRef.current?.showPicker()}
                                style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}
                            >
                                📅
                            </button>
                            <input
                                type="date"
                                ref={dateFromPickerRef}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                onChange={e => setDateFrom(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Até</label>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={isoToBr(dateTo)}
                                onChange={e => {
                                    const masked = maskDate(e.target.value)
                                    if (masked.length === 10) {
                                        const iso = brToIso(masked)
                                        if (iso) setDateTo(iso)
                                    }
                                }}
                                style={{ width: 110, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14, outline: 'none' }}
                            />
                            <button
                                onClick={() => dateToPickerRef.current?.showPicker()}
                                style={{ position: 'absolute', right: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, opacity: 0.6 }}
                            >
                                📅
                            </button>
                            <input
                                type="date"
                                ref={dateToPickerRef}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                                onChange={e => setDateTo(e.target.value)}
                            />
                        </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '300px' }}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Máquinas</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {MAQ_ORDER.map(k => (
                                <button
                                    key={k}
                                    onClick={() => toggleMaq(k)}
                                    style={{
                                        padding: '6px 16px',
                                        fontSize: 13,
                                        borderRadius: '20px',
                                        border: '1px solid var(--border)',
                                        background: selMaqs.includes(k) ? 'var(--primary-accent)' : 'rgba(255,255,255,0.03)',
                                        color: selMaqs.includes(k) ? 'white' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontWeight: 700,
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {k}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={() => alert('Filtros aplicados para geração dos relatórios')}
                        style={{ height: 40, padding: '0 20px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
                    >
                        ↻ Atualizar
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
                {[
                    { id: 'geral', title: 'Relatório Geral - Impressão Digital (Mensal)', desc: 'Dashboard completo com todas as máquinas, OEE e TEEP.', icon: '📊' },
                    { id: 'producao', title: 'Resumo de Produção', desc: 'Foco em volumes, rejeitos e performance de operadores.', icon: '⚙️' },
                    { id: 'custos', title: 'Detalhamento de Custos', desc: 'Análise financeira baseada nos consumos das fichas técnicas.', icon: '💰' },
                ].map(rel => (
                    <div key={rel.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ fontSize: 32 }}>{rel.icon}</div>
                        <div>
                            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{rel.title}</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{rel.desc}</p>
                        </div>
                        <button
                            className="btn btn-secondary"
                            onClick={() => handleGenerate(rel.id)}
                            disabled={generating}
                            style={{ marginTop: 'auto', width: '100%', justifyContent: 'center' }}
                        >
                            {generating ? 'Processando...' : 'Gerar PDF'}
                        </button>
                    </div>
                ))}
            </div>

            {/* Template Invisível para Captura */}
            {reportData && (
                <div style={{ position: 'absolute', left: '-5000px', top: 0 }}>
                    {reportType === 'geral' && <RelatorioGeralTemplate data={reportData} />}
                    {reportType === 'producao' && <RelatorioProducaoTemplate data={reportData} />}
                    {reportType === 'custos' && <RelatorioCustosTemplate data={reportData} />}
                </div>
            )}
        </div>
    )
}
