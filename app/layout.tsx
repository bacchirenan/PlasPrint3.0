import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

const samsungFont = localFont({
  src: '../font.ttf',
  variable: '--font-primary-local',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'PlasPrint IA',
  description: 'Sistema de análise de produção, OEE/TEEP e fichas técnicas da PlasPrint',
  icons: { icon: '/palsprint.png' },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={samsungFont.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
