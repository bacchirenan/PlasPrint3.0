/**
 * data-parsers.ts
 * Parsers para os arquivos de dados do PlasPrint IA.
 * Converte os dados brutos dos arquivos Excel para os tipos TypeScript.
 */

import * as XLSX from 'xlsx'
import type { ProducaoRow, OeeRow, CanudoRow } from './types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toNum(val: unknown): number {
    const n = Number(val)
    return isNaN(n) ? 0 : n
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
        const d = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
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
    return null
}

function dayOfWeek(dateStr: string): number {
    const d = new Date(dateStr + 'T12:00:00Z')
    return d.getUTCDay() // 0=domingo, 6=sábado
}

// ─── Produção ─────────────────────────────────────────────────────────────────

/**
 * Parseia o arquivo producao.xlsx.
 * Estrutura: skipRows=3, header=None
 * Colunas: B=máquina, C=data, F=hora, G=turno, H=registro, I=OS, J=produto,
 *          K=operador, M=tempo_s, O=produção_total, P=rejeito, Q=peças_boas
 */
export function parseProducaoXlsx(buffer: ArrayBuffer): ProducaoRow[] {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    // Pular as primeiras 3 linhas (cabeçalhos originais)
    const rows = raw.slice(3)
    const result: ProducaoRow[] = []

    for (const row of rows) {
        if (!row || !row[1]) continue // Sem máquina
        const maq = String(row[1] ?? '').trim()
        if (!maq || maq.toLowerCase().includes('turno')) continue

        const dateStr = parseDate(row[2])
        if (!dateStr) continue

        const hora = toNum(row[5])
        if (hora < 6 || hora > 21) continue

        const turno = mapShift(row[6])
        if (!turno) continue // Apenas A e B

        // Filtro dias úteis
        const dow = dayOfWeek(dateStr)
        if (dow === 0 || dow === 6) continue

        result.push({
            maquina: maq,
            data: dateStr,
            hora,
            turno,
            registro: String(row[7] ?? '').trim(),
            os: String(row[8] ?? '').trim(),
            produto: String(row[9] ?? '').trim(),
            operador: String(row[10] ?? '').trim(),
            tempo_segundos: toNum(row[12]),
            producao_total: toNum(row[14]),
            rejeito: toNum(row[15]),
            pecas_boas: toNum(row[16]),
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

/**
 * Parseia o arquivo Canudos.xlsx.
 * Colunas: A=data, B=turno, C=os, D=operador, E=peças_boas, F=perdas
 */
export function parseCanudosXlsx(buffer: ArrayBuffer): CanudoRow[] {
    const wb = XLSX.read(buffer, { type: 'array', cellDates: false })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })

    const result: CanudoRow[] = []

    for (const row of raw) {
        if (!row || !row[0]) continue
        const dateStr = parseDate(row[0])
        if (!dateStr) continue

        const turnoRaw = String(row[1] ?? '').toUpperCase()
        if (!turnoRaw.match(/[AB12]/)) continue

        const opCod = toNum(row[3])
        const opNome = OP_MAP[opCod] || String(row[3] ?? '').trim()
        const d = new Date(dateStr + 'T12:00:00Z')

        result.push({
            data: dateStr,
            turno: turnoRaw.includes('A') || turnoRaw === '1' ? 'Turno A' : 'Turno B',
            os: String(row[2] ?? '').trim(),
            operador: String(row[3] ?? '').trim(),
            operador_nome: opNome,
            pecas_boas: toNum(row[4]),
            perdas: toNum(row[5]),
            hora: d.getHours(),
        })
    }

    return result
}
