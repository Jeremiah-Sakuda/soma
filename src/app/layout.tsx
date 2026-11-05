import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geist = Geist({ subsets: ['latin'], display: 'swap', variable: '--font-geist' });
const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Soma — an explanation you can explore',
  description:
    'Turn selected screenshots and questions into visual explanations you can explore, change and revisit.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The Mac companion marks <html> (data-soma-desktop) before hydration; that one element differs by design.
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
