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

    const machineStats = {};
    const oeeRows = oeeRaw.slice(1);
    for (const row of oeeRows) {
        if (!row || !row[1]) continue;
        const maq = String(row[1]).trim();
        if (maq.toLowerCase().includes('turno')) continue;

        const date = parseDate(row[2]);
        if (!date || !TARGET_DATES.includes(date)) continue;

        const turnoNum = Number(String(row[3]).split('.')[0]);
        if (![1, 2].includes(turnoNum)) continue;

        const hora = parseInt(row[4]);
        if (hora < 6 || hora > 21) continue;

        if (paradasSet.has(`${maq}|${date}|${hora}`)) continue;

        const oeeVal = toPercent(row[11]);
        const teepVal = toPercent(row[10]);

        if (!machineStats[maq]) machineStats[maq] = { oees: [], teeps: [] };
        machineStats[maq].oees.push(oeeVal);
        machineStats[maq].teeps.push(teepVal);
    }

    console.log('=== Teste de Lógicas para Bater com a Imagem ===');
    const results = [];
    for (const maq in machineStats) {
        const s = machineStats[maq];

        // Estratégia: Média de todas as horas (incluindo zeros)
        const oeeAll = s.oees.reduce((a, b) => a + b, 0) / s.oees.length;
        const teepAll = s.teeps.reduce((a, b) => a + b, 0) / s.teeps.length;

        // Estratégia: Média apenas das horas com produção (Exclui Zeros)
        const oeeProd = s.oees.filter(v => v > 0);
        const teepProd = s.teeps.filter(v => v > 0);
        const oeeFiltered = oeeProd.length > 0 ? oeeProd.reduce((a, b) => a + b, 0) / oeeProd.length : 0;
        const teepFiltered = teepProd.length > 0 ? teepProd.reduce((a, b) => a + b, 0) / teepProd.length : 0;

        results.push({
            Maq: maq,
            'OEE (all)': (oeeAll * 100).toFixed(2) + '%',
            'OEE (no-0)': (oeeFiltered * 100).toFixed(2) + '%',
            'TEEP (all)': (teepAll * 100).toFixed(2) + '%',
            'TEEP (no-0)': (teepFiltered * 100).toFixed(2) + '%'
        });
    }
    console.table(results);

    console.log('\n=== Esperado da Imagem ===');
    console.log('28-CX-360G:  TEEP=47.84% OEE=74.09%');
    console.log('180- CX-360G: TEEP=43.85% OEE=56.06%');
    console.log('181- CX-360G: TEEP=49.86% OEE=91.52%');
    console.log('182- CX-360G: TEEP=48.85% OEE=58.11%');
}
main();
