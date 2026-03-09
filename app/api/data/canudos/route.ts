import { NextResponse } from 'next/server'
import { fetchXlsxFromGitHub } from '@/lib/github-data'
import { parseCanudosXlsx } from '@/lib/data-parsers'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado', data: { encabecados: [], decorados: [] } }, { status: 401 })
        }

        const buffer = await fetchXlsxFromGitHub('Canudos.xlsx')
        const data = parseCanudosXlsx(buffer)
        return NextResponse.json({ data })
    } catch (err) {
        console.error('[API /data/canudos]', err)
        return NextResponse.json(
            { error: String(err), data: { encabecados: [], decorados: [] } },
            { status: 500 }
        )
    }
}
