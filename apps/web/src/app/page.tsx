import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

import { Button } from '@/components/ui/button';

const FEATURES = [
  {
    title: 'Real openings',
    body: 'Internships and entry-level roles from public job boards, refreshed every hour.',
  },
  {
    title: 'Your fit, explained',
    body: 'See which skills a job needs that your resume shows, and what is missing.',
  },
  {
    title: 'Every application tracked',
    body: 'Notes, reminders and cover letters for each role, on one board.',
  },
];

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-10 py-16">
      <section className="glass-strong rise-in w-full max-w-2xl rounded-[2rem] px-8 py-12 text-center sm:px-14">
        <p className="text-muted-foreground mb-5 inline-block rounded-full bg-white/[0.07] px-3 py-1 text-xs font-medium tracking-wide">
          For students and freshers
        </p>
        <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">JobPilot AI</h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-lg leading-relaxed">
          Find real openings, see how your resume fits each one, and track every application until
          you&apos;re hired.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <Button size="lg">Get started</Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Button size="lg" asChild>
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <UserButton />
          </Show>
        </div>
      </section>

      <ul className="grid w-full max-w-4xl gap-3 sm:grid-cols-3">
        {FEATURES.map((f, i) => (
          <li
            key={f.title}
            className="glass rise-in rounded-2xl p-5"
            style={{ animationDelay: `${120 + i * 90}ms` }}
          >
            <h2 className="text-sm font-semibold">{f.title}</h2>
            <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{f.body}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
