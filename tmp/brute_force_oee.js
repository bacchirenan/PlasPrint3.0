const fs = require('fs');
const xlsx = require('xlsx');

// 1. Read OEE data
const oeeBuf = fs.readFileSync('oee teep.xlsx');
const oeeWb = xlsx.read(oeeBuf, { type: 'buffer', cellDates: false });
const oeeWs = oeeWb.Sheets[oeeWb.SheetNames[0]];
const oeeRaw = xlsx.utils.sheet_to_json(oeeWs, { header: 1, defval: null }).slice(1);

// 2. Read Production data to get paradas previstas
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
        const s = String(row[2]).trim();
        const parts = s.split('/');
        if (parts.length === 3) {
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            const d = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
            if (!isNaN(d.getTime())) dateStr = d.toISOString().split('T')[0];
        }
    }
    const sTr = String(row[5]).replace(',', '.').trim();
    const hora = parseFloat(sTr) || 0;
    const reg = String(row[7] || '').toLowerCase();
    if (reg.includes('parada prevista') || reg.includes('paradda prevista')) {
        paradasSet.add(`${maq}|${dateStr}|${hora}`);
    }
}

function calc(opts) {
    let sums = { '28-CX-360G': { oee: 0, n: 0 }, '29-CX-360G': { oee: 0, n: 0 }, '180- CX-360G': { oee: 0, n: 0 }, '181- CX-360G': { oee: 0, n: 0 }, '182- CX-360G': { oee: 0, n: 0 } };
    let totalOee = 0; let totalN = 0;

    for (const row of oeeRaw) {
        if (!row || !row[1]) continue;
        const maq = String(row[1]).trim();
        if (!maq || maq.toLowerCase().includes('turno')) continue;

        let dateStr = '';
        if (typeof row[2] === 'number') {
            const date = xlsx.SSF.parse_date_code(row[2]);
            if (date) dateStr = new Date(Date.UTC(date.y, date.m - 1, date.d)).toISOString().split('T')[0];
        } else {
            const parts = String(row[2]).trim().split('/');
            if (parts.length === 3) dateStr = new Date(`20${parts[2].slice(-2)}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`).toISOString().split('T')[0];
        }
        if (!dateStr || dateStr < '2025-01-01' || dateStr > '2026-03-04') continue;

        const turnoRaw = String(row[3] ?? '').trim();
        if (opts.rT3 && (turnoRaw === '3' || turnoRaw.startsWith('3'))) continue;
        if (opts.rTV && (!turnoRaw || turnoRaw.toLowerCase().includes('turno'))) continue;

        const hrRaw = row[4];
        if (opts.rHV && (hrRaw === null || hrRaw === undefined || String(hrRaw).trim() === '')) continue;

        let sTr = String(hrRaw).replace(',', '.').trim();
        if (!sTr) sTr = '0';
        const hora = parseFloat(sTr);

        if (opts.rH && [0, 1, 2, 3, 4, 5, 23].includes(hora)) continue;

        const isParada = paradasSet.has(`${maq}|${dateStr}|${hora}`);
        if (opts.rP && isParada) continue;

        const oeeRaw = String(row[11] ?? '').replace('%', '').replace(',', '.').trim();
        let oee = parseFloat(oeeRaw);
        if (isNaN(oee)) oee = 0;
        if (oee > 1) oee = oee / 100;

        if (opts.z0 && oee === 0) continue; // test discarding 0s
        if (opts.k0P && oee === 0 && !isParada) continue; // test discarding 0s if not parada

        if (!sums[maq]) sums[maq] = { oee: 0, n: 0 };
        sums[maq].oee += oee;
        sums[maq].n++;
        totalOee += oee;
        totalN++;
    }

    let overall = totalN > 0 ? (totalOee / totalN * 100).toFixed(2) : 0;
    let dif = Math.abs(parseFloat(overall) - 41.38);

    // add penalty for individual deviations
    let d28 = Math.abs(sums['28-CX-360G'].n > 0 ? (sums['28-CX-360G'].oee / sums['28-CX-360G'].n * 100) : 0 - 81.24)
    let d180 = Math.abs(sums['180- CX-360G'].n > 0 ? (sums['180- CX-360G'].oee / sums['180- CX-360G'].n * 100) : 0 - 48.71)
    let d181 = Math.abs(sums['181- CX-360G'].n > 0 ? (sums['181- CX-360G'].oee / sums['181- CX-360G'].n * 100) : 0 - 52.91)
    let d182 = Math.abs(sums['182- CX-360G'].n > 0 ? (sums['182- CX-360G'].oee / sums['182- CX-360G'].n * 100) : 0 - 58.03)

    let totalDif = dif + (d28 + d180 + d181 + d182) / 4;

    let str = `${overall}% | ` + Object.keys(sums).map(m => `${m}: ${sums[m].n > 0 ? (sums[m].oee / sums[m].n * 100).toFixed(2) : 0}`).join(' | ');
    return { dif: totalDif, overall, str, opts };
}

let results = [];
let bools = [true, false];

console.log("BASE (keep all):", calc({ rT3: false, rTV: false, rHV: false, rH: false, rP: false, z0: false, k0P: false }).str);

for (let rT3 of bools)
    for (let rTV of bools)
        for (let rHV of bools)
            for (let rH of bools)
                for (let rP of bools)
                    for (let z0 of bools)
                        for (let k0P of bools) {
                            if (z0 && k0P) continue;
                            results.push(calc({ rT3, rTV, rHV, rH, rP, z0, k0P }));
                        }
results.sort((a, b) => a.dif - b.dif);
console.log('BEST MATCHES:');
for (let i = 0; i < 5; i++) console.log(results[i].str, '\n', JSON.stringify(results[i].opts));
