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
    const GITHUB_TOKEN = (() => { try { const env = fs.readFileSync('.env.local', 'utf-8'); for (const l of env.split('\n')) { if (l.startsWith('GITHUB_TOKEN=')) return l.split('=')[1].trim(); } } catch (e) { } return ''; })();
    const url = 'https://api.github.com/repos/bacchirenan/PlasPrint3.0/contents/oee%20teep.xlsx?ref=main';
    const res = await fetch(url, { headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.json' } });
    const json = await res.json();
    const buffer = Buffer.from(json.content, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Para cada máquina e turno, pega os dados do dia 04/03
    const MAQS = ['28-CX-360G', '29-CX-360G', '180- CX-360G', '181- CX-360G', '182- CX-360G'];
    const DATA = '04/03/2026';

    // Monta a tabela
    const table = {};
    for (const maq of MAQS) table[maq] = { 1: [], 2: [] };

    for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row) continue;
        const date = String(row[2] ?? '').trim();
        if (date !== DATA) continue;
        const maq = String(row[1] ?? '').trim();
        const turno = Number(row[3]);
        if (![1, 2].includes(turno)) continue;
        if (!table[maq]) continue;

        const oee = toPercent(row[11]);
        const teep = toPercent(row[10]);
        if (oee === null || teep === null) continue;
        table[maq][turno].push({ h: row[4], oee, teep, oeeCapped: Math.min(oee, 1.0) });
    }

    console.log('=== Todas as máquinas, 04/03/2026 ===');
    for (const maq of MAQS) {
        for (const t of [1, 2]) {
            const rows = table[maq][t];
            if (!rows.length) { console.log(`${maq} T${t}: sem dados`); continue; }
            const oeeAvg = rows.reduce((a, r) => a + r.oeeCapped, 0) / rows.length;
            const teepAvg = rows.reduce((a, r) => a + r.teep, 0) / rows.length;
            const oeeAvgNoCap = rows.reduce((a, r) => a + r.oee, 0) / rows.length;
            console.log(`${maq} T${t} (${rows.length}h): OEE_no_cap=${(oeeAvgNoCap * 100).toFixed(2)}% | OEE_cap=${(oeeAvg * 100).toFixed(2)}% | TEEP=${(teepAvg * 100).toFixed(2)}%`);
            rows.forEach(r => process.stdout.write(`  h${r.h}:OEE=${(r.oee * 100).toFixed(1)}%/TEEP=${(r.teep * 100).toFixed(1)}% `));
            console.log();
        }
    }

    // Testa: dia total = ponderado pelo número de horas de cada máquina nos turnos ativos
    console.log('\n=== Tentativa: média ponderada por horas trabalhadas ===');
    for (const t of [1, 2, 'all']) {
        const maqsCom = MAQS.filter(m => {
            const turnoList = t === 'all' ? [1, 2] : [t];
            return turnoList.some(tt => table[m][tt].some(r => r.oeeCapped > 0));
        });

        const turnoList = t === 'all' ? [1, 2] : [t];
        let totalOeeWeighted = 0, totalHours = 0, totalTeepWeighted = 0;
        for (const maq of maqsCom) {
            for (const tt of turnoList) {
                const rows = table[maq][tt];
                for (const r of rows) {
                    totalOeeWeighted += r.oeeCapped;
                    totalTeepWeighted += r.teep;
                    totalHours++;
                }
            }
        }
        console.log(`T${t} (${maqsCom.length} máqs com dados): OEE=${totalHours > 0 ? ((totalOeeWeighted / totalHours) * 100).toFixed(2) + '%' : 'N/A'} | TEEP=${totalHours > 0 ? ((totalTeepWeighted / totalHours) * 100).toFixed(2) + '%' : 'N/A'}`);
    }

    console.log('\n  ESPERADO: OEE A=66.13% B=50.68% Dia=51.78% | TEEP A=48.68% B=42.88% Dia=30.52%');
}
main();
