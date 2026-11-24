'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ResumeStatusBadge } from '@/features/resumes/components/resume-status';
import { ResumeUploader } from '@/features/resumes/components/resume-uploader';
import { useResumes } from '@/features/resumes/hooks';

export default function ResumeLabPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useResumes();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Resume Lab</h1>
        <p className="text-sm text-muted-foreground">
          Upload your resume once, then check it against any job to see real strengths and gaps.
        </p>
      </header>

      <ResumeUploader />

      <section aria-labelledby="resumes-h" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="resumes-h" className="text-lg font-semibold tracking-tight">
            Your resumes
          </h2>
          <Button variant="ghost" size="sm" loading={isFetching && !isPending} onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>

        {isPending ? (
          <div className="space-y-2" aria-busy="true">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/5 p-6 text-sm">
            <p className="font-medium">Couldn’t load your resumes.</p>
            <p className="mt-1 text-muted-foreground">{error.message}</p>
            <Button className="mt-4" size="sm" variant="outline" onClick={() => void refetch()}>
              Try again
            </Button>
          </div>
        ) : data.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No resumes yet. Upload a PDF above to get started.
          </div>
        ) : (
          <ul className="space-y-2">
            {data.items.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/resume/${r.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 p-4 transition-colors hover:border-primary/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {new Date(r.createdAt).toLocaleDateString()}
                      {r.parsedSkills.length > 0 && ` · ${r.parsedSkills.length} skills found`}
                    </p>
                  </div>
                  <ResumeStatusBadge status={r.fileStatus} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
