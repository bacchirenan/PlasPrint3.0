const fs = require('fs');
const xlsx = require('xlsx');

function toPercent(val) {
    const s = String(val ?? '').replace('%', '').replace(',', '.').trim()
    const n = parseFloat(s)
    if (isNaN(n)) return null
    return n > 1 ? n / 100 : n
}

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
    if (!json.content) { console.error('Sem content:', json.message); return; }

    const buffer = Buffer.from(json.content, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });
    console.log('Abas:', wb.SheetNames);

    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Linha 1 é cabeçalho
    console.log('Cabeçalho (L1):', raw[0]);

    // Filtra apenas dia 04/03/2026 = serial 46115
    const date0403 = xlsx.SSF.parse_date_code(46115);
    console.log('Data 04/03:', date0403);

    let totalOee = 0, countOee = 0, totalTeep = 0, countTeep = 0;
    const byTurno = { '1': { oeeSum: 0, oeeCount: 0, teepSum: 0, teepCount: 0 }, '2': { oeeSum: 0, oeeCount: 0, teepSum: 0, teepCount: 0 } };

    console.log('\nLinhas do dia 04/03 (cols B,C,D,E,K,L):');
    for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row || !row[1]) continue;

        // Verifica se é do dia 04/03
        const dateVal = row[2];
        if (typeof dateVal === 'number') {
            const parsed = xlsx.SSF.parse_date_code(dateVal);
            if (!parsed || parsed.y !== 2026 || parsed.m !== 3 || parsed.d !== 4) continue;
        } else {
            continue;
        }

        const maq = row[1];
        const turno = String(row[3] ?? '');
        const hora = row[4];
        const teepRaw = row[10]; // Col K
        const oeeRaw = row[11];  // Col L
        const teep = toPercent(teepRaw);
        const oee = toPercent(oeeRaw);

        console.log(`L${i + 1}: Maq=${maq} T=${turno} H=${hora} | K(TEEP_raw)=${teepRaw} → ${teep !== null ? (teep * 100).toFixed(2) + '%' : 'null'} | L(OEE_raw)=${oeeRaw} → ${oee !== null ? (oee * 100).toFixed(2) + '%' : 'null'}`);

        if (oee !== null && oee > 0) { totalOee += oee; countOee++; if (byTurno[turno]) { byTurno[turno].oeeSum += oee; byTurno[turno].oeeCount++; } }
        if (teep !== null && teep > 0) { totalTeep += teep; countTeep++; if (byTurno[turno]) { byTurno[turno].teepSum += teep; byTurno[turno].teepCount++; } }
    }

    console.log(`\nMédia simples OEE dia: ${countOee > 0 ? ((totalOee / countOee) * 100).toFixed(2) + '%' : 'N/A'} (${countOee} registros)`);
    console.log(`Média simples TEEP dia: ${countTeep > 0 ? ((totalTeep / countTeep) * 100).toFixed(2) + '%' : 'N/A'} (${countTeep} registros)`);
    console.log('\nPor turno:');
    for (const t of ['1', '2']) {
        const d = byTurno[t];
        console.log(`  Turno ${t}: OEE=${d.oeeCount > 0 ? ((d.oeeSum / d.oeeCount) * 100).toFixed(2) + '%' : 'N/A'} (${d.oeeCount} reg) | TEEP=${d.teepCount > 0 ? ((d.teepSum / d.teepCount) * 100).toFixed(2) + '%' : 'N/A'} (${d.teepCount} reg)`);
    }

    // Esperado pelo usuário:
    // OEE: A=66.13%, B=50.68%, Dia=51.78%
    // TEEP: A=48.68%, B=42.88%, Dia=30.52%
}
main();
