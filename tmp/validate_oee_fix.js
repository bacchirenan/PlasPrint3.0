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

    const TARGET_DATES = ['02/03/2026', '03/03/2026', '04/03/2026'];
    let oeeSum = 0, teepSum = 0, n = 0;

    for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row || !row[1]) continue;
        const date = String(row[2] ?? '').trim();
        if (!TARGET_DATES.includes(date)) continue;
        const maq = String(row[1] ?? '').trim();
        if (!maq || maq.toLowerCase().includes('turno')) continue;

        // Exclui T3
        const turnoNum = Number(String(row[3] ?? '').trim().split('.')[0]);
        if (![1, 2].includes(turnoNum)) continue;

        const oeeRaw = toPercent(row[11]);
        const teepRaw = toPercent(row[10]);
        if (oeeRaw === null || teepRaw === null) continue;

        // Cap 100%
        oeeSum += Math.min(oeeRaw, 1.0);
        teepSum += Math.min(teepRaw, 1.0);
        n++;
    }

    console.log(`Período: 02/03 a 04/03 (apenas T1+T2, cap 100%)`);
    console.log(`Registros: ${n}`);
    console.log(`OEE médio:  ${n > 0 ? ((oeeSum / n) * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log(`TEEP médio: ${n > 0 ? ((teepSum / n) * 100).toFixed(2) + '%' : 'N/A'}`);
    console.log();
    console.log('Esperado: OEE=52.66%, TEEP=40.29%');
}
main();
