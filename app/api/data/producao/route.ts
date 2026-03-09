import { NextResponse } from 'next/server'
import { fetchXlsxFromGitHub } from '@/lib/github-data'
import { parseProducaoXlsx } from '@/lib/data-parsers'
import { createClient } from '@/lib/supabase/server'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 minutos

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado', data: [] }, { status: 401 })
        }

        const cwd = process.cwd()
        const localPath = path.join(cwd, 'producao.xlsx')
        const isDev = process.env.NODE_ENV === 'development'

        let buffer: ArrayBuffer
        // Se estiver em desenvolvimento e o arquivo existir localmente, usa ele (mais rápido)
        // Em produção, SEMPRE busca do GitHub para garantir que os dados estão atualizados
        if (isDev && fs.existsSync(localPath)) {
            const nodeBuffer = fs.readFileSync(localPath)
            buffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength)
        } else {
            buffer = await fetchXlsxFromGitHub('producao.xlsx')
        }

        const rows = parseProducaoXlsx(buffer)
        return NextResponse.json({
            data: rows,
            count: rows.length,
            debug: {
                repo: process.env.GITHUB_REPO || 'bacchirenan/PlasPrint3.0',
                branch: process.env.GITHUB_BRANCH || 'main',
                isDev,
                hasUser: !!user
            }
        })
    } catch (err) {
        console.error('[API /data/producao]', err)
        return NextResponse.json(
            { error: String(err), data: [] },
            { status: 500 }
        )
    }
}
