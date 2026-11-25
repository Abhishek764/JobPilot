import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Backdrop } from '@/components/backdrop';
import { QueryProvider } from '@/components/providers/query-provider';

/** Clerk's sign-in, sign-up and account menus in the same frosted glass as the app. */
const clerkAppearance = {
  variables: {
    colorPrimary: 'hsl(214 30% 93%)',
    colorPrimaryForeground: 'hsl(216 30% 9%)',
    colorBackground: 'hsl(216 16% 13% / 0.5)',
    colorForeground: 'hsl(0 0% 97%)',
    colorMutedForeground: 'hsl(214 10% 68%)',
    colorInput: 'hsl(0 0% 100% / 0.06)',
    colorInputForeground: 'hsl(0 0% 97%)',
    colorBorder: 'hsl(0 0% 100% / 0.1)',
    colorNeutral: 'hsl(0 0% 100%)',
    colorRing: 'hsl(212 40% 72%)',
    colorModalBackdrop: 'hsl(216 30% 3% / 0.6)',
    borderRadius: '0.875rem',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", var(--font-inter), system-ui, sans-serif',
  },
  elements: {
    cardBox: 'glass-strong rounded-[1.75rem] shadow-none',
    card: 'bg-transparent shadow-none',
    footer: 'bg-transparent',
    formButtonPrimary: 'rounded-full',
    socialButtonsBlockButton: 'glass-field rounded-full',
    userButtonPopoverCard: 'glass-strong',
  },
};

import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'JobPilot AI',
  description:
    'Search real job listings, check your resume against each one, and track your applications.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" className="dark" suppressHydrationWarning>
        <body className={`${inter.variable} bg-background min-h-screen font-sans antialiased`}>
          <Backdrop />
          <QueryProvider>{children}</QueryProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
