import Link from 'next/link';

import { ResumeMatches } from '@/features/matches/components/resume-matches';
import { ResumeDetailView } from '@/features/resumes/components/resume-detail';

export default async function ResumeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <Link href="/resume" className="text-sm text-muted-foreground hover:text-foreground">
        ← Resume Lab
      </Link>
      <ResumeDetailView id={id}>
        <ResumeMatches resumeId={id} />
      </ResumeDetailView>
    </div>
  );
}
