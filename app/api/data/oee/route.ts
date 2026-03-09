import { NextResponse } from 'next/server'
import { fetchXlsxFromGitHub } from '@/lib/github-data'
import { parseOeeXlsx, parseProducaoXlsx } from '@/lib/data-parsers'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado', data: [] }, { status: 401 })
        }

        const [oeeBuffer, prodBuffer] = await Promise.all([
            fetchXlsxFromGitHub('oee teep.xlsx'),
            fetchXlsxFromGitHub('producao.xlsx'),
        ])

        const producaoRows = parseProducaoXlsx(prodBuffer)
        const oeeRows = parseOeeXlsx(oeeBuffer, producaoRows)

        return NextResponse.json({
            data: oeeRows,
            producao: producaoRows,
            count: oeeRows.length
        })
    } catch (err) {
        console.error('[API /data/oee]', err)
        return NextResponse.json(
            { error: String(err), data: [] },
            { status: 500 }
        )
    }
}

