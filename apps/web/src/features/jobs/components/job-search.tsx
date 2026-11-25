'use client';

import { SOURCE_PLATFORMS, type SourcePlatform } from '@jobpilot/types';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import type { JobFilters } from '../api';
import { platformLabel } from '../format';
import { useJobs } from '../hooks';

import { JobCard } from './job-card';

const PAGE_SIZE = 20;

const readFilters = (sp: URLSearchParams): JobFilters => {
  const platform = sp.get('platform');
  const remote = sp.get('remote');
  const page = Number(sp.get('page') ?? '1');
  return {
    q: sp.get('q') ?? undefined,
    platform: SOURCE_PLATFORMS.includes(platform as SourcePlatform)
      ? (platform as SourcePlatform)
      : undefined,
    location: sp.get('location') ?? undefined,
    remote: remote === 'true' ? true : undefined,
    page: Number.isFinite(page) && page > 1 ? page : 1,
    pageSize: PAGE_SIZE,
  };
};

export const JobSearch = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => readFilters(new URLSearchParams(searchParams)), [searchParams]);

  // Latest URL filters, read by the debounced effect without re-arming its timer.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const [q, setQ] = useState(filters.q ?? '');
  const [location, setLocation] = useState(filters.location ?? '');

  const update = (patch: Partial<JobFilters>) => {
    const next = { ...filtersRef.current, ...patch };
    const sp = new URLSearchParams();
    if (next.q?.trim()) sp.set('q', next.q.trim());
    if (next.platform) sp.set('platform', next.platform);
    if (next.location?.trim()) sp.set('location', next.location.trim());
    if (next.remote) sp.set('remote', 'true');
    if (next.page && next.page > 1) sp.set('page', String(next.page));
    const s = sp.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  // Debounce typed text into the URL so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      const current = filtersRef.current;
      if ((current.q ?? '') !== q.trim() || (current.location ?? '') !== location.trim()) {
        update({ q, location, page: 1 });
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, location]);

  const { data, isPending, isError, error, refetch, isFetching } = useJobs(filters);

  return (
    <div className="space-y-6">
      <form
        role="search"
        className="grid gap-3 md:grid-cols-[1fr_200px_180px_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q, location, page: 1 });
        }}
      >
        <label className="sr-only" htmlFor="job-q">
          Search jobs
        </label>
        <Input
          id="job-q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, company or keywords — e.g. “frontend intern”"
          className="h-11 text-base"
          autoComplete="off"
        />
        <label className="sr-only" htmlFor="job-location">
          Location
        </label>
        <Input
          id="job-location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="h-11"
        />
        <label className="sr-only" htmlFor="job-platform">
          Source
        </label>
        <Select
          id="job-platform"
          className="h-11"
          value={filters.platform ?? ''}
          onChange={(e) =>
            update({
              platform: (e.target.value || undefined) as SourcePlatform | undefined,
              page: 1,
            })
          }
        >
          <option value="">All sources</option>
          {SOURCE_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {platformLabel(p)}
            </option>
          ))}
        </Select>
        <label className="border-input flex h-11 items-center gap-2 rounded-md border px-3 text-sm">
          <input
            type="checkbox"
            checked={filters.remote === true}
            onChange={(e) => update({ remote: e.target.checked || undefined, page: 1 })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Remote only
        </label>
      </form>

      <div aria-live="polite" className="text-muted-foreground text-sm">
        {data && !isPending && (
          <span>
            {data.total.toLocaleString()} {data.total === 1 ? 'job' : 'jobs'}
            {isFetching && ' · updating…'}
          </span>
        )}
      </div>

      {isPending ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true" aria-label="Loading jobs">
          {['s1', 's2', 's3', 's4', 's5', 's6'].map((k) => (
            <Skeleton key={k} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/5 p-6 text-sm">
          <p className="font-medium">Couldn’t load jobs.</p>
          <p className="text-muted-foreground mt-1">{error.message}</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <div className="glass rounded-2xl border-dashed p-10 text-center">
          <p className="font-medium">No jobs match these filters.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Try a broader keyword, clear the location, or include all sources. New listings arrive
            every hour.
          </p>
        </div>
      ) : (
        <>
          <div className="stagger grid gap-3 md:grid-cols-2">
            {data.items.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
          {data.totalPages > 1 && (
            <nav className="flex items-center justify-between" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => update({ page: data.page - 1 })}
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-sm">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.totalPages}
                onClick={() => update({ page: data.page + 1 })}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
};
