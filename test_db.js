import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const q = async () => {
    const { data } = await supabase.from('ordens_programadas').select('*');
    console.log(data.find(x => String(x.os).includes('1428373')));
}
q();
