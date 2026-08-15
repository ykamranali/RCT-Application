import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { BRANDING } from '@rct/types';

import { ThemeProvider } from '@/components/shell/theme-provider';
import { ServiceWorkerRegistrar } from '@/components/shell/service-worker';
import { Toaster } from '@/components/ui/toaster';

import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: `${BRANDING.applicationName} — ${BRANDING.tagline}`,
    template: `%s · ${BRANDING.applicationName}`,
  },
  description: `Customer complaint, IT service desk and AMC management for ${BRANDING.companyName}.`,
  applicationName: BRANDING.applicationName,
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: BRANDING.shortName },
  formatDetection: { telephone: false },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">
        {/* Keyboard users land here first. */}
        <a
          href="#main"
          className="sr-only-focusable fixed left-3 top-3 z-[100] rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Skip to content
        </a>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          <Toaster />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
