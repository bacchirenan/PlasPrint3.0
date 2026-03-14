'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { OrdemProgramada, ProducaoRow } from '@/lib/types'

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

/**
 * Calcula a estimativa de término respeitando:
 * - Segunda a Sábado
 * - Das 06:00 às 22:00
 */
function calculateCompletionDate(pcsFaltantes: number, pcsHora: number): string {
    if (pcsFaltantes <= 0) return 'Concluído';
    if (pcsHora <= 0) return 'N/A (Sem Ritmo)';

    let hoursNeeded = pcsFaltantes / pcsHora;
    let current = new Date();

    while (hoursNeeded > 0) {
        const day = current.getDay(); // 0 = Domingo, 1 = Segunda...
        const hour = current.getHours();
        const minutes = current.getMinutes();
        const currentHourFloat = hour + (minutes / 60);

        // 1. Se for Domingo, pula para Segunda 06:00
        if (day === 0) {
            current.setDate(current.getDate() + 1);
            current.setHours(6, 0, 0, 0);
            continue;
        }

        // 2. Se for antes das 06:00, pula para as 06:00 do mesmo dia
        if (currentHourFloat < 6) {
            current.setHours(6, 0, 0, 0);
            continue;
        }

        // 3. Se for depois das 22:00, pula para as 06:00 do dia seguinte
        if (currentHourFloat >= 22) {
            current.setDate(current.getDate() + 1);
            current.setHours(6, 0, 0, 0);
            continue;
        }

        // 4. Calcula quanto tempo sobra no turno de hoje (até as 22h)
        const availableToday = 22 - currentHourFloat;

        if (hoursNeeded <= availableToday) {
            // Termina hoje!
            const totalMinutesToAdd = hoursNeeded * 60;
            current.setMinutes(current.getMinutes() + totalMinutesToAdd);
            hoursNeeded = 0;
        } else {
            // Consome o que sobra hoje e pula para o próximo dia útil
            hoursNeeded -= availableToday;
            current.setDate(current.getDate() + 1);
            current.setHours(6, 0, 0, 0);
        }
    }

    const d = current.getDate().toString().padStart(2, '0');
    const m = (current.getMonth() + 1).toString().padStart(2, '0');
    const y = current.getFullYear();
    const hr = current.getHours().toString().padStart(2, '0');
    const min = current.getMinutes().toString().padStart(2, '0');

    return `${d}/${m}/${y} ${hr}:${min}`;
}

// ─── Componente de Tabela Reutilizável ───────────────────────────────────────
interface TableSectionProps {
    title: string;
    icon: string;
    headers: string[];
    children?: React.ReactNode;
    action?: React.ReactNode;
    footer?: React.ReactNode;
}

function TableSection({ title, icon, headers, children, action, footer }: TableSectionProps) {
    return (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-card)', background: 'rgba(13, 30, 56, 0.4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>{icon}</span>
                    <h2 className="card-title" style={{ fontSize: '16px', margin: 0 }}>{title}</h2>
                </div>
                {action}
            </div>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-card)', background: 'rgba(59, 130, 246, 0.05)' }}>
                            {headers.map((h, i) => (
                                <th key={i} style={{
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {children}
                    </tbody>
                </table>
            </div>
            {footer && (
                <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid var(--border-card)', background: 'rgba(59, 130, 246, 0.02)' }}>
                    {footer}
                </div>
            )}
        </div>
    );
}

const MACHINE_TABLE_HEADERS = ['OS', 'Produto', 'Peças/Hora', 'Plan. (Ciclos)', 'Realiz. (Ciclos)', '% Progresso', 'Finaliza'];

export default function CargaMaquinaPage() {
    const [loading, setLoading] = useState(true)
    const [ordens, setOrdens] = useState<OrdemProgramada[]>([])
    const [producaoData, setProducaoData] = useState<ProducaoRow[]>([])
    
    // UI states
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingOrder, setEditingOrder] = useState<OrdemProgramada | null>(null)
    const [isPendingExpanded, setIsPendingExpanded] = useState(false)
    const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)

    // Form states
    const [formOS, setFormOS] = useState('')
    const [formProduto, setFormProduto] = useState('')
    const [formCiclo, setFormCiclo] = useState('')
    const [formCiclosPlanj, setFormCiclosPlanj] = useState('')
    const [formCiclosRealiz, setFormCiclosRealiz] = useState('')

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    const loadResources = async (isInitial = false) => {
        setLoading(true)
        
        // 1. Banco de Dados (Ordens Programadas)
        if (isInitial) {
            try {
                const res = await fetch('/api/ordens')
                const json = await res.json()
                if (json.data) {
                    setOrdens(json.data)
                }
            } catch (e) {
                console.error("Erro ao carregar ordens do banco:", e)
            }
        }

        // 2. Produção API (Planilha GitHub)
        try {
            const res = await fetch('/api/data/producao?t=' + Date.now())
            const json = await res.json()
            if (json.data) {
                setProducaoData(json.data)
            }
        } catch (e) {
            console.error("Erro ao carregar dados de produção", e)
        } finally {
            setLoading(false)
        }
    }

    // Carregar dados iniciais
    useEffect(() => {
        loadResources(true)
    }, [])


    // ─── Processamento de Dados (Search e Agregação) ───────────────────────────
    const processedData = useMemo(() => {
        const machineGroups: Record<string, any[]> = {
            '28': [], '29': [], '180': [], '181': [], '182': []
        }
        const activeOsIds = new Set<string>()
        const osTotals: Record<string, number> = {} // Somatório global por OS

        if (!producaoData.length || !ordens.length) return { machineGroups, activeOsIds, osTotals }

        // Helpers para normalização
        const normalizeOs = (val: string) => val.toString().replace(/\D/g, '')
        const isProducao = (r: string) => {
            if (!r) return false
            return r.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 'producao'
        }
        const cleanProductName = (name: string) => {
            if (!name) return ''
            
            // 1. Separar o processo (final da string após o último ' - ')
            const processParts = name.split(' - ')
            const process = processParts.length > 1 ? processParts[processParts.length - 1] : ''
            let main = processParts[0]

            // 2. Limpar o prefixo do código (CIPF...)
            main = main.replace(/^CIPF\d+-/i, '')

            // 3. Tentar extrair Referência e Descrição seguindo o padrão _ e -
            // Ex: JARD-ENC_26-S4-GARRAFA CILINDRICA...
            if (main.includes('_')) {
                const parts = main.split('_')
                const ref = parts[0].replace(/-/g, ' ') // Referência: JARD-ENC -> JARD ENC
                const rest = parts[1] || ''
                
                // Remover versão e máquina do 'rest' (ex: 26-S4-GARRAFA...)
                // Padrão: qualquer-coisa-S-digitos-DESCRICAO
                const descMatch = rest.match(/^[^-]+-S\d+-(.*)$/)
                const desc = descMatch ? descMatch[1] : rest
                
                return `${ref} - ${desc}${process ? ' - ' + process : ''}`
            }

            // Fallback (ex: CIPF002438-PRINCESAS-24 - ...)
            // Pega as partes após o primeiro ' - ' e junta
            if (processParts.length > 1) {
                return processParts.slice(1).join(' - ').trim()
            }
            
            return main.trim()
        }

        // 1. Agrupar produção por OS e Máquina e identificar a ÚLTIMA OS de cada máquina
        const prodByOsMaq: Record<string, Record<string, any>> = {}
        const latestOsByMaq: Record<string, string> = {} // { '180': 'os_norm' }

        producaoData.forEach(row => {
            const os = normalizeOs(row.os || '')
            if (!os) return

            // Acumular total global da OS para a tabela principal
            osTotals[os] = (osTotals[os] || 0) + row.pecas_boas

            const maqKey = row.maquina.split('-')[0].trim()
            const cleanedProd = cleanProductName(row.produto)
            
            // Como percorremos a planilha na ordem das linhas, 
            // a última OS que aparecer para a máquina é a OS Ativa atual.
            latestOsByMaq[maqKey] = os

            if (!prodByOsMaq[os]) prodByOsMaq[os] = {}
            if (!prodByOsMaq[os][maqKey]) {
                prodByOsMaq[os][maqKey] = {
                    os: row.os,
                    produto: cleanedProd,
                    pecas_boas_total: 0, 
                    pecas_boas_producao: 0,
                    tempo_segundos_producao: 0,
                }
            }

            prodByOsMaq[os][maqKey].pecas_boas_total += row.pecas_boas
            
            if (isProducao(row.registro)) {
                prodByOsMaq[os][maqKey].pecas_boas_producao += row.pecas_boas
                prodByOsMaq[os][maqKey].tempo_segundos_producao += row.tempo_segundos
            }
            
            prodByOsMaq[os][maqKey].produto = cleanedProd
        })

        // 2. Cruzar com as ordens programadas
        ordens.forEach(ordem => {
            const osNorm = normalizeOs(ordem.os)
            const match = prodByOsMaq[osNorm]

            if (match) {
                Object.keys(match).forEach(maqKey => {
                    const data = match[maqKey]
                    const isLatest = latestOsByMaq[maqKey] === osNorm
                    const isFinished = data.pecas_boas_total >= ordem.ciclos_planejados

                    // REGRA: Só fica na tabela da máquina se for a ÚLTIMA que rodou 
                    // OU se já estiver Concluída. Caso contrário (está pausada), 
                    // ela volta para a lista de programadas/pendentes.
                    if (isLatest || isFinished) {
                        const horasProd = data.tempo_segundos_producao / 3600
                        const pcsHora = horasProd > 0 ? data.pecas_boas_producao / horasProd : 0

                        if (machineGroups[maqKey]) {
                            machineGroups[maqKey].push({
                                os: data.os,
                                produto: data.produto,
                                pcsHora: pcsHora,
                                planejado: ordem.ciclos_planejados,
                                realizado: data.pecas_boas_total,
                                status: isFinished ? 'Concluído' : 'Produzindo'
                            })
                        }
                        
                        // Marca como ativa para remover da tabela principal
                        activeOsIds.add(ordem.id)
                    }
                })
            }
        })

        return { machineGroups, activeOsIds, osTotals }
    }, [producaoData, ordens])

    // Filtra ordens que ainda NÃO estão em nenhuma máquina e não concluídas
    const pendingOrders = useMemo(() => {
        return ordens.filter(o => {
            if (processedData.activeOsIds.has(o.id)) return false;
            const osNorm = o.os.toString().replace(/\D/g, '');
            const dbRealizados = Number(o.ciclos_realizados) || 0;
            const planRealizados = processedData.osTotals[osNorm] !== undefined ? Number(processedData.osTotals[osNorm]) : 0;
            const realizados = Math.max(dbRealizados, planRealizados);
            
            const planejados = Number(o.ciclos_planejados) || 0;
            if (planejados > 0) {
                const progresso = Math.round((realizados / planejados) * 100);
                if (progresso >= 100) return false;
            }
            return true;
        }).map(o => {
            const osNorm = o.os.toString().replace(/\D/g, '')
            const dbRealizados = Number(o.ciclos_realizados) || 0;
            const planRealizados = processedData.osTotals[osNorm] !== undefined ? Number(processedData.osTotals[osNorm]) : 0;
            return {
                ...o,
                ciclos_realizados: Math.max(dbRealizados, planRealizados)
            }
        })
    }, [ordens, processedData])

    // Filtra todas as ordens que atingiram 100% de produção
    const completedOrders = useMemo(() => {
        return ordens.map(o => {
            const osNorm = o.os.toString().replace(/\D/g, '')
            const dbRealizados = Number(o.ciclos_realizados) || 0;
            const planRealizados = processedData.osTotals[osNorm] !== undefined ? Number(processedData.osTotals[osNorm]) : 0;
            return {
                ...o,
                ciclos_realizados: Math.max(dbRealizados, planRealizados)
            }
        }).filter(o => {
            const planejados = Number(o.ciclos_planejados) || 0;
            if (planejados > 0) {
                const progresso = Math.round((Number(o.ciclos_realizados) / planejados) * 100);
                return progresso >= 100;
            }
            return false;
        })
    }, [ordens, processedData])

    const machineOrders = processedData.machineGroups

    // Modais e handlers
    const handleOpenModal = (ordem?: OrdemProgramada) => {
        if (ordem) {
            setEditingOrder(ordem)
            setFormOS(ordem.os)
            setFormProduto(ordem.produto)
            setFormCiclo(ordem.ciclo.toString())
            setFormCiclosPlanj(ordem.ciclos_planejados.toString())
            setFormCiclosRealiz(ordem.ciclos_realizados.toString())
        } else {
            setEditingOrder(null)
            setFormOS('')
            setFormProduto('')
            setFormCiclo('')
            setFormCiclosPlanj('')
            setFormCiclosRealiz('')
        }
        setIsModalOpen(true)
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        
        const payload = {
            os: formOS,
            produto: formProduto,
            ciclo: parseFloat(formCiclo) || 0,
            ciclos_planejados: parseInt(formCiclosPlanj) || 0,
            ciclos_realizados: parseInt(formCiclosRealiz) || 0,
            updated_at: new Date().toISOString()
        }

        try {
            let res;
            if (editingOrder) {
                res = await fetch(`/api/ordens/${editingOrder.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
            } else {
                res = await fetch('/api/ordens', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...payload,
                        created_at: new Date().toISOString()
                    })
                })
            }

            const json = await res.json()

            if (!res.ok) {
                throw new Error(json.error || 'Erro desconhecido ao salvar')
            }

            if (json.data) {
                if (editingOrder) {
                    setOrdens(prev => prev.map(o => o.id === editingOrder.id ? json.data : o))
                } else {
                    setOrdens(prev => [json.data, ...prev])
                }
                setIsModalOpen(false)
            }
        } catch (error: any) {
            console.error('Erro ao salvar ordem:', error)
            alert(`Erro ao salvar: ${error.message}. Verifique se a tabela 'ordens_programadas' existe no banco de dados.`)
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm("Tem certeza que deseja excluir esta ordem?")) {
            try {
                const res = await fetch(`/api/ordens/${id}`, { method: 'DELETE' })
                if (!res.ok) {
                    const json = await res.json()
                    throw new Error(json.error || 'Erro ao deletar')
                }
                setOrdens(prev => prev.filter(o => o.id !== id))
            } catch (error: any) {
                console.error('Erro ao deletar ordem:', error)
                alert(`Erro ao excluir: ${error.message}`)
            }
        }
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 16 }}>
                <div className="spinner" />
                <p style={{ color: 'var(--text-muted)' }}>Sincronizando dados com a planilha de produção...</p>
            </div>
        )
    }

    return (
        <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>Programação</h1>
                </div>
                <button 
                    className="btn btn-secondary" 
                    onClick={() => loadResources(false)}
                    disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
                >
                    {loading ? 'Sincronizando...' : '🔄 Atualizar Dados'}
                </button>
            </div>


            {/* Ordens Programadas */}
            <TableSection 
                title="Ordens Programadas (Aguardando Produção)" 
                icon="📋" 
                headers={['OS', 'Produto', 'Peças Hora', 'Planejado', 'Realizado', '% Progresso', 'Ações']}
                action={
                    <button 
                        className="btn btn-primary" 
                        style={{ padding: '8px 16px', fontSize: '12px' }}
                        onClick={() => handleOpenModal()}
                    >
                        + Nova Ordem
                    </button>
                }
            >
                {pendingOrders.length > 0 ? (
                    (isPendingExpanded ? pendingOrders : pendingOrders.slice(0, 5)).map((ordem) => {
                        const progresso = ordem.ciclos_planejados > 0 
                            ? Math.min(100, (ordem.ciclos_realizados / ordem.ciclos_planejados) * 100) 
                            : 0;

                        return (
                            <tr key={ordem.id} style={{ borderBottom: '1px solid var(--border-card)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary-accent)' }}>{ordem.os}</td>
                                <td style={{ padding: '12px 16px' }}>{ordem.produto}</td>
                                <td style={{ padding: '12px 16px' }}>{ordem.ciclo}s</td>
                                <td style={{ padding: '12px 16px' }}>{ordem.ciclos_planejados.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px' }}>{ordem.ciclos_realizados.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                            <div style={{ width: `${progresso}%`, height: '100%', background: progresso >= 80 ? 'var(--success)' : 'var(--primary-accent)' }} />
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: 600 }}>{progresso.toFixed(0)}%</span>
                                    </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => handleOpenModal(ordem)}
                                            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--primary-accent)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                        >
                                            Editar
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(ordem.id)}
                                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                        >
                                            Excluir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                ) : (
                    <tr>
                        <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Nenhuma ordem programada cadastrada.
                        </td>
                    </tr>
                )}
            </TableSection>
            {pendingOrders.length > 5 && (
                <div style={{ marginTop: '-16px', marginBottom: '24px', textAlign: 'center' }}>
                    <button 
                        onClick={() => setIsPendingExpanded(!isPendingExpanded)}
                        style={{ 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            border: '1px solid rgba(59, 130, 246, 0.2)', 
                            color: 'var(--primary-accent)', 
                            padding: '6px 20px', 
                            borderRadius: '20px', 
                            cursor: 'pointer', 
                            fontSize: '12px',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                        }}
                    >
                        {isPendingExpanded ? '↑ Mostrar Menos' : `↓ Ver todas (${pendingOrders.length})`}
                    </button>
                </div>
            )}
            
            {/* Título da Seção de Máquinas sem divisor extra para manter o padrão de 24px */}
            <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', fontWeight: 800 }}>Programação por Máquina</h2>

            {/* Tabelas de Máquinas dinâmicas */}
            {['28', '29', '180', '181', '182'].map(maq => (
                <TableSection 
                    key={maq}
                    title={`Máquina ${maq}`} 
                    icon="⚙️" 
                    headers={MACHINE_TABLE_HEADERS} 
                >
                    {machineOrders[maq]?.length > 0 ? (
                        machineOrders[maq].map((data, idx) => (
                            <tr key={`${maq}-${idx}`} style={{ borderBottom: '1px solid var(--border-card)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--primary-accent)' }}>{data.os}</td>
                                <td style={{ padding: '12px 16px' }}>{data.produto}</td>
                                <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--success)' }}>
                                    {Math.round(data.pcsHora).toLocaleString()} <span style={{fontSize: '10px', opacity: 0.7}}>pçs/h</span>
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{data.planejado.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{data.realizado.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px' }}>
                                    {(() => {
                                        const progresso = data.planejado > 0 
                                            ? Math.min(100, (data.realizado / data.planejado) * 100) 
                                            : 0;
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '100px' }}>
                                                <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${progresso}%`, height: '100%', background: progresso >= 80 ? 'var(--success)' : 'var(--primary-accent)' }} />
                                                </div>
                                                <span style={{ fontSize: '11px', fontWeight: 600 }}>{progresso.toFixed(0)}%</span>
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '12px', whiteSpace: 'nowrap', fontWeight: 500, color: 'var(--primary-bright)' }}>
                                    {calculateCompletionDate(data.planejado - data.realizado, data.pcsHora)}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={MACHINE_TABLE_HEADERS.length} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                Nenhuma ordem sincronizada para esta máquina.
                            </td>
                        </tr>
                    )}
                </TableSection>
            ))}

            {/* Tabela de Produzidos (100% Concluídos) */}
            <h2 style={{ fontSize: '18px', color: '#fff', marginBottom: '16px', marginTop: '24px', fontWeight: 800 }}>Produzidos</h2>
            <TableSection 
                title="Ordens Concluídas (100% ou mais)" 
                icon="✅" 
                headers={['OS', 'Produto', 'Peças Hora', 'Planejado', 'Realizado', '% Progresso', 'Ações']}
            >
                {completedOrders.length > 0 ? (
                    (isCompletedExpanded ? completedOrders : completedOrders.slice(0, 5)).map((ordem) => {
                        const progresso = Math.min(100, (ordem.ciclos_realizados / ordem.ciclos_planejados) * 100);

                        return (
                            <tr key={`completed-${ordem.id}`} style={{ borderBottom: '1px solid var(--border-card)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--success)' }}>{ordem.os}</td>
                                <td style={{ padding: '12px 16px' }}>{ordem.produto}</td>
                                <td style={{ padding: '12px 16px' }}>{ordem.ciclo}s</td>
                                <td style={{ padding: '12px 16px' }}>{ordem.ciclos_planejados.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', fontWeight: 700 }}>{ordem.ciclos_realizados.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                                            <div style={{ width: `100%`, height: '100%', background: 'var(--success)' }} />
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: 600 }}>100%</span>
                                    </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            onClick={() => handleOpenModal(ordem)}
                                            style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', color: 'var(--primary-accent)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                        >
                                            Editar
                                        </button>
                                        <button 
                                            onClick={() => handleDelete(ordem.id)}
                                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                        >
                                            Excluir
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })
                ) : (
                    <tr>
                        <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Nenhuma ordem concluída encontrada.
                        </td>
                    </tr>
                )}
            </TableSection>
            {completedOrders.length > 5 && (
                <div style={{ marginTop: '-16px', marginBottom: '24px', textAlign: 'center' }}>
                    <button 
                        onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                        style={{ 
                            background: 'rgba(16, 185, 129, 0.1)', 
                            border: '1px solid rgba(16, 185, 129, 0.2)', 
                            color: 'var(--success)', 
                            padding: '6px 20px', 
                            borderRadius: '20px', 
                            cursor: 'pointer', 
                            fontSize: '12px',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                        }}
                    >
                        {isCompletedExpanded ? '↑ Mostrar Menos' : `↓ Ver todas (${completedOrders.length})`}
                    </button>
                </div>
            )}

            {/* Modal de Cadastro/Edição */}
            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px', position: 'relative' }}>
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px' }}
                        >
                            ✕
                        </button>
                        <h2 className="card-title" style={{ marginBottom: '24px' }}>
                            {editingOrder ? 'Editar Ordem' : 'Nova Ordem Programada'}
                        </h2>
                        
                        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>OS (Ordem de Serviço)</label>
                                <input 
                                    required
                                    type="text" 
                                    className="input" 
                                    value={formOS} 
                                    onChange={e => setFormOS(e.target.value)} 
                                    placeholder="Ex: 12345"
                                    style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff' }}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Produto</label>
                                <input 
                                    required
                                    type="text" 
                                    className="input" 
                                    value={formProduto} 
                                    onChange={e => setFormProduto(e.target.value)} 
                                    placeholder="Nome do produto"
                                    style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Peças Hora</label>
                                    <input 
                                        required
                                        type="number" 
                                        step="0.01"
                                        className="input" 
                                        value={formCiclo} 
                                        onChange={e => setFormCiclo(e.target.value)} 
                                        placeholder="Ex: 4.5"
                                        style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Ciclos Planejados</label>
                                    <input 
                                        required
                                        type="number" 
                                        className="input" 
                                        value={formCiclosPlanj} 
                                        onChange={e => setFormCiclosPlanj(e.target.value)} 
                                        placeholder="Qtd total"
                                        style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>Ciclos Realizados</label>
                                <input 
                                    type="number" 
                                    className="input" 
                                    value={formCiclosRealiz} 
                                    onChange={e => setFormCiclosRealiz(e.target.value)} 
                                    placeholder="Qtd produzida"
                                    style={{ width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff' }}
                                />
                            </div>
                            
                            <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    style={{ flex: 1 }}
                                    onClick={() => setIsModalOpen(false)}
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary" 
                                    style={{ flex: 1 }}
                                >
                                    Salvar Ordem
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
