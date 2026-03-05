import { parseCanudosXlsx } from './lib/data-parsers';
import { readFileSync, writeFileSync } from 'fs';
import * as xlsx from 'xlsx';

// Try reading .env.local for github tokens
const env = readFileSync('.env.local', 'utf-8');
const fetchOpts = { headers: {} };
for (const line of env.split('\n')) {
    if (line.startsWith('GITHUB_TOKEN=')) {
        fetchOpts.headers['Authorization'] = `token ${line.split('=')[1].trim()}`;
    }
}

async function main() {
    const res = await fetch('https://raw.githubusercontent.com/bacchirenan/PlasPrint2.0/main/Canudos.xlsx', fetchOpts);
    const buf = await res.arrayBuffer();

    const parsed = parseCanudosXlsx(buf);
    writeFileSync('tmp/parsed_canudos.json', JSON.stringify(parsed, null, 2));
    console.log('Done parsing.');
}
main().catch(console.error);
