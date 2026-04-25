import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'SeeWhy Live — Stream Together',
  description: 'Gold-tier live streaming with real-time guest panels, cross-platform fan-out, and zero platform fees on creator tips.',
  openGraph: {
    siteName: 'SeeWhy Live',
    type: 'website',
    url: 'https://seewhylive.online',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main className="min-h-screen pt-16">{children}</main>
      </body>
    </html>
  )
}
