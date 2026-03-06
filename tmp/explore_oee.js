const fs = require('fs');
const xlsx = require('xlsx');

const oeeBuf = fs.readFileSync('oee teep.xlsx');
const oeeWb = xlsx.read(oeeBuf, { type: 'buffer', cellDates: false });
const oeeWs = oeeWb.Sheets[oeeWb.SheetNames[0]];
const oeeRaw = xlsx.utils.sheet_to_json(oeeWs, { header: 1, defval: null }).slice(1);

const prodBuf = fs.readFileSync('producao.xlsx');
const prodWb = xlsx.read(prodBuf, { type: 'buffer', cellDates: false });
const prodWs = prodWb.Sheets[prodWb.SheetNames[0]];
const prodRaw = xlsx.utils.sheet_to_json(prodWs, { header: 1, defval: null }).slice(3);

const paradasSet = new Set();
for (const row of prodRaw) {
    if (!row || !row[1]) continue;
    const maq = String(row[1]).trim();
    if (!maq || maq.toLowerCase().includes('turno')) continue;
    let dateStr = '';
    if (typeof row[2] === 'number') {
        const date = xlsx.SSF.parse_date_code(row[2]);
        if (date) {
            const d = new Date(Date.UTC(date.y, date.m - 1, date.d));
            dateStr = d.toISOString().split('T')[0];
        }
    } else {
        const parts = String(row[2]).trim().split('/');
        if (parts.length === 3) dateStr = new Date('20' + parts[2].slice(-2) + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0')).toISOString().split('T')[0];
    }
    const sTr = String(row[5]).replace(',', '.').trim();
    const hora = parseFloat(sTr) || 0;
    const reg = String(row[7] || '').toLowerCase();
    if (reg.includes('parada prevista') || reg.includes('paradda prevista')) {
        paradasSet.add(maq + '|' + dateStr + '|' + hora);
    }
}

// SIMULATE EXACT FACTORY CALCULATION
let sums = { '28-CX-360G': { oee: 0, n: 0 }, '29-CX-360G': { oee: 0, n: 0 }, '180- CX-360G': { oee: 0, n: 0 }, '181- CX-360G': { oee: 0, n: 0 }, '182- CX-360G': { oee: 0, n: 0 } };
let sumsFac = { '28-CX-360G': { oee: 0, n: 0 }, '29-CX-360G': { oee: 0, n: 0 }, '180- CX-360G': { oee: 0, n: 0 }, '181- CX-360G': { oee: 0, n: 0 }, '182- CX-360G': { oee: 0, n: 0 } };

let totalOee = 0; let totalN = 0;

for (const row of oeeRaw) {
    if (!row || !row[1]) continue;
    const maq = String(row[1]).trim();
    if (!sums[maq]) continue; // Only process the 5 machines

    // Date
    let dateStr = '';
    if (typeof row[2] === 'number') {
        const date = xlsx.SSF.parse_date_code(row[2]);
        if (date) dateStr = new Date(Date.UTC(date.y, date.m - 1, date.d)).toISOString().split('T')[0];
    } else {
        const parts = String(row[2]).trim().split('/');
        if (parts.length === 3) dateStr = new Date('20' + parts[2].slice(-2) + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0')).toISOString().split('T')[0];
    }
    if (!dateStr || dateStr < '2025-01-01' || dateStr > '2026-03-04') continue;

    // RULE: Rejeite Turno 3, Turno que Tiver Turno, e Turno que estiver Vazio
    const turnoRaw = String(row[3] ?? '').trim();
    let rTurno = (!turnoRaw || turnoRaw.toLowerCase().includes('turno') || turnoRaw === '3' || turnoRaw.startsWith('3'));

    // RULE: Rejeite horas 0, 1, 2, 3, 4, 5, 23
    let sTr = String(row[4] ?? '').replace(',', '.').trim();
    const hora = parseFloat(sTr);
    let rHora = [0, 1, 2, 3, 4, 5, 23].includes(hora);
    let rHoraVazia = (row[4] === null || row[4] === undefined || String(row[4]).trim() === '');

    // Parada Prevista
    const isP = paradasSet.has(maq + '|' + dateStr + '|' + hora);

    let oee = parseFloat(String(row[11] ?? '').replace('%', '').replace(',', '.').trim());
    if (isNaN(oee)) oee = 0;
    if (oee > 1) oee = oee / 100;

    // Strategy 1 (Factory exactly as requested)
    if (!rTurno && !rHora && !rHoraVazia && !isP) {
        sums[maq].oee += oee;
        sums[maq].n++;
        totalOee += oee;
        totalN++;
    }

    // Strategy 2 (Only Paradas Previstas and valid dates)
    if (!isP) {
        sumsFac[maq].oee += oee;
        sumsFac[maq].n++;
    }
}

console.log('--- EXACT REQUESTED STRATEGY ---');
for (let maq in sums) {
    if (sums[maq].n > 0) console.log(maq + ': ' + (sums[maq].oee / sums[maq].n * 100).toFixed(2) + '% | N=' + sums[maq].n);
}
console.log('TOTAL: ' + (totalN > 0 ? (totalOee / totalN * 100).toFixed(2) : '0') + '% | N=' + totalN);

console.log('--- ONLY PARADAS PREVISTAS STRATEGY ---');
for (let maq in sumsFac) {
    if (sumsFac[maq].n > 0) console.log(maq + ': ' + (sumsFac[maq].oee / sumsFac[maq].n * 100).toFixed(2) + '% | N=' + sumsFac[maq].n);
}
