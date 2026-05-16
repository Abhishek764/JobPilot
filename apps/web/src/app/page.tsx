import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-8 py-16">
      <div className="space-y-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">JobPilot AI</h1>
        <p className="text-lg text-muted-foreground">
          Track applications. Match resumes. Land offers — with AI.
        </p>
      </div>
      <div className="flex items-center gap-4">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:opacity-90">
              Get started
            </button>
          </SignInButton>
        </SignedOut>
        <SignedIn>
          <Link
            href="/dashboard"
            className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:opacity-90"
          >
            Go to dashboard
          </Link>
          <UserButton />
        </SignedIn>
      </div>
    </main>
  );
}
