import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const { message, history } = await req.json()
        const apiKey = process.env.GEMINI_API_KEY?.trim()

        if (!apiKey) return NextResponse.json({ error: 'Falta chave API (GEMINI_API_KEY)' }, { status: 500 })

        // 1. Busca a base de conhecimento no servidor (evita CORS)
        let knowledgeBase = ""
        try {
            const kbRes = await fetch('https://docs.google.com/spreadsheets/d/1zm25bJVw4zbi9W34YNBqZz72EpHZrv1ngImG87n1muw/export?format=csv', { next: { revalidate: 300 } })
            knowledgeBase = await kbRes.text()
        } catch (e) {
            console.error("Erro ao ler planilha no servidor:", e)
        }

        const context = `BASE DE CONHECIMENTO:\n${knowledgeBase}\n\nVocê é o assistente IA do PlasPrint. Responda em Português do Brasil de forma profissional e direta.`

        // 2. Inicializa o SDK
        const genAI = new GoogleGenerativeAI(apiKey)
        // Usando flash-latest que é mais resiliente
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

        // 3. Monta o chat
        const chat = model.startChat({
            history: history || [],
            generationConfig: { maxOutputTokens: 1000 }
        })

        console.log("Chamando Gemini SDK com prompt de tamanho:", context.length + message.length)
        
        // Enviamos o contexto como parte do prompt do usuário para garantir que ele seja lido
        const fullPrompt = `${context}\n\nPERGUNTA: ${message}`
        const result = await chat.sendMessage(fullPrompt)
        const response = await result.response
        const text = response.text()

        return NextResponse.json({ text })

    } catch (err: any) {
        console.error("Erro na rota /api/chat:", err)
        return NextResponse.json({ 
            error: err.message || 'Erro interno no assistente', 
            details: err.toString() 
        }, { status: 500 })
    }
}
