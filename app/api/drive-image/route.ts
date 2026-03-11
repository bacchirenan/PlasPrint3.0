import { NextResponse } from 'next/server'

/**
 * Proxy de imagens do Google Drive.
 * Uso: /api/drive-image?id=FILE_ID
 * 
 * A imagem é buscada server-side (sem CORS) e repassada ao browser.
 * Funciona desde que o arquivo esteja compartilhado como "Qualquer pessoa com o link".
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const fileId = searchParams.get('id')

    if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
        return NextResponse.json({ error: 'ID de arquivo inválido' }, { status: 400 })
    }

    // Tentativas de URL em ordem: thumbnail direto, export como imagem
    const urlsToTry = [
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w900`,
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/uc?export=view&id=${fileId}`,
    ]

    for (const url of urlsToTry) {
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/*,*/*',
                    'Referer': 'https://drive.google.com/',
                },
                redirect: 'follow',
            })

            const contentType = res.headers.get('content-type') || ''

            // Se retornou HTML = página de login, tenta próxima URL
            if (!res.ok || contentType.includes('text/html')) {
                console.warn(`[DriveProxy] ${url.substring(0, 60)}... → ${res.status} ${contentType}`)
                continue
            }

            const buffer = await res.arrayBuffer()

            // Determina o Content-Type correto
            const finalType = contentType.startsWith('image/') ? contentType : 'image/jpeg'

            console.log(`[DriveProxy] OK: ${url.substring(0, 60)}... (${Math.round(buffer.byteLength / 1024)} KB)`)

            return new Response(buffer, {
                status: 200,
                headers: {
                    'Content-Type': finalType,
                    'Cache-Control': 'public, max-age=3600', // cache de 1 hora no browser
                    'X-Drive-File-Id': fileId,
                },
            })
        } catch (e: any) {
            console.warn(`[DriveProxy] Erro em ${url.substring(0, 60)}: ${e.message}`)
            continue
        }
    }

    // Se nenhuma URL funcionou, retorna uma imagem SVG de erro amigável
    const svgFallback = `
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <rect width="400" height="200" fill="#0d1e38" rx="12"/>
  <text x="200" y="80" text-anchor="middle" font-family="sans-serif" font-size="32" fill="#3b82f6">🖼️</text>
  <text x="200" y="115" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#5b7fa6">Imagem não acessível</text>
  <text x="200" y="138" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#2d4a6b">Verifique se o arquivo é público no Drive</text>
</svg>`

    return new Response(svgFallback, {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
    })
}
