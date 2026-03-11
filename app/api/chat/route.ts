import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SPREADSHEET_ID = '1zm25bJVw4zbi9W34YNBqZz72EpHZrv1ngImG87n1muw'
const MAX_ROWS = 60

// Cache em memória por 5 minutos
const sheetCache: Record<string, { data: SheetRow[]; ts: number }> = {}
const CACHE_TTL_MS = 5 * 60 * 1000

interface SheetRow {
    info: string
    imageUrls: string[]   // pode ter 0, 1 ou várias imagens
}

/** Extrai TODOS os file IDs de Drive de um texto (coluna A ou B) e retorna URLs de thumbnail */
function extractAllDriveUrls(text: string): string[] {
    if (!text) return []
    // Encontra todos os /file/d/FILE_ID/ presentes no texto
    const regex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/g
    const ids = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
        ids.add(m[1])
    }
    // Converte cada ID em URL de thumbnail que o proxy entende
    return Array.from(ids).map(id => `https://drive.google.com/thumbnail?id=${id}&sz=w800`)
}

/** Parser CSV simples que respeita campos entre aspas */
function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
            else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
        } else {
            current += ch
        }
    }
    result.push(current.trim())
    return result
}

async function fetchSheetRows(sheetName: string): Promise<SheetRow[]> {
    const now = Date.now()
    const cached = sheetCache[sheetName]
    if (cached && now - cached.ts < CACHE_TTL_MS) return cached.data

    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`
    try {
        const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } })
        const text = await res.text()

        if (text.trimStart().startsWith('<!DOCTYPE') || text.includes('<html')) {
            console.warn(`[Chat] Aba "${sheetName}" requer login`)
            return []
        }

        const lines = text.split('\n').filter(l => l.trim())
        // Pula cabeçalho (linha 0: "Informações","Imagem")
        const rows: SheetRow[] = lines.slice(1, MAX_ROWS + 1).map(line => {
            const cols = parseCSVLine(line)
            const info = cols[0] || ''
            const colB  = cols[1] || ''

            // Une os links encontrados em ambas as colunas (sem duplicatas)
            const fromColA = extractAllDriveUrls(info)
            const fromColB = extractAllDriveUrls(colB)
            const seen = new Set<string>()
            const imageUrls: string[] = []
            for (const u of [...fromColB, ...fromColA]) {
                if (!seen.has(u)) { seen.add(u); imageUrls.push(u) }
            }

            return { info, imageUrls }
        }).filter(r => r.info)

        console.log(`[Chat] Aba "${sheetName}": ${rows.length} linhas, ${rows.filter(r => r.imageUrls.length).length} com imagem`)
        sheetCache[sheetName] = { data: rows, ts: now }
        return rows
    } catch (e: any) {
        console.error(`[Chat] Erro em "${sheetName}":`, e.message)
        return []
    }
}

/** Constrói o texto de contexto para o Gemini, com marcadores de imagem (múltiplos por linha) */
function buildContext(sheetName: string, rows: SheetRow[]): string {
    if (!rows.length) return `[Aba "${sheetName}" sem dados]`
    return rows.map(r => {
        // Gera um marcador [IMAGEM:URL] para cada imagem encontrada na linha
        const imgTags = r.imageUrls.map(u => ` [IMAGEM:${u}]`).join('')
        return `- ${r.info}${imgTags}`
    }).join('\n')
}

/** Detecta quais abas são relevantes para a pergunta */
function detectRelevantSheets(message: string): string[] {
    const msg = message.toLowerCase()
    const matched = new Set<string>()

    if (/erro|falha|alarme|parada|parou|defeito|fault|code|cód/i.test(msg)) matched.add('erros')
    if (/dacen|cx.?360|cabeç|head|purge|verniz|ip.*192|subrede/i.test(msg)) matched.add('dacen')
    if (/psi|spr|xaar|lc.?2000|single.?pass/i.test(msg)) matched.add('psi')
    if (/geral|setor|produção|torno|funsun|isimat|koenig|canudo|kit|primer|speeds|turnos?|código.*parada|código.*rejeito/i.test(msg)) matched.add('gerais')

    if (matched.size === 0) { matched.add('erros'); matched.add('gerais') }
    return Array.from(matched)
}

function isRetriableError(msg: string) {
    return /429|503|quota|not found|404|UNAVAILABLE|high demand|overloaded|Service Unavailable/i.test(msg)
}

export async function POST(req: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        let message: string, history: any[]
        try {
            const body = await req.json()
            message = String(body.message || '').trim()
            history = Array.isArray(body.history) ? body.history : []
        } catch {
            return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 })
        }

        if (!message) return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 })

        const apiKey = process.env.GEMINI_API_KEY?.trim()
        if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada' }, { status: 500 })

        // 1. Busca as abas relevantes
        const relevantSheets = detectRelevantSheets(message)
        console.log(`[Chat] Pergunta: "${message.substring(0, 60)}" → Abas: [${relevantSheets.join(', ')}]`)

        const sheetSections = await Promise.all(
            relevantSheets.map(async (name) => {
                // A aba 'erros' não tem coluna de imagem, usa o método antigo
                if (name === 'erros') {
                    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`
                    try {
                        const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } })
                        const text = await res.text()
                        if (text.trimStart().startsWith('<!DOCTYPE')) return `=== ERROS ===\n[indisponível]`
                        return `=== ERROS DAS MÁQUINAS ===\n${text.substring(0, 5000)}`
                    } catch { return `=== ERROS ===\n[erro ao buscar]` }
                }

                const rows = await fetchSheetRows(name)
                const context = buildContext(name, rows)
                return `=== ${name.toUpperCase()} ===\n${context}`
            })
        )

        const knowledgeBase = sheetSections.join('\n\n')

        const systemPrompt = `Você é o Assistente do Setor de Impressão da PlasPrint.
Responda SEMPRE em Português do Brasil. Seja objetivo e técnico.

INSTRUÇÕES IMPORTANTES SOBRE IMAGENS:
- Os dados abaixo podem conter marcadores [IMAGEM:URL].
- Quando sua resposta se referir a uma informação que possui um marcador [IMAGEM:URL], copie o marcador EXATAMENTE assim: [IMAGEM:https://...] no final da frase ou parágrafo relevante.
- Não invente URLs. Só use URLs que estejam nos dados abaixo.

DADOS DA PLANILHA:
${knowledgeBase}
---`

        const validHistory = history
            .filter(h => h?.role && Array.isArray(h?.parts) && h.parts[0]?.text)
            .slice(-6)
            .map(h => ({ role: h.role as 'user' | 'model', parts: [{ text: String(h.parts[0].text).substring(0, 400) }] }))

        console.log(`[Chat] Prompt: ~${(systemPrompt.length + message.length)} chars`)

        const genAI = new GoogleGenerativeAI(apiKey)
        let responseText = ''
        const modelsToTry = ['gemini-2.0-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash']

        for (const modelName of modelsToTry) {
            try {
                console.log(`[Chat] Tentando: ${modelName}`)
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: { temperature: 0.2, topP: 0.85, maxOutputTokens: 1200 }
                })
                const chat = model.startChat({ history: validHistory })
                const result = await chat.sendMessage(`${systemPrompt}\n\nPERGUNTA: ${message}`)
                responseText = result.response.text()
                if (responseText) { console.log(`[Chat] OK com ${modelName}`); break }
            } catch (e: any) {
                const errMsg = e.message || e.toString()
                console.warn(`[Chat] ${modelName} falhou: ${errMsg.substring(0, 120)}`)
                if (!isRetriableError(errMsg)) throw e
            }
        }

        if (!responseText) {
            return NextResponse.json({ error: 'Todos os modelos atingiram o limite de cota. Aguarde alguns minutos.' }, { status: 429 })
        }

        return NextResponse.json({ text: responseText })

    } catch (err: any) {
        console.error('[Chat] ERRO:', err.toString())
        return NextResponse.json({ error: err.message || 'Erro interno', details: err.toString() }, { status: 500 })
    }
}
