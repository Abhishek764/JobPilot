'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/** Recovery UI for student routes; renders inside the shell so navigation stays available. */
export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto max-w-lg space-y-4 rounded-xl border border-red-500/40 bg-red-500/5 p-8 text-center"
    >
      <h1 className="text-xl font-semibold">This page couldn’t load</h1>
      <p className="text-muted-foreground text-sm">
        {error.message || 'Unexpected error.'}
        {error.digest ? ` (ref: ${error.digest})` : null}
      </p>
      <div className="flex justify-center gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
