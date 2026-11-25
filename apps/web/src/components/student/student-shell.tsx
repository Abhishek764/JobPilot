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
          'rounded-md px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'bg-primary/15 text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
        className="focus:bg-card sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
        <div className="container flex h-16 items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              aria-hidden
              className="from-primary to-accent text-primary-foreground grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br text-sm font-bold"
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
              className="border-border inline-flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
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
            className="container flex flex-col gap-1 pb-4 md:hidden"
          >
            {links}
          </nav>
        )}
      </header>
      <main id="main" className="container py-8">
        {children}
      </main>
    </div>
  );
};
