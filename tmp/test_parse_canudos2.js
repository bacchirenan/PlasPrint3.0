const fs = require('fs');
const xlsx = require('xlsx');

// Mock data-parsers logic manually 

function toNum(val) {
    if (val === null || val === undefined) return 0
    if (typeof val === 'number') return val
    const s = String(val).replace(/\./g, '').replace(',', '.').trim()
    const n = parseFloat(s)
    return isNaN(n) ? 0 : n
}

function parseDate(val) {
    if (!val) return null
    if (typeof val === 'number') {
        const date = xlsx.SSF.parse_date_code(val)
        if (date) {
            const d = new Date(Date.UTC(date.y, date.m - 1, date.d))
            return d.toISOString().split('T')[0]
        }
    }
    const s = String(val).trim()
    if (!s) return null
    const parts = s.split('/')
    if (parts.length === 3) {
        const year = parts[2].length === 2 ? '20' + parts[2] : parts[2]
        const d = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    }
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
    return null
}

async function main() {
    const GITHUB_REPO = 'bacchirenan/PlasPrint2.0';
    const GITHUB_BRANCH = 'main';
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/Canudos.xlsx`;
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
    const buffer = Buffer.from(await res.arrayBuffer());
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });

    const wsArt = wb.Sheets['ARTE'];
    const raw = xlsx.utils.sheet_to_json(wsArt, { header: 1, defval: null });

    const result = [];
    let lastDate = '';
    for (let i = 0; i < Math.min(20, raw.length); i++) {
        const row = raw[i]
        if (!row || row.length < 5) continue

        const dateStr = parseDate(row[0])
        if (dateStr) lastDate = dateStr
        if (!lastDate) continue

        const boas = toNum(row[4]) // Col E
        const perdas = toNum(row[5]) // Col F

        console.log(`Row ${i + 1}: Date: ${lastDate}, Boas: ${boas}, Perdas: ${perdas}, Col E: ${row[4]}, Col F: ${row[5]}`);
    }
}
main();
