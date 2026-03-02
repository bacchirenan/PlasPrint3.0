import { NextResponse } from 'next/server'
import { fetchXlsxFromGitHub } from '@/lib/github-data'
import { parseOeeXlsx, parseProducaoXlsx } from '@/lib/data-parsers'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export async function GET() {
    try {
        const [oeeBuffer, prodBuffer] = await Promise.all([
            fetchXlsxFromGitHub('oee teep.xlsx'),
            fetchXlsxFromGitHub('producao.xlsx'),
        ])

        const producaoRows = parseProducaoXlsx(prodBuffer)
        const oeeRows = parseOeeXlsx(oeeBuffer, producaoRows)

        return NextResponse.json({ data: oeeRows, count: oeeRows.length })
    } catch (err) {
        console.error('[API /data/oee]', err)
        return NextResponse.json(
            { error: String(err), data: [] },
            { status: 500 }
        )
    }
}
