import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { Providers } from './providers';
import { getLocale } from '@/lib/locale';

export const metadata: Metadata = {
  title: 'Nexaly',
  description: 'Nexaly app',
  icons: {
    icon: '/icon.svg',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning className="dark" data-theme="dark">
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
  try {
    const stored = window.localStorage.getItem('theme');
    const theme = stored === 'light' || stored === 'dark' ? stored : 'dark';
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');
  } catch {}
})();`}
        </Script>
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
