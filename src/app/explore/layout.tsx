import { Fragment_Mono, Kalam, Work_Sans, Young_Serif } from 'next/font/google';

// The journal faces load only for the exploration surface; course routes keep Geist.
const serif = Young_Serif({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-journal-serif',
});
const sans = Work_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-journal-sans' });
const hand = Kalam({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-journal-hand',
});
const mono = Fragment_Mono({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-journal-mono',
});

export default function ExploreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${serif.variable} ${sans.variable} ${hand.variable} ${mono.variable}`}>
      {children}
    </div>
  );
}
