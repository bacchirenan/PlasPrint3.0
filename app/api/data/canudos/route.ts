import { NextResponse } from 'next/server'
import { fetchXlsxFromGitHub } from '@/lib/github-data'
import { parseCanudosXlsx } from '@/lib/data-parsers'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export async function GET() {
    try {
        const buffer = await fetchXlsxFromGitHub('Canudos.xlsx')
        const rows = parseCanudosXlsx(buffer)
        return NextResponse.json({ data: rows, count: rows.length })
    } catch (err) {
        console.error('[API /data/canudos]', err)
        return NextResponse.json(
            { error: String(err), data: [] },
            { status: 500 }
        )
    }
}
