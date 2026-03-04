import { parseCanudosXlsx } from './lib/data-parsers'
import * as fs from 'fs'
import * as path from 'path'

async function test() {
    try {
        const filePath = path.join(process.cwd(), 'Canudos.xlsx')
        if (!fs.existsSync(filePath)) {
            console.log('Arquivo não encontrado localmente: ' + filePath)
            return
        }
        const buffer = fs.readFileSync(filePath)
        const data = parseCanudosXlsx(buffer.buffer)

        console.log('--- TESTE DE PARSING ---')
        console.log('Encabecados count:', data.encabecados.length)
        console.log('Decorados count:', data.decorados.length)

        if (data.encabecados.length > 0) {
            console.log('Exemplo Encabecados[0]:', data.encabecados[0])
        }
        if (data.decorados.length > 0) {
            console.log('Exemplo Decorados[0]:', data.decorados[0])
        }
    } catch (e) {
        console.error('Erro no teste:', e)
    }
}

test()
