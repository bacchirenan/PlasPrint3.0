const fs = require('fs');
const xlsx = require('xlsx');

async function main() {
    const GITHUB_TOKEN = (() => {
        try {
            const env = fs.readFileSync('.env.local', 'utf-8');
            for (const line of env.split('\n')) {
                if (line.startsWith('GITHUB_TOKEN=')) return line.split('=')[1].trim();
            }
        } catch (e) { }
        return '';
    })();

    const url = 'https://api.github.com/repos/bacchirenan/PlasPrint3.0/contents/oee%20teep.xlsx?ref=main';
    const res = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.json'
        }
    });
    const json = await res.json();
    const buffer = Buffer.from(json.content, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });

    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Mostra as primeiras 10 linhas para entender a estrutura
    console.log('=== Primeiras 15 linhas (primeiras 13 colunas) ===');
    for (let i = 0; i < Math.min(15, raw.length); i++) {
        console.log(`L${i + 1}:`, JSON.stringify(raw[i].slice(0, 13)));
    }

    // Encontra linha com data numérica (provável início dos dados)
    console.log('\n=== Linhas com valores numéricos na col B (índice 1) ===');
    let count = 0;
    for (let i = 0; i < raw.length && count < 30; i++) {
        const row = raw[i];
        if (row && typeof row[1] === 'number') {
            count++;
            console.log(`L${i + 1}:`, JSON.stringify(row.slice(0, 13)));
        }
    }
}
main();
