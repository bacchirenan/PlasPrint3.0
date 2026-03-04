
const XLSX = require('xlsx');

function toPercent(v) {
    if (v === undefined || v === null) return 0;
    const s = String(v).replace('%', '').replace(',', '.').trim();
    const n = parseFloat(s);
    if (isNaN(n)) return 0;
    return n > 1 ? n / 100 : n;
}

const oeeFile = 'd:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\oee teep.xlsx';
const oeeWb = XLSX.readFile(oeeFile);
const oeeData = XLSX.utils.sheet_to_json(oeeWb.Sheets['oee teep'], { header: 1 });

const prodFile = 'd:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\producao.xlsx';
const prodWb = XLSX.readFile(prodFile);
const prodData = XLSX.utils.sheet_to_json(prodWb.Sheets['producao'], { header: 1 });

const EXCLUDE_CODES = ['0097', '0007', '0083', '0099', '0101', '0102'];
const paradasSet = new Set();
prodData.forEach((row, i) => {
    if (i < 5) return;
    const registro = String(row[7] || '');
    const isExcludedCode = EXCLUDE_CODES.some(code => registro.startsWith(code));
    const isParadaPrevista = registro.toUpperCase().includes('PARADA PREVISTA');

    if (isExcludedCode || isParadaPrevista) {
        const maq = String(row[1] || '').trim();
        const d = row[2]; // Assumindo DD/MM/YYYY na Col B (Index 1 is maq, 2 is date string)
        let dIso = '';
        if (typeof d === 'string') {
            const p = d.split('/');
            dIso = `${p[2]}-${p[1]}-${p[0]}`;
        }
        const h = parseInt(row[5]) || 0;
        paradasSet.add(`${maq}|${dIso}|${h}`);
    }
});

const startDate = '2026-02-16';
const endDate = '2026-02-21';

const rows = [];
oeeData.slice(3).forEach(row => {
    const maq = String(row[1] || '').trim();
    if (maq.includes('Turno')) return;

    const dStr = String(row[2]); // Col C
    const p = dStr.split('/');
    const dIso = `${p[2]}-${p[1]}-${p[0]}`;
    if (dIso < startDate || dIso > endDate) return;

    const hour = parseInt(row[4]);
    const disp = toPercent(row[7]);
    const perf = toPercent(row[8]);
    const qual = toPercent(row[9]);
    const oee = disp * perf * qual;

    const isParada = paradasSet.has(`${maq}|${dIso}|${hour}`);

    rows.push({ maq, dIso, hour, oee, isParada });
});

console.log(`Total rows after date filter: ${rows.length}`);

function solve(label, list) {
    const listNo29 = list.filter(r => !r.maq.includes('29-CX'));
    const active = listNo29.filter(r => !r.isParada);
    const avg = active.reduce((a, b) => a + Math.min(b.oee, 1.05), 0) / (active.length || 1);
    console.log(`${label}: ${(avg * 100).toFixed(2)}% (Active Hours: ${active.length})`);
}

solve('TOTAL (No M29)', rows);
solve('M181 only', rows.filter(r => r.maq.includes('181')));
solve('M182 only', rows.filter(r => r.maq.includes('182')));
solve('M28 only', rows.filter(r => r.maq.includes('28')));
solve('M180 only', rows.filter(r => r.maq.includes('180')));
