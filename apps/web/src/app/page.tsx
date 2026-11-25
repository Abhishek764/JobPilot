import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-8 py-16">
      <div className="max-w-2xl space-y-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">JobPilot AI</h1>
        <p className="text-muted-foreground text-lg">
          Find real openings, see how your resume fits each one, and track every application until
          you&apos;re hired.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="bg-primary text-primary-foreground rounded-md px-6 py-2 hover:opacity-90">
              Get started
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <Link
            href="/dashboard"
            className="bg-primary text-primary-foreground rounded-md px-6 py-2 hover:opacity-90"
          >
            Go to dashboard
          </Link>
          <UserButton />
        </Show>
      </div>
    </main>
  );
}
