
const XLSX = require('xlsx');

const prodFile = 'd:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\producao.xlsx';
const prodWb = XLSX.readFile(prodFile);
const prodData = XLSX.utils.sheet_to_json(prodWb.Sheets[prodWb.SheetNames[0]], { header: 1 });

const oeeFile = 'd:\\IMPRESSAO\\SOFTWARES\\PlasPrint IA Web\\oee teep.xlsx';
const oeeWb = XLSX.readFile(oeeFile);
const oeeData = XLSX.utils.sheet_to_json(oeeWb.Sheets[oeeWb.SheetNames[0]], { header: 1 });

console.log("Samples from producao.xlsx (Machine, Registro, Date):");
prodData.slice(1, 6).forEach(r => console.log(`'${r[0]}'`, `'${r[1]}'`, `'${r[3]}'`));

console.log("\nSamples from oee teep.xlsx (Machine, Date, Shift):");
oeeData.slice(1, 6).forEach(r => console.log(`'${r[1]}'`, `'${r[2]}'`, `'${r[3]}'`));
