import { NextResponse } from 'next/server'
import { fetchSqliteFromGitHub } from '@/lib/github-data'
import { createClient } from '@/lib/supabase/server'
import initSqlJs from 'sql.js'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const cwd = process.cwd()

        let dbBuffer: Buffer
        const localPath = path.join(cwd, 'fichas_tecnicas.db')
        const isDev = process.env.NODE_ENV === 'development'

        if (isDev && fs.existsSync(localPath)) {
            dbBuffer = fs.readFileSync(localPath)
        } else {
            dbBuffer = await fetchSqliteFromGitHub('fichas_tecnicas.db')
        }

        // Carregar WASM manualmente para o SQL.js
        const wasmPath = path.join(cwd, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm')
        const wasmBinary = fs.readFileSync(wasmPath)
        const SQL = await initSqlJs({ wasmBinary })
        const db = new SQL.Database(new Uint8Array(dbBuffer))

        // Dados do Supabase para custos
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado', fichas: [], produtos: [] }, { status: 401 })
        }

        const { data: inkCosts } = await supabase.from('ink_costs').select('*')
        const { data: configTax } = await supabase.from('app_config').select('*').eq('chave', 'import_tax').single()

        // Cotação do Dólar
        let dolar = 5.80
        try {
            const controller = new AbortController()
            const id = setTimeout(() => controller.abort(), 2000)
            const res = await fetch('https://economia.awesomeapi.com.br/last/USD-BRL', { signal: controller.signal })
            const json = await res.json()
            clearTimeout(id)
            dolar = parseFloat(json.USDBRL.bid)
        } catch (e) { }

        const precosBrl: Record<string, number> = {}
        inkCosts?.forEach(c => {
            precosBrl[c.cor] = c.preco_litro_brl || (c.preco_litro_usd * dolar)
        })

        const rawFichas = transformRows(db.exec("SELECT * FROM fichas ORDER BY id DESC"))
        const produtos = transformRows(db.exec("SELECT * FROM produtos"))

        const fichas = rawFichas.map((f: any) => {
            let custoTotalMil = 0
            const cores = ['cyan', 'magenta', 'yellow', 'black', 'white', 'varnish']
            cores.forEach(cor => {
                custoTotalMil += Number(f[cor] || 0) * (precosBrl[cor] || 0)
            })
            if (configTax?.valor) custoTotalMil *= (1 + (configTax.valor / 100))
            return {
                ...f,
                custo_tinta_total: custoTotalMil,
                custo_por_unidade: custoTotalMil / 1000
            }
        })

        db.close()

        return NextResponse.json({
            fichas,
            produtos,
            config: {
                dolar,
                imposto: configTax?.valor || 0,
                precos: precosBrl
            }
        })
    } catch (err) {
        console.error('[API Fichas]', err)
        return NextResponse.json({
            error: err instanceof Error ? err.message : String(err),
            fichas: [],
            produtos: []
        }, { status: 500 })
    }
}

function transformRows(res: any) {
    if (!res || res.length === 0) return []
    const columns = res[0].columns
    return res[0].values.map((row: any) => {
        const obj: any = {}
        columns.forEach((col: string, i: number) => {
            obj[col] = row[i]
        })
        return obj
    })
}
