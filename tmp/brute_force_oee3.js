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

function calc(opts) {
    let sums = { '28-CX-360G': { oee: 0, n: 0 }, '29-CX-360G': { oee: 0, n: 0 }, '180- CX-360G': { oee: 0, n: 0 }, '181- CX-360G': { oee: 0, n: 0 }, '182- CX-360G': { oee: 0, n: 0 } };
    let totalOee = 0; let totalN = 0;

    for (const row of oeeRaw) {
        if (!row || !row[1]) continue;
        const maq = String(row[1]).trim();
        if (!sums[maq]) continue;

        let dateStr = '';
        if (typeof row[2] === 'number') {
            const date = xlsx.SSF.parse_date_code(row[2]);
            if (date) dateStr = new Date(Date.UTC(date.y, date.m - 1, date.d)).toISOString().split('T')[0];
        } else {
            const parts = String(row[2]).trim().split('/');
            if (parts.length === 3) dateStr = new Date('20' + parts[2].slice(-2) + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0')).toISOString().split('T')[0];
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

        const isP = paradasSet.has(maq + '|' + dateStr + '|' + hora);
        if (opts.rP && isP) continue;

        const oeeRaw = String(row[11] ?? '').replace('%', '').replace(',', '.').trim();
        let oee = parseFloat(oeeRaw) > 1 ? parseFloat(oeeRaw) / 100 : parseFloat(oeeRaw);
        if (isNaN(oee)) oee = 0;

        if (opts.z0 && oee === 0) continue;

        sums[maq].oee += oee;
        sums[maq].n++;
        totalOee += oee;
        totalN++;
    }

    // Factory Total OEE seems to be 41.38

    // Possibility A: Average of the rows
    let tOutA = totalN > 0 ? (totalOee / totalN * 100) : 0;

    // Possibility B: Average of the machines (ignoring machine 29 which is 0)
    let n28 = sums['28-CX-360G'].n > 0 ? (sums['28-CX-360G'].oee / sums['28-CX-360G'].n * 100) : 0;
    let n29 = sums['29-CX-360G'].n > 0 ? (sums['29-CX-360G'].oee / sums['29-CX-360G'].n * 100) : 0;
    let n180 = sums['180- CX-360G'].n > 0 ? (sums['180- CX-360G'].oee / sums['180- CX-360G'].n * 100) : 0;
    let n181 = sums['181- CX-360G'].n > 0 ? (sums['181- CX-360G'].oee / sums['181- CX-360G'].n * 100) : 0;
    let n182 = sums['182- CX-360G'].n > 0 ? (sums['182- CX-360G'].oee / sums['182- CX-360G'].n * 100) : 0;

    let tOutB = (n28 + n180 + n181 + n182) / 4;
    let tOutC = (n28 + n29 + n180 + n181 + n182) / 5;

    let targetTotal = 41.38;

    let distA = Math.sqrt(Math.pow(tOutA - targetTotal, 2) + Math.pow(n28 - 81.24, 2) + Math.pow(n180 - 48.71, 2) + Math.pow(n181 - 52.91, 2) + Math.pow(n182 - 58.03, 2));
    let distB = Math.sqrt(Math.pow(tOutB - targetTotal, 2) + Math.pow(n28 - 81.24, 2) + Math.pow(n180 - 48.71, 2) + Math.pow(n181 - 52.91, 2) + Math.pow(n182 - 58.03, 2));
    let distC = Math.sqrt(Math.pow(tOutC - targetTotal, 2) + Math.pow(n28 - 81.24, 2) + Math.pow(n180 - 48.71, 2) + Math.pow(n181 - 52.91, 2) + Math.pow(n182 - 58.03, 2));

    return [
        { dist: distA, type: 'Avg Rows', total: tOutA, n28, n180, n181, n182, opts },
        { dist: distB, type: 'Avg 4 Machines', total: tOutB, n28, n180, n181, n182, opts },
        { dist: distC, type: 'Avg 5 Machines', total: tOutC, n28, n180, n181, n182, opts }
    ];
}

let res = [];
let bools = [true, false];
for (let rT3 of bools)
    for (let rTV of bools)
        for (let rHV of bools)
            for (let rH of bools)
                for (let rP of bools)
                    for (let z0 of bools) {
                        if (!rT3 && rH && rTV) continue; // prune some
                        res.push(...calc({ rT3, rTV, rHV, rH, rP, z0 }));
                    }
res.sort((a, b) => a.dist - b.dist);
console.log('BEST MATCHES:');
for (let i = 0; i < 8; i++) {
    console.log(`DIST: ${res[i].dist.toFixed(2)} [${res[i].type}] | T: ${res[i].total.toFixed(2)} | 28: ${res[i].n28.toFixed(2)} | 180: ${res[i].n180.toFixed(2)} | 181: ${res[i].n181.toFixed(2)} | 182: ${res[i].n182.toFixed(2)}`);
    console.log(JSON.stringify(res[i].opts));
}
