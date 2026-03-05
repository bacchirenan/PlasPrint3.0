const fs = require('fs');
const xlsx = require('xlsx');

async function main() {
    const url = 'https://raw.githubusercontent.com/bacchirenan/PlasPrint3.0/main/db/Canudos.xlsx';
    console.log('Fetching', url);
    const headers = { 'Accept': 'application/vnd.github.v3.raw' };

    try {
        const env = fs.readFileSync('.env.local', 'utf-8');
        for (const line of env.split('\n')) {
            if (line.startsWith('GITHUB_TOKEN=')) {
                headers['Authorization'] = `token ${line.split('=')[1].trim()}`;
            }
        }
    } catch (e) { }

    const res = await fetch(url, { headers });
    if (!res.ok) { console.error('Failed', res.status); return; }

    const buffer = Buffer.from(await res.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });

    const abaArte = wb.SheetNames.find(n => n.toUpperCase().includes('ARTE') || n.toUpperCase().includes('DECORA') || n.toUpperCase().includes('LOTE')) || wb.SheetNames[1];

    const wsArt = wb.Sheets[abaArte];
    const raw = xlsx.utils.sheet_to_json(wsArt, { header: 1, defval: null });

    for (let i = 0; i < Math.min(10, raw.length); i++) {
        console.log(`L${i + 1}:`, JSON.stringify(raw[i].slice(0, 8)));
    }
}
main();
