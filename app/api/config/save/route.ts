import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Usa Service Role Key para ignorar RLS — NUNCA expor no client-side
function getAdminClient() {
    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

export async function POST(req: NextRequest) {
    try {
        // 1. Verificar autenticação
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Acesso não autorizado' }, { status: 401 })
        }

        // 2. Verificar se o usuário é administrador
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!profile || profile.role !== 'admin') {
            return NextResponse.json({ ok: false, error: 'Permissão insuficiente' }, { status: 403 })
        }

        const { inkCosts, importTax, dolar } = await req.json()
        const adminSupabase = getAdminClient()

        // Restante do código de salvamento
        const cores = Object.keys(inkCosts)
        for (const cor of cores) {
            const { error } = await adminSupabase.from('ink_costs').upsert(
                {
                    cor,
                    preco_litro_usd: inkCosts[cor] || 0,
                    preco_litro_brl: (inkCosts[cor] || 0) * dolar
                },
                { onConflict: 'cor' }
            )
            if (error) throw new Error(`Tinta (${cor}): ${error.message}`)
        }

        // Salva imposto de importação
        const { data: existing, error: errSel } = await adminSupabase
            .from('app_config')
            .select('chave')
            .eq('chave', 'import_tax')
            .maybeSingle()

        if (errSel) throw new Error(`Busca config: ${errSel.message}`)

        if (existing) {
            const { error } = await adminSupabase
                .from('app_config')
                .update({ valor: importTax })
                .eq('chave', 'import_tax')
            if (error) throw new Error(`Update imposto: ${error.message}`)
        } else {
            const { error } = await adminSupabase
                .from('app_config')
                .insert({ chave: 'import_tax', valor: importTax })
            if (error) throw new Error(`Insert imposto: ${error.message}`)
        }

        return NextResponse.json({ ok: true })
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[API Config Save]', msg)
        return NextResponse.json({ ok: false, error: msg }, { status: 500 })
    }
}
