const fs = require('fs');
const xlsx = require('xlsx');

const GITHUB_TOKEN = ''; // add your token if needed, or rely on public
const GITHUB_REPO = 'bacchirenan/PlasPrint2.0';
const GITHUB_BRANCH = 'main';

async function main() {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/Canudos.xlsx`;
    console.log('Fetching', url);
    const headers = { 'Accept': 'application/vnd.github.v3.raw' };

    // read .env.local for github tokens
    try {
        const env = fs.readFileSync('.env.local', 'utf-8');
        for (const line of env.split('\n')) {
            if (line.startsWith('GITHUB_TOKEN=')) {
                headers['Authorization'] = `token ${line.split('=')[1].trim()}`;
            }
        }
    } catch (e) { }

    const res = await fetch(url, { headers });

    if (!res.ok) {
        console.error('Failed to fetch', res.status, res.statusText);
        return;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });
    console.log('Sheet Names:', wb.SheetNames);

    const abaArte = wb.SheetNames.find(n => n.toUpperCase().includes('ARTE') || n.toUpperCase().includes('DECORA') || n.toUpperCase().includes('LOTE')) || wb.SheetNames[1];
    console.log('Aba Arte selection:', abaArte);

    const ws = wb.Sheets[abaArte];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    console.log('First 20 rows of ABA ARTE:');
    for (let i = 0; i < Math.min(20, raw.length); i++) {
        console.log(`L${i + 1}:`, raw[i].slice(0, 8)); // Print up to column H
    }
}

main().catch(console.error);
