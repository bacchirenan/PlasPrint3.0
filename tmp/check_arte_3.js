const fs = require('fs');
const xlsx = require('xlsx');

async function main() {
    const GITHUB_REPO = 'bacchirenan/PlasPrint3.0';
    const GITHUB_BRANCH = 'main';
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/db/Canudos.xlsx?ref=${GITHUB_BRANCH}`;
    const headers = { 'Accept': 'application/vnd.github.v3.raw' };

    try {
        const env = fs.readFileSync('.env.local', 'utf-8');
        for (const line of env.split('\n')) {
            if (line.startsWith('GITHUB_TOKEN=')) {
                headers['Authorization'] = `token ${line.split('=')[1].trim()}`;
            }
        }
    } catch (e) { }

    headers['Accept'] = 'application/vnd.github.v3.raw';

    const res = await fetch(url, { headers });
    if (!res.ok) { console.error('Failed', res.status, res.statusText); return; }

    const buffer = Buffer.from(await res.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });
    console.log('Abas:', wb.SheetNames);

    const abaArte = wb.SheetNames.find(n => n.toUpperCase().includes('ARTE') || n.toUpperCase().includes('DECORA')) || wb.SheetNames[1];
    console.log('Aba ARTE:', abaArte);

    const ws = wb.Sheets[abaArte];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    console.log('Todas as linhas da aba ARTE:');
    for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        if (row && row.some(v => v !== null)) {
            console.log(`L${i + 1}:`, JSON.stringify(row.slice(0, 8)));
        }
    }
}
main();
