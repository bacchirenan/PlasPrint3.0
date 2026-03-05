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
    const buffer = Buffer.from((await res.json()).content, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    const TARGET_DATES = ['02/03/2026', '03/03/2026', '04/03/2026'];

    // Primeiro nível: agrupa por maq+data+turno
    const groups = {};
    for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row || !row[1]) continue;
        const date = String(row[2] ?? '').trim();
        if (!TARGET_DATES.includes(date)) continue;
        const maq = String(row[1] ?? '').trim();
        if (!maq || maq.toLowerCase().includes('turno')) continue;
        const turnoNum = Number(String(row[3] ?? '').trim().split('.')[0]);
        if (![1, 2].includes(turnoNum)) continue;

        const oee = toPercent(row[11]);
        const teep = toPercent(row[10]);
        if (oee === null || teep === null) continue;

        const key = `${maq}|${date}|${turnoNum}`;
        if (!groups[key]) groups[key] = { oees: [], teeps: [], maq, date, turno: turnoNum };
        groups[key].oees.push(Math.min(oee, 1.0));
        groups[key].teeps.push(Math.min(teep, 1.0));
    }

    // Calcula média por grupo e decide se inclui ou exclui (OEE total zero = excluído)
    let oeeSum = 0, teepSum = 0, n = 0;
    let oeeSumExcl = 0, teepSumExcl = 0, nExcl = 0;

    console.log('=== Grupos Maq×Data×Turno ===');
    for (const key of Object.keys(groups).sort()) {
        const g = groups[key];
        const oeeAvg = g.oees.reduce((a, b) => a + b, 0) / g.oees.length;
        const teepAvg = g.teeps.reduce((a, b) => a + b, 0) / g.teeps.length;

        // Estratégia 1: inclui tudo
        oeeSum += oeeAvg; teepSum += teepAvg; n++;

        // Estratégia 2: exclui grupos onde OEE=0 em todas as horas
        const hasProduction = g.oees.some(v => v > 0);
        if (hasProduction) { oeeSumExcl += oeeAvg; teepSumExcl += teepAvg; nExcl++; }

        console.log(`${key}: OEE=${(oeeAvg * 100).toFixed(2)}% TEEP=${(teepAvg * 100).toFixed(2)}% ${!hasProduction ? '← EXCLUÍDO (zero)' : ''}`);
    }

    console.log('\n=== Resultados ===');
    console.log(`Inclui tudo:       OEE=${n > 0 ? ((oeeSum / n) * 100).toFixed(2) + '%' : 'N/A'} | TEEP=${n > 0 ? ((teepSum / n) * 100).toFixed(2) + '%' : 'N/A'} (${n} grupos)`);
    console.log(`Exclui zeros:      OEE=${nExcl > 0 ? ((oeeSumExcl / nExcl) * 100).toFixed(2) + '%' : 'N/A'} | TEEP=${nExcl > 0 ? ((teepSumExcl / nExcl) * 100).toFixed(2) + '%' : 'N/A'} (${nExcl} grupos)`);
    console.log(`\nEsperado fábrica:  OEE=52.66% | TEEP=40.29%`);
}
main();
