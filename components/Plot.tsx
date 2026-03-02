/// <reference path="../lib/custom-types.d.ts" />
'use client'

import React from 'react'
import dynamic from 'next/dynamic'

interface PlotProps {
    data: any[]
    layout?: any
    config?: any
    style?: React.CSSProperties
    className?: string
    onHover?: (event: any) => void
    onUnhover?: (event: any) => void
    onClick?: (event: any) => void
    useResizeHandler?: boolean
}

// Criamos um componente que carrega o Plotly apenas no cliente
const PlotlyComponent = dynamic(
    async () => {
        // Importamos as bibliotecas apenas no lado do cliente
        const plotly = await import('plotly.js-dist-min')
        const createPlotlyComponent = (await import('react-plotly.js/factory')).default
        return createPlotlyComponent(plotly)
    },
    {
        ssr: false,
        loading: () => (
            <div style={{
                height: '320px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(59, 130, 246, 0.03)',
                borderRadius: '12px',
                color: 'var(--text-muted)',
                fontSize: '12px',
                border: '1px dashed var(--border-card)'
            }}>
                Carregando gráfico...
            </div>
        )
    }
)

const Plot = (props: PlotProps) => {
    return <PlotlyComponent {...props} />
}

export default Plot
