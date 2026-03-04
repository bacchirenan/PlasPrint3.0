
const XLSX = require('xlsx');
const workbook = XLSX.readFile('d:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\producao.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];

// Try to find the header row by looking for "Produção" or "Máquina"
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
for (let i = 0; i < 10; i++) {
    console.log(`Row ${i}:`, data[i]);
}
