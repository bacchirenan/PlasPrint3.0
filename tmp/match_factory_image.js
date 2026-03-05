const fs = require('fs');
const xlsx = require('xlsx');

function toPercent(val) {
    if (val === null || val === undefined) return null;
    const s = String(val).replace('%', '').replace(',', '.').trim();
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    return n > 1 ? n / 100 : n;
}

function parseDate(val) {
    if (!val) return null;
    if (typeof val === 'number') {
        const date = xlsx.SSF.parse_date_code(val);
        const d = new Date(Date.UTC(date.y, date.m - 1, date.d));
        return d.toISOString().split('T')[0];
    }
    const s = String(val).trim();
    const parts = s.split('/');
    if (parts.length === 3) {
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        const d = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        return d.toISOString().split('T')[0];
    }
    return null;
}

async function main() {
    const GITHUB_TOKEN = (() => { try { const env = fs.readFileSync('.env.local', 'utf-8'); for (const l of env.split('\n')) { if (l.startsWith('GITHUB_TOKEN=')) return l.split('=')[1].trim(); } } catch (e) { } return ''; })();

    // Fetch both OEE and Producao
    const [oeeRes, prodRes] = await Promise.all([
        fetch('https://api.github.com/repos/bacchirenan/PlasPrint3.0/contents/oee%20teep.xlsx?ref=main', { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.json' } }),
        fetch('https://api.github.com/repos/bacchirenan/PlasPrint3.0/contents/producao.xlsx?ref=main', { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.json' } })
    ]);

    const oeeBuffer = Buffer.from((await oeeRes.json()).content, 'base64');
    const prodBuffer = Buffer.from((await prodRes.json()).content, 'base64');

    const oeeWb = xlsx.read(oeeBuffer, { type: 'buffer' });
    const prodWb = xlsx.read(prodBuffer, { type: 'buffer' });

    const oeeWs = oeeWb.Sheets[oeeWb.SheetNames[0]];
    const prodWs = prodWb.Sheets[prodWb.SheetNames[0]];

    const oeeRaw = xlsx.utils.sheet_to_json(oeeWs, { header: 1, defval: null });
    const prodRaw = xlsx.utils.sheet_to_json(prodWs, { header: 1, defval: null });

    const TARGET_DATES = ['2026-03-02', '2026-03-03', '2026-03-04'];

    // 1. Map Paradas Previstas from Producao
    const paradasSet = new Set();
    const prodRows = prodRaw.slice(3);
    for (const row of prodRows) {
        if (!row || !row[1]) continue;
        const registro = String(row[7] ?? '').toLowerCase();
        if (registro.includes('parada prevista')) {
            const maq = String(row[1]).trim();
            const date = parseDate(row[2]);
            const hora = parseInt(row[5] ?? '0');
            if (date) paradasSet.add(`${maq}|${date}|${hora}`);
        }
    }

    // 2. Parse OEE
    const machineStats = {};
    const oeeRows = oeeRaw.slice(1);
    for (const row of oeeRows) {
        if (!row || !row[1]) continue;
        const maq = String(row[1]).trim();
        if (maq.toLowerCase().includes('turno')) continue;

        const date = parseDate(row[2]);
        if (!TARGET_DATES.includes(date)) continue;

        const turnoNum = Number(String(row[3]).split('.')[0]);
        if (![1, 2].includes(turnoNum)) continue; // Only T1 and T2

        const hora = parseInt(row[4]);
        if (hora < 6 || hora > 21) continue; // Only 6:00 to 21:59

        if (paradasSet.has(`${maq}|${date}|${hora}`)) continue;

        const oeeRawVal = toPercent(row[11]);
        const teepRawVal = toPercent(row[10]);

        // Let's try WITHOUT OEE CAP first, as some values in image are high
        const oee = oeeRawVal;
        const teep = teepRawVal;

        if (!machineStats[maq]) machineStats[maq] = { oeeSum: 0, teepSum: 0, count: 0 };
        machineStats[maq].oeeSum += oee;
        machineStats[maq].teepSum += teep;
        machineStats[maq].count++;
    }

    console.log('=== Resultados por Máquina (Sem Cap OEE, Sem T3, Sem Parada Prevista, 6h-21h) ===');
    const tableData = [];
    let totalOee = 0, totalTeep = 0, totalCount = 0;

    for (const maq in machineStats) {
        const s = machineStats[maq];
        const oeeAvg = s.oeeSum / s.count;
        const teepAvg = s.teepSum / s.count;
        tableData.push({ Maq: maq, OEE: (oeeAvg * 100).toFixed(2) + '%', TEEP: (teepAvg * 100).toFixed(2) + '%', h: s.count });
        totalOee += s.oeeSum;
        totalTeep += s.teepSum;
        totalCount += s.count;
    }
    console.table(tableData);
    console.log(`Geral: OEE=${((totalOee / totalCount) * 100).toFixed(2)}% | TEEP=${((totalTeep / totalCount) * 100).toFixed(2)}%`);

    console.log('\n=== Esperado da Imagem ===');
    console.log('28-CX-360G:  TEEP=47.84% OEE=74.09%');
    console.log('29-CX-360G:  TEEP=0.00% OEE=0.00%');
    console.log('180- CX-360G: TEEP=43.85% OEE=56.06%');
    console.log('181- CX-360G: TEEP=49.86% OEE=91.52%');
    console.log('182- CX-360G: TEEP=48.85% OEE=58.11%');
}
main();
