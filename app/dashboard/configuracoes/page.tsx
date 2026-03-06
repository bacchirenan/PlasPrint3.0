'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CORES_TINTA, COR_LABELS } from '@/lib/types'

export default function ConfiguracoesPage() {
    const [inkCosts, setInkCosts] = useState<Record<string, number>>({})
    const [importTax, setImportTax] = useState(0)
    const [dolar, setDolar] = useState(0)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const supabase = createClient()

    useEffect(() => {
        async function load() {
            // 1. Carrega preços do Supabase
            const { data: costs } = await supabase.from('ink_costs').select('*')
            const costMap: Record<string, number> = {}
            costs?.forEach(c => costMap[c.cor] = c.preco_litro_usd)
            setInkCosts(costMap)

            // 2. Carrega imposto
            const { data: config } = await supabase.from('app_config').select('*').eq('chave', 'import_tax').single()
            setImportTax(config?.valor || 0)

            // 3. Busca cotação atual do dólar
            try {
                const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL')
                const json = await res.json()
                setDolar(parseFloat(json.USDBRL.bid))
            } catch (e) {
                setDolar(5.80) // fallback
            }

            setLoading(false)
        }
        load()
    }, [supabase])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/config/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ inkCosts, importTax, dolar })
            })
            const data = await res.json()
            if (!data.ok) throw new Error(data.error || 'Erro desconhecido')
            alert('Configurações salvas com sucesso!')
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            alert(`Erro ao salvar:\n\n${msg}`)
            console.error('[Configurações] Erro:', e)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="spinner-container"><div className="spinner" /></div>

    return (
        <div className="page-container" style={{ maxWidth: 800, margin: '0 auto' }}>
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Configurações do Sistema</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Gerencie preços de insumos, taxas e parâmetros de cálculo</p>
            </div>

            <div style={{ display: 'grid', gap: 24 }}>
                {/* Câmbio */}
                <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Cotação Atual (USD/BRL)</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--info)' }}>R$ {dolar.toFixed(2)}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                        Atualizado via IA API
                    </div>
                </div>

                {/* Preços de Tinta */}
                <div className="card">
                    <div className="card-title" style={{ marginBottom: 20 }}>Preços de Tinta por Litro (USD)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        {CORES_TINTA.map(cor => (
                            <div key={cor}>
                                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{COR_LABELS[cor]}</label>
                                <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', left: 12, top: 10, color: 'var(--text-disabled)', fontSize: 13 }}>$</span>
                                    <input
                                        type="number"
                                        value={inkCosts[cor] || ''}
                                        onChange={e => setInkCosts(prev => ({ ...prev, [cor]: parseFloat(e.target.value) }))}
                                        style={{
                                            width: '100%',
                                            background: 'var(--bg-input)',
                                            border: '1px solid var(--border)',
                                            borderRadius: 8,
                                            color: 'var(--text-primary)',
                                            padding: '10px 10px 10px 28px',
                                            fontSize: 14,
                                            outline: 'none'
                                        }}
                                    />
                                    <span style={{ position: 'absolute', right: 12, top: 10, color: 'var(--success)', fontSize: 11, fontWeight: 600 }}>
                                        ≈ R$ {((inkCosts[cor] || 0) * dolar).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parâmetros Gerais */}
                <div className="card">
                    <div className="card-title" style={{ marginBottom: 20 }}>Parâmetros de Importação</div>
                    <div>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Imposto de Importação (%)</label>
                        <div style={{ position: 'relative', width: '200px' }}>
                            <input
                                type="number"
                                value={importTax}
                                onChange={e => setImportTax(parseFloat(e.target.value))}
                                style={{
                                    width: '100%',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    color: 'var(--text-primary)',
                                    padding: '10px 30px 10px 16px',
                                    fontSize: 14,
                                    outline: 'none'
                                }}
                            />
                            <span style={{ position: 'absolute', right: 12, top: 10, color: 'var(--text-disabled)' }}>%</span>
                        </div>
                    </div>
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleSave}
                    disabled={saving}
                    style={{ padding: '14px', fontSize: 15, fontWeight: 700 }}
                >
                    {saving ? 'Salvando...' : 'Salvar Todas as Configurações'}
                </button>
            </div>
        </div>
    )
}
