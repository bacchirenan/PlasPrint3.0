const fs = require('fs');
const xlsx = require('xlsx');

async function main() {
    // Tenta diferentes caminhos possíveis no repo PlasPrint3.0
    const GITHUB_TOKEN = (() => {
        try {
            const env = fs.readFileSync('.env.local', 'utf-8');
            for (const line of env.split('\n')) {
                if (line.startsWith('GITHUB_TOKEN=')) return line.split('=')[1].trim();
            }
        } catch (e) { }
        return '';
    })();

    const paths = ['db/Canudos.xlsx', 'Canudos.xlsx', 'db/canudos.xlsx', 'data/Canudos.xlsx'];
    const REPO = 'bacchirenan/PlasPrint3.0';
    const BRANCH = 'main';

    for (const p of paths) {
        const url = `https://api.github.com/repos/${REPO}/contents/${p}?ref=${BRANCH}`;
        const res = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3.json'
            }
        });
        console.log(`${p}: ${res.status}`);
    }

    // List db folder
    const url2 = `https://api.github.com/repos/${REPO}/contents/db?ref=${BRANCH}`;
    const res2 = await fetch(url2, {
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3.json'
        }
    });
    const json = await res2.json();
    console.log('Conteúdo da pasta db:', Array.isArray(json) ? json.map(f => f.name) : json);
}
main();
