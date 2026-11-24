export interface DashboardMetrics {
  strongMatches: number;
  activeApplications: number;
  /** Newest completed ResumeAnalysis.overallScore; null when never analyzed. */
  resumeHealth: number | null;
  pendingActions: number;
}

export interface DashboardRecommendedJob {
  id: string;
  title: string;
  company: string;
  location: string | null;
  sourcePlatform: string;
  compatibility: number | null;
  matchId: string | null;
}

export type DashboardAttentionKind = 'REMINDER' | 'PARSING' | 'MATCH';

export interface DashboardAttentionItem {
  kind: DashboardAttentionKind;
  id: string;
  label: string;
  href: string;
}

export interface DashboardSummary {
  metrics: DashboardMetrics;
  recommendedJobs: DashboardRecommendedJob[];
  attentionItems: DashboardAttentionItem[];
}
