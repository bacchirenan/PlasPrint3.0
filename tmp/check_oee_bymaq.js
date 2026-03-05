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

    // Pega todas as linhas do dia 04/03, apenas T1 e T2
    const dataRows = [];
    for (let i = 1; i < raw.length; i++) {
        const row = raw[i];
        if (!row) continue;
        const dateVal = String(row[2] ?? '').trim();
        if (dateVal !== '04/03/2026') continue;
        const maq = String(row[1] ?? '').trim();
        if (!maq || maq.toLowerCase().includes('turno')) continue;
        const turno = Number(row[3]);
        if (![1, 2].includes(turno)) continue;
        const teep = toPercent(row[10]);
        const oee = toPercent(row[11]);
        if (teep === null || oee === null) continue;
        dataRows.push({ maq, turno, hora: row[4], teep: teep, oee: oee, oeeCapped: Math.min(oee, 1.0) });
    }

    // Por máquina×turno (todos os registros)
    console.log('=== Por Máquina×Turno (8 horas, cap 100% no OEE) ===');
    const MAQS = ['28-CX-360G', '29-CX-360G', '180- CX-360G', '181- CX-360G', '182- CX-360G'];
    const maqTurnoAvg = {};
    for (const maq of MAQS) {
        for (const turno of [1, 2]) {
            const rows = dataRows.filter(r => r.maq === maq && r.turno === turno);
            if (rows.length === 0) continue;
            const oeeAvg = rows.reduce((a, r) => a + r.oeeCapped, 0) / rows.length;
            const teepAvg = rows.reduce((a, r) => a + r.teep, 0) / rows.length;
            maqTurnoAvg[`${maq}|${turno}`] = { oee: oeeAvg, teep: teepAvg, n: rows.length, maq, turno };
            console.log(`  ${maq} T${turno} (${rows.length}h): OEE=${(oeeAvg * 100).toFixed(2)}% TEEP=${(teepAvg * 100).toFixed(2)}%`);
        }
    }

    // Test 1: média das 5 máquinas por turno (incluindo M29)
    console.log('\n=== T1 e T2: média das 5 máquinas (cap 100%) COM M29 ===');
    for (const turno of [1, 2]) {
        const keys = Object.keys(maqTurnoAvg).filter(k => Number(k.split('|')[1]) === turno);
        const oeeAvg = keys.reduce((a, k) => a + maqTurnoAvg[k].oee, 0) / keys.length;
        const teepAvg = keys.reduce((a, k) => a + maqTurnoAvg[k].teep, 0) / keys.length;
        console.log(`  T${turno}: OEE=${(oeeAvg * 100).toFixed(2)}% | TEEP=${(teepAvg * 100).toFixed(2)}%`);
    }

    // Test 2: excluindo M29
    console.log('\n=== T1 e T2: média das 4 máquinas (cap 100%) SEM M29 ===');
    for (const turno of [1, 2]) {
        const keys = Object.keys(maqTurnoAvg).filter(k => Number(k.split('|')[1]) === turno && !k.includes('29-CX'));
        const oeeAvg = keys.reduce((a, k) => a + maqTurnoAvg[k].oee, 0) / keys.length;
        const teepAvg = keys.reduce((a, k) => a + maqTurnoAvg[k].teep, 0) / keys.length;
        console.log(`  T${turno}: OEE=${(oeeAvg * 100).toFixed(2)}% | TEEP=${(teepAvg * 100).toFixed(2)}%`);
    }

    // Test 3: M29 tem 0 de TEEP e OEE, o que exclui seu "peso" da média ou não?
    // Vamos tentar: só inclui máquinas com pelo menos 1 hora trabalhada (oee>0)
    console.log('\n=== T1 e T2: apenas máquinas com pelo menos 1h >0 (cap 100%) ===');
    for (const turno of [1, 2]) {
        const keys = Object.keys(maqTurnoAvg).filter(k => {
            if (Number(k.split('|')[1]) !== turno) return false;
            return maqTurnoAvg[k].oee > 0;
        });
        const oeeAvg = keys.reduce((a, k) => a + maqTurnoAvg[k].oee, 0) / keys.length;
        const teepAvg = keys.reduce((a, k) => a + maqTurnoAvg[k].teep, 0) / keys.length;
        console.log(`  T${turno} (${keys.length} máqs): OEE=${(oeeAvg * 100).toFixed(2)}% | TEEP=${(teepAvg * 100).toFixed(2)}%`);
        for (const k of keys) {
            console.log(`    ${maqTurnoAvg[k].maq}: OEE=${(maqTurnoAvg[k].oee * 100).toFixed(2)}%  TEEP=${(maqTurnoAvg[k].teep * 100).toFixed(2)}%`);
        }
    }

    console.log('\n  ESPERADO: OEE A=66.13% B=50.68% | TEEP A=48.68% B=42.88% | Dia OEE=51.78% Dia TEEP=30.52%');
}
main();
