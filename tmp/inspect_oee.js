
const XLSX = require('xlsx');
const workbook = XLSX.readFile('d:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\oee teep.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log("Structure of oee teep.xlsx (first 10 rows):");
data.slice(0, 10).forEach((row, i) => {
    console.log(`Row ${i}:`, row.map((v, j) => `[${j}] ${v}`).join(' | '));
});
