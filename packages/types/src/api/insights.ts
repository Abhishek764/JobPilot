import type { ApplicationStatus } from '../domain/application';

export interface ApplicationActivity {
  id: string;
  type: string;
  createdAt: string | Date;
  applicationId: string;
  company: string;
  title: string;
}

export interface ApplicationInsights {
  total: number;
  byStatus: Record<ApplicationStatus, number>;
  /** PENDING reminders due within the next 7 days, including overdue ones. */
  upcomingReminders: number;
  recentActivity: ApplicationActivity[];
}
