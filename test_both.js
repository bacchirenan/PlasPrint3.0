import { parseProducaoXlsx } from './lib/data-parsers.js';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function runTest() {
    const { data: ordens } = await supabase.from('ordens_programadas').select('*');
    const buf = fs.readFileSync('producao.xlsx');
    const producaoData = parseProducaoXlsx(buf);
    
    const osTotals = {};
    const normalizeOs = (val) => val.toString().replace(/\D/g, '');
    
    producaoData.forEach(row => {
        const os = normalizeOs(row.os || '');
        if (!os) return;
        osTotals[os] = (osTotals[os] || 0) + row.pecas_boas;
    });

    const o = ordens.find(x => x.os.includes('1428373'));
    if (!o) {
        console.log("Ordem 1428373 not found in DB");
    } else {
        const osNorm = o.os.toString().replace(/\D/g, '');
        const dbRealizados = Number(o.ciclos_realizados) || 0;
        const planRealizados = osTotals[osNorm] !== undefined ? Number(osTotals[osNorm]) : 0;
        const realizados = Math.max(dbRealizados, planRealizados);
        const planejados = Number(o.ciclos_planejados) || 0;
        console.log("OS:", o.os, "| dbRealizados:", dbRealizados, "| planRealizados:", planRealizados, "| final realizados:", realizados, "| planejados:", planejados);
        console.log("Is completed?", planejados > 0 && realizados >= planejados);
    }
}
runTest();
