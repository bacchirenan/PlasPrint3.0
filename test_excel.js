import { parseProducaoXlsx } from './lib/data-parsers.js';
import fs from 'fs';

const buf = fs.readFileSync('producao.xlsx');
const rows = parseProducaoXlsx(buf);
const osRows = rows.filter(r => String(r.os).includes('1428373'));
console.log("Total for 1428373:", osRows.reduce((a,b)=>a+b.pecas_boas, 0));
