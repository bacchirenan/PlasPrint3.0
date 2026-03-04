
const XLSX = require('xlsx');

function excelDateToIso(excelDate) {
    if (typeof excelDate === 'number') {
        const date = new Date((excelDate - 25569) * 86400000);
        return date.toISOString().split('T')[0];
    }
    if (typeof excelDate === 'string') {
        const parts = String(excelDate).split('/');
        if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return String(excelDate);
}

// 1. Get Paradas Previstas with key logging
const prodFile = 'd:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\producao.xlsx';
const prodWb = XLSX.readFile(prodFile);
const prodData = XLSX.utils.sheet_to_json(prodWb.Sheets[prodWb.SheetNames[0]], { header: 1 });
const paradasSet = new Set();
prodData.slice(0, 50).forEach((row, i) => {
    const registro = String(row[7] || '');
    if (registro.includes('[ Parada Prevista ]')) {
        const maq = String(row[1] || '').trim();
        const dateStr = excelDateToIso(row[2]);
        const hour = parseInt(row[5]) || 0;
        const key = `${maq}|${dateStr}|${hour}`;
        paradasSet.add(key);
        console.log(`Add Parada Key: ${key}`);
    }
});

// 2. Read OEE with key comparison
const oeeFile = 'd:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\oee teep.xlsx';
const oeeWb = XLSX.readFile(oeeFile);
const oeeData = XLSX.utils.sheet_to_json(oeeWb.Sheets[oeeWb.SheetNames[0]], { header: 1 });

oeeData.slice(0, 50).forEach((row, i) => {
    if (i < 3) return;
    const maq = String(row[1] || '').trim();
    const date = excelDateToIso(row[2]);
    const hour = parseInt(row[4]) || 0;
    const key = `${maq}|${date}|${hour}`;
    if (paradasSet.has(key)) {
        console.log(`Match Found for key: ${key}`);
    } else if (i < 10) {
        console.log(`Checking OEE key: ${key}`);
    }
});
