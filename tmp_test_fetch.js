async function run() {
    const res = await fetch('http://localhost:3000/api/ordens');
    const db = await res.json();
    console.log("DB DATA:", db.data.find(x => String(x.os).includes('1428373')));

    const prodRes = await fetch('http://localhost:3000/api/data/producao');
    const prod = await prodRes.json();
    const rows = prod.data.filter(x => String(x.os).includes('1428373'));
    console.log("PROD ROWS:", rows.length);
    const pecas = rows.reduce((acc, x) => acc + x.pecas_boas, 0);
    console.log("PECAS BOAS PROD:", pecas);
}
run();
