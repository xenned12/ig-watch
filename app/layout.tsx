import type { Metadata } from 'next';
import { Fira_Sans, Fira_Code } from 'next/font/google';
import './globals.css';
import { ToastProvider } from './_components/Toast';

const firaSans = Fira_Sans({ weight: ['400', '500', '600'], subsets: ['latin'], variable: '--font-fira-sans', display: 'swap' });
const firaCode = Fira_Code({ weight: ['400', '500'], subsets: ['latin'], variable: '--font-fira-code', display: 'swap' });

export const metadata: Metadata = {
  title: 'Reel Intel',
  description: 'Competitor reel analysis for Instagram creators.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${firaSans.variable} ${firaCode.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
