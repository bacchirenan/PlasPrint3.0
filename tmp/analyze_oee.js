
const XLSX = require('xlsx');

function toPercent(v) {
    if (v === undefined || v === null) return 0;
    const s = String(v).replace('%', '').trim();
    return (parseFloat(s) || 0) / 100;
}

const oeeFile = 'd:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\oee teep.xlsx';
const oeeData = XLSX.utils.sheet_to_json(XLSX.readFile(oeeFile).Sheets['oee teep'], { header: 1 });

const startDate = '2026-02-16';
const endDate = '2026-02-21';

const rows = [];
oeeData.slice(3).forEach(row => {
    const dStr = String(row[2]);
    const dIso = dStr.split('/').reverse().join('-');
    if (dIso < startDate || dIso > endDate) return;

    rows.push({
        maq: String(row[1]).trim(),
        shift: String(row[3]).trim(),
        oee: toPercent(row[11])
    });
});

console.log("Avg per machine (Target: 45.94%):");
const maqs = [...new Set(rows.map(r => r.maq))];
maqs.forEach(m => {
    const filt = rows.filter(r => r.maq === m);
    const avg = filt.reduce((a, b) => a + b.oee, 0) / filt.length;
    console.log(`${m}: ${(avg * 100).toFixed(2)}%`);
});
