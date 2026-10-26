import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Soma — your next study session, ready',
  description: 'Explore interactive lessons prepared from changing coursework, and keep an honest record of what you learn.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
