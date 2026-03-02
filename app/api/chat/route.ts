import { NextResponse } from 'next/server'

export async function POST(req: Request) {
    try {
        const { message } = await req.json()
        const apiKey = process.env.GEMINI_API_KEY?.trim()

        if (!apiKey) return NextResponse.json({ error: 'Falta chave' }, { status: 500 })

        // TESTE MINIMALISTA: Sem contexto, apenas a pergunta
        const payload = {
            contents: [{ parts: [{ text: message }] }]
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })

        const data = await response.json()
        if (data.error) throw new Error(data.error.message)

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sem resposta.'
        return NextResponse.json({ text })

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
