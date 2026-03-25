import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from './providers'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'RedirectMaster AI — SEO URL Migration Tool',
  description:
    'Automate URL redirect mapping for SEO migrations. Match, validate, and export redirect rules in CSV, JSON, Apache, or Nginx format.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <QueryProvider>
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: '"IBM Plex Sans", sans-serif',
              },
            }}
          />
        </QueryProvider>
      </body>
    </html>
  )
}
