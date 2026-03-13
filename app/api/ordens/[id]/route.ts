import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient()
        const body = await request.json()
        const { id } = await params

        const { data, error } = await supabase
            .from('ordens_programadas')
            .update(body)
            .eq('id', id)
            .select()

        if (error) throw error

        return NextResponse.json({ data: data[0] })
    } catch (error) {
        console.error('Error updating ordem:', error)
        return NextResponse.json({ error: 'Erro ao atualizar ordem' }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const supabase = await createClient()
        const { id } = await params

        const { error } = await supabase
            .from('ordens_programadas')
            .delete()
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting ordem:', error)
        return NextResponse.json({ error: 'Erro ao deletar ordem' }, { status: 500 })
    }
}
