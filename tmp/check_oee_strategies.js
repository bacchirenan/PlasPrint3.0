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
        headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3.json' }
    });
    const json = await res.json();
    const buffer = Buffer.from(json.content, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Para cada estratégia de cálculo, aplicar no dia 04/03
    // Estratégia A: média simples dos valores, com zeros, capping OEE em 100%
    // Estratégia B: média simples dos valores, COM zeros, sem cap
    // Estratégia C: soma / total de horas fixas por turno (8h de horas disponíveis por máquina)

    const dataRows = [];
    for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row) continue;
        const dateVal = String(row[2] ?? '').trim();
        if (dateVal !== '04/03/2026') continue;
        const maq = String(row[1] ?? '').trim();
        if (!maq || maq.toLowerCase().includes('turno')) continue;
        const turno = Number(row[3]);
        if (![1, 2].includes(turno)) continue; // Apenas A e B
        const teep = toPercent(row[10]);
        const oee = toPercent(row[11]);
        if (teep === null || oee === null) continue;
        dataRows.push({ maq, turno, hora: row[4], teep, oee });
    }

    // Esperado: OEE A=66.13%, B=50.68%, Dia=51.78%
    //           TEEP A=48.68%,B=42.88%, Dia=30.52%

    const strategies = [
        { name: 'Média COM zeros, SEM cap', fn: (v, cap) => v },
        { name: 'Média COM zeros, OEE capped 100%', fn: (v, cap) => cap ? Math.min(v, 1.0) : v },
        { name: 'Média SEM zeros, OEE capped 100%', fn: (v, cap) => cap ? Math.min(v, 1.0) : v, skipZero: true },
    ];

    for (const strat of strategies) {
        console.log(`\n=== ${strat.name} ===`);
        for (const turno of [1, 2, 'all']) {
            const rows = turno === 'all' ? dataRows : dataRows.filter(r => r.turno === turno);

            let oees = rows.map(r => strat.fn(r.oee, true));
            let teeps = rows.map(r => strat.fn(r.teep, false));

            if (strat.skipZero) {
                oees = oees.filter(v => v > 0);
                teeps = teeps.filter(v => v > 0);
            }

            const oeeMedia = oees.length > 0 ? oees.reduce((a, b) => a + b, 0) / oees.length : 0;
            const teepMedia = teeps.length > 0 ? teeps.reduce((a, b) => a + b, 0) / teeps.length : 0;
            const label = turno === 'all' ? 'DIA ' : `T${turno}  `;
            console.log(`  ${label}: OEE=${(oeeMedia * 100).toFixed(2)}% | TEEP=${(teepMedia * 100).toFixed(2)}%`);
        }
    }

    // Estratégia D: OEE da fábrica provavelmente é média por grupo de máquina-turno
    // (Soma OEE das horas / total horas por turno para cada máquina, depois média entre máquinas)
    console.log('\n=== Estratégia: Média por Máquina → depois média Geral (OEE cap 100%) ===');
    const maqTurnos = {};
    for (const r of dataRows) {
        const key = `${r.maq}|${r.turno}`;
        if (!maqTurnos[key]) maqTurnos[key] = { oees: [], teeps: [], maq: r.maq, turno: r.turno };
        maqTurnos[key].oees.push(Math.min(r.oee, 1.0));
        maqTurnos[key].teeps.push(r.teep);
    }

    for (const turno of [1, 2]) {
        const keys = Object.keys(maqTurnos).filter(k => Number(k.split('|')[1]) === turno);
        const oeesByMaq = keys.map(k => maqTurnos[k].oees.reduce((a, b) => a + b, 0) / maqTurnos[k].oees.length);
        const teepsByMaq = keys.map(k => maqTurnos[k].teeps.reduce((a, b) => a + b, 0) / maqTurnos[k].teeps.length);
        console.log(`  T${turno}: OEE=${((oeesByMaq.reduce((a, b) => a + b, 0) / oeesByMaq.length) * 100).toFixed(2)}% | TEEP=${((teepsByMaq.reduce((a, b) => a + b, 0) / teepsByMaq.length) * 100).toFixed(2)}%`);
        for (const k of keys) {
            const d = maqTurnos[k];
            console.log(`    ${d.maq}: OEE=${((d.oees.reduce((a, b) => a + b, 0) / d.oees.length) * 100).toFixed(2)}% TEEP=${((d.teeps.reduce((a, b) => a + b, 0) / d.teeps.length) * 100).toFixed(2)}%`);
        }
    }

    console.log('\n  ESPERADO OEE: A=66.13% B=50.68% Dia=51.78%');
    console.log('  ESPERADO TEEP: A=48.68% B=42.88% Dia=30.52%');
}
main();
