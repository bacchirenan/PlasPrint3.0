export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('ordens_programadas')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        return NextResponse.json({ data })
    } catch (error) {
        console.error('Error fetching ordens:', error)
        return NextResponse.json({ error: 'Erro ao buscar ordens', data: [] }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        
        const { data, error } = await supabase
            .from('ordens_programadas')
            .insert([body])
            .select()

        if (error) throw error

        return NextResponse.json({ data: data[0] })
    } catch (error) {
        console.error('Error creating ordem:', error)
        return NextResponse.json({ error: 'Erro ao criar ordem' }, { status: 500 })
    }
}
