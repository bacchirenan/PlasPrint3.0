const fs = require('fs');
const xlsx = require('xlsx');

async function main() {
    const GITHUB_TOKEN = (() => {
        try {
            const env = fs.readFileSync('.env.local', 'utf-8');
            for (const line of env.split('\n')) {
                if (line.startsWith('GITHUB_TOKEN=')) return line.split('=')[1].trim();
            }
        } catch (e) { }
        return '';
    })();

    const REPO = 'bacchirenan/PlasPrint3.0';
    const BRANCH = 'main';

    // Busca via API do GitHub (retorna base64)
    const url = `https://api.github.com/repos/${REPO}/contents/Canudos.xlsx?ref=${BRANCH}`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.json'
        }
    });
    const json = await res.json();

    if (!json.content) {
        console.error('Sem content:', json);
        return;
    }

    const buffer = Buffer.from(json.content, 'base64');
    const wb = xlsx.read(buffer, { type: 'buffer', cellDates: false });
    console.log('Abas:', wb.SheetNames);

    const abaArte = wb.SheetNames.find(n => n.toUpperCase().includes('ARTE') || n.toUpperCase().includes('DECORA')) || wb.SheetNames[1];
    console.log('Aba ARTE:', abaArte);

    const ws = wb.Sheets[abaArte];
    const raw = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null });

    console.log('Todas as linhas NON-NULL da aba ARTE:');
    for (let i = 0; i < raw.length; i++) {
        const row = raw[i];
        if (row && row.some(v => v !== null && v !== '')) {
            console.log(`L${i + 1}:`, JSON.stringify(row.slice(0, 8)));
        }
    }
}
main();
