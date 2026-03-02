import { NextResponse } from 'next/server'
import { fetchXlsxFromGitHub } from '@/lib/github-data'
import { parseProducaoXlsx } from '@/lib/data-parsers'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 minutos

export async function GET() {
    try {
        const buffer = await fetchXlsxFromGitHub('producao.xlsx')
        const rows = parseProducaoXlsx(buffer)
        return NextResponse.json({ data: rows, count: rows.length })
    } catch (err) {
        console.error('[API /data/producao]', err)
        return NextResponse.json(
            { error: String(err), data: [] },
            { status: 500 }
        )
    }
}
