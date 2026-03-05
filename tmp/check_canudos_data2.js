const fs = require('fs');
const xlsx = require('xlsx');

const GITHUB_REPO = 'bacchirenan/PlasPrint2.0';
const GITHUB_BRANCH = 'main';

async function main() {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/Canudos.xlsx`;
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
    const buffer = Buffer.from(await res.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });

    const wsEnc = wb.Sheets['ENCABEÇAMENTO'];
    const rawEnc = xlsx.utils.sheet_to_json(wsEnc, { header: 1, defval: null });

    console.log('ENCABEÇAMENTO:');
    for (let i = 0; i < Math.min(5, rawEnc.length); i++) console.log(`L${i + 1}:`, rawEnc[i].slice(0, 8));

    const wsArt = wb.Sheets['ARTE'];
    const rawArt = xlsx.utils.sheet_to_json(wsArt, { header: 1, defval: null });

    console.log('\nARTE:');
    for (let i = 0; i < Math.min(5, rawArt.length); i++) console.log(`L${i + 1}:`, rawArt[i].slice(0, 8));
}

main().catch(console.error);
