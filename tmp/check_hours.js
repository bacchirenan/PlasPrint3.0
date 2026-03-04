
const XLSX = require('xlsx');

const oeeFile = 'd:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\oee teep.xlsx';
const oeeWb = XLSX.readFile(oeeFile);
const oeeData = XLSX.utils.sheet_to_json(oeeWb.Sheets[oeeWb.SheetNames[0]], { header: 1 });

const startDate = '2026-02-16';
const endDate = '2026-02-21';

const hoursA = new Set();
const hoursB = new Set();

oeeData.forEach((row, i) => {
    if (i < 3) return;
    const date = String(row[2]);
    if (!date.includes('/02/2026')) return;
    const dIso = date.split('/').reverse().join('-');
    if (dIso < startDate || dIso > endDate) return;

    const hour = parseInt(row[4]);
    const shift = String(row[3]);
    if (shift === '1') hoursA.add(hour);
    if (shift === '2') hoursB.add(hour);
});

console.log("Hours in Shift 1 (A):", [...hoursA].sort((a, b) => a - b));
console.log("Hours in Shift 2 (B):", [...hoursB].sort((a, b) => a - b));
