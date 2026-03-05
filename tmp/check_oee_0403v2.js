const fs = require('fs');
const xlsx = require('xlsx');

function toPercent(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).replace('%', '').replace(',', '.').trim();
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    return n > 1 ? n / 100 : n;
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
    const buffer = Buffer.from(json.content, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });

    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Filtro: linhas do dia 04/03/2026
    console.log('=== Linhas do dia 04/03/2026 ===');
    const resultByTurno = {};
    let allOee = [], allTeep = [];

    for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        if (!row) continue;
        const dateVal = String(row[2] ?? '').trim();
        if (dateVal !== '04/03/2026') continue;

        const maq = String(row[1] ?? '').trim();
        const turno = row[3];
        const hora = row[4];
        const teepRaw = row[10]; // Col K = TEEP
        const oeeRaw = row[11];  // Col L = OEE
        const teep = toPercent(teepRaw);
        const oee = toPercent(oeeRaw);

        const turnoKey = String(turno);
        if (!resultByTurno[turnoKey]) resultByTurno[turnoKey] = { oees: [], teeps: [] };

        console.log(`L${i + 1}: Maq=${maq} T=${turno} H=${hora} | TEEP="${teepRaw}"→${teep !== null ? (teep * 100).toFixed(2) + '%' : 'null'} | OEE="${oeeRaw}"→${oee !== null ? (oee * 100).toFixed(2) + '%' : 'null'}`);

        if (oee !== null) { resultByTurno[turnoKey].oees.push(oee); allOee.push(oee); }
        if (teep !== null) { resultByTurno[turnoKey].teeps.push(teep); allTeep.push(teep); }
    }

    console.log('\n=== Resultado da Média Simples ===');
    for (const t of Object.keys(resultByTurno).sort()) {
        const d = resultByTurno[t];
        const oeeMedia = d.oees.length > 0 ? d.oees.reduce((a, b) => a + b, 0) / d.oees.length : 0;
        const teepMedia = d.teeps.length > 0 ? d.teeps.reduce((a, b) => a + b, 0) / d.teeps.length : 0;
        const oeeMediaSemZero = d.oees.filter(v => v > 0);
        const teepMediaSemZero = d.teeps.filter(v => v > 0);
        console.log(`Turno ${t}:`);
        console.log(`  OEE (com zeros): ${(oeeMedia * 100).toFixed(2)}% (${d.oees.length} reg)`);
        console.log(`  OEE (sem zeros): ${oeeMediaSemZero.length > 0 ? ((oeeMediaSemZero.reduce((a, b) => a + b, 0) / oeeMediaSemZero.length) * 100).toFixed(2) + '%' : 'N/A'} (${oeeMediaSemZero.length} reg)`);
        console.log(`  TEEP (com zeros): ${(teepMedia * 100).toFixed(2)}% (${d.teeps.length} reg)`);
        console.log(`  TEEP (sem zeros): ${teepMediaSemZero.length > 0 ? ((teepMediaSemZero.reduce((a, b) => a + b, 0) / teepMediaSemZero.length) * 100).toFixed(2) + '%' : 'N/A'} (${teepMediaSemZero.length} reg)`);
    }

    const allOeeComZero = allOee.length > 0 ? allOee.reduce((a, b) => a + b, 0) / allOee.length : 0;
    const allOeeSemZero = allOee.filter(v => v > 0);
    const allTeepComZero = allTeep.length > 0 ? allTeep.reduce((a, b) => a + b, 0) / allTeep.length : 0;
    const allTeepSemZero = allTeep.filter(v => v > 0);
    console.log('\nDia completo:');
    console.log(`  OEE c/zeros: ${(allOeeComZero * 100).toFixed(2)}%  |  s/zeros: ${allOeeSemZero.length > 0 ? ((allOeeSemZero.reduce((a, b) => a + b, 0) / allOeeSemZero.length) * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log(`  TEEP c/zeros: ${(allTeepComZero * 100).toFixed(2)}%  |  s/zeros: ${allTeepSemZero.length > 0 ? ((allTeepSemZero.reduce((a, b) => a + b, 0) / allTeepSemZero.length) * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log('\n  Esperado OEE: A=66.13% B=50.68% Dia=51.78%');
    console.log('  Esperado TEEP: A=48.68% B=42.88% Dia=30.52%');
}
main();
