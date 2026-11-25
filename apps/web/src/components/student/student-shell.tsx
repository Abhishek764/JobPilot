'use client';

import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Home' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/applications', label: 'Applications' },
  { href: '/resume', label: 'Resume Lab' },
  { href: '/settings', label: 'Settings' },
] as const;

const isActive = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export const StudentShell = ({
  displayName,
  children,
}: {
  displayName: string;
  children: React.ReactNode;
}) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [pathname]);

  const links = NAV.map((item) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'ease-spring rounded-full px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-300',
          active
            ? 'text-foreground bg-white/[0.14] shadow-[inset_0_1px_0_hsl(0_0%_100%/0.18)]'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.07]',
        )}
      >
        {item.label}
      </Link>
    );
  });

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="glass-strong sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      {/* Floating glass bar, inset from the edges like macOS/iOS toolbars. */}
      <header className="sticky top-3 z-40 px-3">
        <div className="glass-strong container flex h-14 items-center gap-6 rounded-full px-3 sm:px-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 pl-1 font-semibold tracking-tight"
          >
            <span
              aria-hidden
              className="bg-primary text-primary-foreground grid h-8 w-8 place-items-center rounded-full text-xs font-bold shadow-[inset_0_1px_0_hsl(0_0%_100%/0.3)]"
            >
              JP
            </span>
            JobPilot
          </Link>
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {links}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">{displayName}</span>
            <UserButton />
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20 md:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((v) => !v)}
            >
              <span aria-hidden className="text-lg leading-none">
                {open ? '×' : '≡'}
              </span>
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            aria-label="Primary"
            className="glass-strong rise-in container mt-2 flex flex-col gap-1 rounded-3xl p-2 md:hidden"
          >
            {links}
          </nav>
        )}
      </header>
      <main id="main" className="rise-in container py-10">
        {children}
      </main>
    </div>
  );
};
