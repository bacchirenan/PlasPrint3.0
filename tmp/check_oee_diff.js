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

// TEST STRATEGIES
function testStrategy(opts) {
    let sums = { '28-CX-360G': { oee: 0, n: 0 }, '29-CX-360G': { oee: 0, n: 0 }, '180- CX-360G': { oee: 0, n: 0 }, '181- CX-360G': { oee: 0, n: 0 }, '182- CX-360G': { oee: 0, n: 0 } };
    let totalOee = 0; let totalN = 0;

    for (const row of oeeRaw) {
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
        if (!dateStr || dateStr < '2026-01-01' || dateStr > '2026-03-04') continue;

        const turnoRaw = String(row[3] ?? '').trim();
        if (opts.rejectTurno3 && (turnoRaw === '3' || turnoRaw.startsWith('3'))) continue;
        if (opts.rejectTurnoPalavra && (!turnoRaw || turnoRaw.toLowerCase().includes('turno'))) continue;

        if (row[4] === null || row[4] === undefined || String(row[4]).trim() === '') {
            if (opts.rejectHoraVazia) continue;
        }

        const sTr = String(row[4]).replace(',', '.').trim();
        const hora = parseFloat(sTr);

        if (opts.rejectHoras && [0, 1, 2, 3, 4, 5, 23].includes(hora)) continue;

        const key = `${maq}|${dateStr}|${hora}`;
        if (opts.rejectParadas && paradasSet.has(key)) continue;

        const oeeRaw = String(row[11] ?? '').replace('%', '').replace(',', '.').trim();
        let oee = parseFloat(oeeRaw);
        if (isNaN(oee)) oee = 0;
        if (oee > 1) oee = oee / 100;

        if (!sums[maq]) sums[maq] = { oee: 0, n: 0 };
        sums[maq].oee += oee;
        sums[maq].n++;
        totalOee += oee;
        totalN++;
    }

    let overall = (totalOee / totalN * 100).toFixed(2);
    let out = [];
    for (let maq in sums) {
        let avg = sums[maq].n > 0 ? (sums[maq].oee / sums[maq].n) * 100 : 0;
        out.push(`${maq}: ${avg.toFixed(2)}`);
    }
    console.log(`[Total: ${overall}%] ${JSON.stringify(opts)} => \n   ${out.join(' | ')}`);
}

testStrategy({ rejectTurno3: true, rejectTurnoPalavra: true, rejectHoraVazia: true, rejectHoras: true, rejectParadas: true });
// Let's try skipping some filters to match the factory exactly:

let bases = [
    { rejectTurno3: false, rejectTurnoPalavra: false, rejectHoraVazia: false, rejectHoras: false, rejectParadas: false },
    { rejectTurno3: true, rejectTurnoPalavra: true, rejectHoraVazia: true, rejectHoras: false, rejectParadas: false },
    { rejectTurno3: true, rejectTurnoPalavra: true, rejectHoraVazia: true, rejectHoras: true, rejectParadas: false },
    { rejectTurno3: false, rejectTurnoPalavra: false, rejectHoraVazia: false, rejectHoras: false, rejectParadas: true },
    { rejectTurno3: true, rejectTurnoPalavra: false, rejectHoraVazia: false, rejectHoras: true, rejectParadas: false },
    { rejectTurno3: true, rejectTurnoPalavra: false, rejectHoraVazia: false, rejectHoras: false, rejectParadas: false },
    { rejectTurno3: true, rejectTurnoPalavra: false, rejectHoraVazia: false, rejectHoras: false, rejectParadas: true },
    { rejectTurno3: false, rejectTurnoPalavra: false, rejectHoraVazia: true, rejectHoras: true, rejectParadas: false },
]
bases.forEach(b => testStrategy(b));

testStrategy({rejectTurno3: true, rejectTurnoPalavra: false, rejectHoraVazia: false, rejectHoras: false, rejectParadas: true});
