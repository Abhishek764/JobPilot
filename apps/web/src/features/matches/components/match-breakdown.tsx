import { cn } from '@/lib/utils';

import type { MatchAnalysis, MatchBreakdown as Breakdown } from '../api';

const DIMENSIONS: { key: keyof Breakdown; label: string; hint: string }[] = [
  { key: 'coreSkills', label: 'Core skills', hint: 'Skills the role needs that your resume shows' },
  { key: 'experience', label: 'Experience', hint: 'Depth and scope of relevant work' },
  { key: 'projects', label: 'Projects', hint: 'Evidence from projects you built' },
  {
    key: 'jobAlignment',
    label: 'Job alignment',
    hint: 'How closely your focus matches this posting',
  },
];

const tone = (n: number) => (n >= 80 ? 'bg-emerald-400' : n >= 60 ? 'bg-amber-300' : 'bg-rose-300');

const Score = ({ label, value }: { label: string; value: number | null }) => (
  <div className="border-border rounded-lg border p-3 text-center">
    <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
    <p className="mt-1 text-3xl font-semibold tabular-nums">{value ?? '—'}</p>
  </div>
);

const List = ({ title, items, empty }: { title: string; items: string[]; empty: string }) => (
  <div className="space-y-1.5">
    <h4 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</h4>
    {items.length === 0 ? (
      <p className="text-muted-foreground text-sm">{empty}</p>
    ) : (
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((s, i) => (
          // AI lists can repeat an item; position keeps keys unique.
          <li key={`${i}-${s}`}>{s}</li>
        ))}
      </ul>
    )}
  </div>
);

/** Evidence-first view of a completed match: scores, why, gaps, and what to do next. */
export const MatchBreakdown = ({ match }: { match: MatchAnalysis }) => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-2">
      <Score label="Fit score" value={match.compatibility} />
      <Score label="Interview readiness" value={match.readiness} />
    </div>

    {match.rawResult?.summary && (
      <p className="text-sm leading-relaxed">{match.rawResult.summary}</p>
    )}

    {match.breakdown && (
      <div className="space-y-2.5" aria-label="Score breakdown">
        {DIMENSIONS.map(({ key, label, hint }) => {
          const raw = Number(match.breakdown?.[key]);
          const value = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
          return (
            <div key={key} title={hint}>
              <div className="flex justify-between text-xs">
                <span>{label}</span>
                <span className="text-muted-foreground tabular-nums">{value}</span>
              </div>
              <div
                className="bg-muted mt-1 h-1.5 rounded-full"
                role="meter"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
              >
                <div
                  className={cn('h-full rounded-full', tone(value))}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    )}

    <List title="Strengths (from your resume)" items={match.strengths} empty="None identified." />
    <List title="Missing or weak skills" items={match.missingSkills} empty="No major gaps found." />
    <List title="Suggested next steps" items={match.suggestions} empty="No suggestions." />

    <p className="text-muted-foreground text-xs">
      AI estimate from your resume text and this job description only — not a hiring decision.
      {match.completedAt && ` Analyzed ${new Date(match.completedAt).toLocaleString()}`}
      {match.model && ` · ${match.model}`}
      {match.cacheHit && ' · cached'}
    </p>
  </div>
);
