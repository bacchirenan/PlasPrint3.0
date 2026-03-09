/**
 * github-data.ts
 * Funções para buscar os arquivos de dados (.xlsx, .db) diretamente do GitHub.
 * O repositório bacchirenan/PlasPrint2.0 contém os arquivos atualizados pelo script local.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_REPO = process.env.GITHUB_REPO || 'bacchirenan/PlasPrint3.0'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'

/**
 * Busca o conteúdo em bytes de um arquivo do repositório GitHub via API.
 * Usa cache de 5 minutos no Next.js (revalidate: 300).
 */
export async function fetchFileFromGitHub(filePath: string): Promise<Buffer> {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodeURIComponent(filePath)}`

    const headers: HeadersInit = {
        'Cache-Control': 'no-cache',
    }

    if (GITHUB_TOKEN) {
        headers['Authorization'] = `token ${GITHUB_TOKEN}`
    }

    const res = await fetch(url, {
        headers,
        next: { revalidate: 300 }, // 5 minutos de cache
    })

    if (!res.ok) {
        throw new Error(
            `Erro ao buscar ${filePath} do GitHub: ${res.status} ${res.statusText}`
        )
    }

    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
}

/**
 * Busca um arquivo XLSX do GitHub e retorna como ArrayBuffer para o xlsx parser.
 */
export async function fetchXlsxFromGitHub(filePath: string): Promise<ArrayBuffer> {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodeURIComponent(filePath)}?v=${Date.now()}`

    const headers: HeadersInit = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
    }
    if (GITHUB_TOKEN) {
        headers['Authorization'] = `token ${GITHUB_TOKEN}`
    }

    const res = await fetch(url, {
        headers,
        cache: 'no-store',
        next: { revalidate: 0 },
    })

    if (!res.ok) {
        throw new Error(
            `Erro ao buscar ${filePath} do GitHub: ${res.status} ${res.statusText}`
        )
    }

    return res.arrayBuffer()
}

/**
 * Busca um arquivo SQLite (.db) do GitHub como Buffer.
 * Como o .db pode ser grande, usamos cache de 10 minutos.
 */
export async function fetchSqliteFromGitHub(filePath: string): Promise<Buffer> {
    const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodeURIComponent(filePath)}?v=${Date.now()}`

    const headers: HeadersInit = {}
    if (GITHUB_TOKEN) {
        headers['Authorization'] = `token ${GITHUB_TOKEN}`
    }

    const res = await fetch(url, {
        headers,
        next: { revalidate: 600 }, // 10 minutos para .db
    })

    if (!res.ok) {
        throw new Error(
            `Erro ao buscar banco de dados ${filePath} do GitHub: ${res.status} ${res.statusText}`
        )
    }

    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
}
