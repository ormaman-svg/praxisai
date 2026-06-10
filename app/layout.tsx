import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'praxisAI — פלטפורמת AI לפיזיותרפיה',
  description: 'Hebrew-first AI clinical platform for physiotherapy clinics',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600&family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#f8fafc] text-[#0f172a] antialiased">{children}</body>
    </html>
  )
}
