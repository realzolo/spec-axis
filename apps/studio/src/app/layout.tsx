import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { getLocale } from '@/lib/locale';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { cookies } from 'next/headers';

const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  title: 'Sykra',
  description: 'Sykra app',
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
  const cookieStore = await cookies();
  const storedTheme = cookieStore.get('theme')?.value;
  const initialTheme = storedTheme === 'light' || storedTheme === 'dark' ? storedTheme : 'dark';

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}${initialTheme === 'dark' ? ' dark' : ''}`}
      data-theme={initialTheme}
    >
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers defaultTheme={initialTheme}>{children}</Providers>
      </body>
    </html>
  );
}
