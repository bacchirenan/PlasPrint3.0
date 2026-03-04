/**
 * data-parsers.ts
 * Parsers para os arquivos de dados do PlasPrint IA.
 * Converte os dados brutos dos arquivos Excel para os tipos TypeScript.
 */

import * as XLSX from 'xlsx'
import type { ProducaoRow, OeeRow, CanudoRow } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(val: unknown): number {
    if (val === null || val === undefined) return 0
    if (typeof val === 'number') return val
    // Remove pontos de milhar e troca vírgula por ponto decimal
    const s = String(val).replace(/\./g, '').replace(',', '.').trim()
    const n = parseFloat(s)
    return isNaN(n) ? 0 : n
}

function parseExcelTime(val: unknown): number | null {
    if (val === null || val === undefined) return null
    if (typeof val === 'number') {
        // Excel armazena tempo como fração de dia (0.5 = 12:00)
        // Convertendo para milissegundos desde 1970 para facilitar a subtração
        // O valor base 25569 é o offset entre Excel (1900) e JS (1970)
        return (val - 25569) * 86400 * 1000
    }
    const d = new Date(String(val))
    return isNaN(d.getTime()) ? null : d.getTime()
}

function toPercent(val: unknown): number {
    const s = String(val ?? '').replace('%', '').replace(',', '.').trim()
    const n = parseFloat(s)
    if (isNaN(n)) return 0
    // Se já é decimal (0-1) ou percentual (0-100)
    return n > 1 ? n / 100 : n
}

function parseDate(val: unknown): string | null {
    if (!val) return null
    // Excel serial number
    if (typeof val === 'number') {
        const date = XLSX.SSF.parse_date_code(val)
        if (date) {
            const d = new Date(Date.UTC(date.y, date.m - 1, date.d))
            return d.toISOString().split('T')[0]
        }
    }
    // String date
    const s = String(val).trim()
    if (!s) return null
    // Try DD/MM/YYYY
    const parts = s.split('/')
    if (parts.length === 3) {
        // Suporta DD/MM/YYYY ou DD/MM/YY
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
        const d = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
    // Fallback
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    return null
}

function mapShift(val: unknown): string | null {
    const s = String(val ?? '').trim().split('.')[0]
    if (s === '1') return 'Turno A'
    if (s === '2') return 'Turno B'
    if (s === '3') return 'Turno C'
    return null
}

function dayOfWeek(dateStr: string): number {
    const d = new Date(dateStr + 'T12:00:00Z')
    return d.getUTCDay() // 0=domingo, 6=sábado
}

// ─── Produção ─────────────────────────────────────────────────────────────────

/**
 * Parseia o arquivo producao.xlsx conforme mapeamento solicitado:
 * B: Maquina, C: Data, D: Início, E: Fim, F: Hora, G: Turno, H: Registro,
 * J: Produto, K: Operador, O: Produção Total, P: Rejeitos, Q: Peças Boas.
 * Colunas ignoradas: I, L, M, N.
 */
export function parseProducaoXlsx(buffer: ArrayBuffer): ProducaoRow[] {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    // Pular as primeiras 3 linhas (cabeçalhos originais)
    const rows = raw.slice(3)
    const result: ProducaoRow[] = []

    for (const row of rows) {
        if (!row || !row[1]) continue // Sem máquina (Coluna B)
        const maq = String(row[1] ?? '').trim()
        if (!maq || maq.toLowerCase().includes('turno')) continue

        const dateStr = parseDate(row[2]) // Coluna C
        if (!dateStr) continue

        const hora = row[5] !== null ? toNum(row[5]) : 0 // Coluna F
        const turno = mapShift(row[6]) // Coluna G
        if (!turno) continue // Apenas 1 (A), 2 (B) e 3 (C) são aceitos

        // Cálculo de Tempo (D e E)
        const tInicio = parseExcelTime(row[3])
        const tFim = parseExcelTime(row[4])
        let diffSegundos = 0
        if (tInicio && tFim && tFim > tInicio) {
            diffSegundos = (tFim - tInicio) / 1000
        }

        result.push({
            maquina: maq,
            data: dateStr,
            hora,
            turno,
            registro: String(row[7] ?? '').trim(), // Coluna H
            os: '', // Coluna I (ignorada)
            produto: String(row[9] ?? '').trim(), // Coluna J
            operador: String(row[10] ?? '').trim(), // Coluna K
            tempo_segundos: diffSegundos, // Calculado de D e E
            producao_total: toNum(row[14]), // Coluna O
            rejeito: toNum(row[15]), // Coluna P
            pecas_boas: toNum(row[16]), // Coluna Q
        })
    }

    return result
}

// ─── OEE / TEEP ───────────────────────────────────────────────────────────────

/**
 * Parseia o arquivo "oee teep.xlsx".
 * Estrutura: skipRows=1
 * Colunas: B=máquina, C=data, D=turno, E=hora, H=disp, I=perf, J=qual, K=teep, L=oee
 */
export function parseOeeXlsx(buffer: ArrayBuffer, producaoRows: ProducaoRow[]): OeeRow[] {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    const rows = raw.slice(1) // pular 1ª linha
    const result: OeeRow[] = []

    // Montar set de paradas previstas a partir do producao
    const paradasPrevistas = new Set<string>()
    for (const p of producaoRows) {
        if (p.registro.toLowerCase().includes('parada prevista')) {
            paradasPrevistas.add(`${p.maquina}|${p.data}|${p.hora}`)
        }
    }

    // Horas ativas por data/hora (pelo menos 1 máquina com oee > 0)
    const activeHours = new Set<string>()
    const tempRows: OeeRow[] = []

    for (const row of rows) {
        if (!row || !row[1]) continue
        const maq = String(row[1] ?? '').trim()
        if (!maq || maq.toLowerCase().includes('turno')) continue

        const dateStr = parseDate(row[2])
        if (!dateStr) continue

        // Filtro dias úteis
        const dow = dayOfWeek(dateStr)
        if (dow === 0 || dow === 6) continue

        const turno = mapShift(row[3])
        if (!turno) continue

        const hora = toNum(row[4])
        const oee = Math.min(toPercent(row[11]), 1.05)
        const teep = Math.min(toPercent(row[10]), 1.0)

        if (oee > 0) activeHours.add(`${dateStr}|${hora}`)

        const key = `${maq}|${dateStr}|${hora}`
        const isParada = paradasPrevistas.has(key)

        tempRows.push({
            maquina: maq,
            data: dateStr,
            turno,
            hora,
            disponibilidade: toPercent(row[7]),
            performance: toPercent(row[8]),
            qualidade: toPercent(row[9]),
            teep,
            oee: isParada ? NaN : oee,
            is_parada_prevista: isParada,
        })
    }

    // Filtrar apenas horas onde alguma máquina estava ativa (industry-exclusion)
    for (const row of tempRows) {
        if (activeHours.has(`${row.data}|${row.hora}`)) {
            result.push(row)
        }
    }

    return result
}

// ─── Canudos ─────────────────────────────────────────────────────────────────

const OP_MAP: Record<number, string> = {
    8502: 'Pedro',
    8524: 'Leonardo',
}

export interface CanudosData {
    encabecados: CanudoRow[]
    decorados: CanudoRow[]
}

/**
 * Parseia o arquivo Canudos.xlsx.
 * ABA 1 (0): ENCABECAMENTO
 * ABA 2 (1): ARTE
 */
export function parseCanudosXlsx(buffer: ArrayBuffer): CanudosData {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
    const sheetNames = wb.SheetNames

    const parseSheet = (name: string): CanudoRow[] => {
        if (!name) return []
        const ws = wb.Sheets[name]
        if (!ws) return []

        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as unknown[][]
        const result: CanudoRow[] = []

        // Itera sobre as linhas da planilha específica
        for (let i = 0; i < raw.length; i++) {
            const row = raw[i]
            if (!row || row.length < 5) continue

            const dateStr = parseDate(row[0]) // Col A
            if (!dateStr) continue

            const turnoRaw = String(row[1] ?? '').toUpperCase() // Col B
            const turnoFinal = (turnoRaw.includes('B') || turnoRaw.includes('2')) ? 'Turno B' : 'Turno A'

            const boas = toNum(row[4]) // Col E
            const perdas = toNum(row[5]) // Col F

            if (boas > 0 || perdas > 0) {
                const opCod = toNum(row[3]) // Col D
                const opNome = OP_MAP[opCod] || String(row[3] ?? '').trim()
                const d = new Date(dateStr + 'T12:00:00Z')

                result.push({
                    data: dateStr,
                    turno: turnoFinal,
                    os: String(row[2] ?? '').trim(),
                    operador: String(row[3] ?? '').trim(),
                    operador_nome: opNome,
                    pecas_boas: boas,
                    perdas: perdas,
                    hora: d.getHours(),
                })
            }
        }
        return result
    }

    // Busca inteligente de abas
    let encFinal = sheetNames[0]
    let artFinal = sheetNames[1] || sheetNames[0]

    const findIdx = (k: string[]) => sheetNames.findIndex(n => k.some(x => n.toUpperCase().includes(x.toUpperCase())))
    const encIdx = findIdx(['ENCABE', 'INICIO'])
    const artIdx = findIdx(['ARTE', 'DECORA', 'LOTE'])

    if (encIdx !== -1) encFinal = sheetNames[encIdx]
    if (artIdx !== -1) artFinal = sheetNames[artIdx]

    // Garantia absoluta de diferenciação se houver mais de uma aba
    if (encFinal === artFinal && sheetNames.length > 1) {
        encFinal = sheetNames[0]
        artFinal = sheetNames[1]
    }

    return {
        encabecados: parseSheet(encFinal),
        decorados: parseSheet(artFinal)
    }
}
