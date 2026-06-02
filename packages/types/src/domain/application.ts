export const APPLICATION_STATUSES = [
  'SAVED',
  'APPLIED',
  'OA',
  'SCREEN',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
  'WITHDRAWN',
  'GHOSTED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Ordered columns rendered on the Kanban board (left → right). */
export const BOARD_COLUMNS = [
  'SAVED',
  'APPLIED',
  'OA',
  'INTERVIEW',
  'OFFER',
  'REJECTED',
] as const satisfies readonly ApplicationStatus[];

export type BoardColumnStatus = (typeof BOARD_COLUMNS)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  SAVED: 'Saved',
  APPLIED: 'Applied',
  OA: 'OA received',
  SCREEN: 'Screen',
  INTERVIEW: 'Interview scheduled',
  OFFER: 'Offer received',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
  GHOSTED: 'Ghosted',
};

export const APPLICATION_EVENT_TYPES = [
  'CREATED',
  'STATUS_CHANGED',
  'MOVED',
  'UPDATED',
  'NOTE_ADDED',
  'NOTE_UPDATED',
  'NOTE_DELETED',
  'REMINDER_ADDED',
  'REMINDER_COMPLETED',
  'REMINDER_DELETED',
] as const;

export type ApplicationEventType = (typeof APPLICATION_EVENT_TYPES)[number];

export const REMINDER_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export interface Application {
  id: string;
  userId: string;
  jobId: string | null;
  company: string;
  title: string;
  location: string | null;
  status: ApplicationStatus;
  position: number;
  appliedAt: Date | null;
  notes: string | null;
  source: string | null;
  url: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  type: ApplicationEventType;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ApplicationNote {
  id: string;
  applicationId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Reminder {
  id: string;
  applicationId: string;
  title: string;
  dueAt: Date;
  status: ReminderStatus;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A single Kanban column with its applications, ordered by `position`. */
export interface BoardColumn {
  status: BoardColumnStatus;
  total: number;
  items: Application[];
}

export interface Board {
  columns: BoardColumn[];
}

/** Realtime event names emitted over Socket.IO to a user's room. */
export const REALTIME_EVENTS = [
  'application.created',
  'application.updated',
  'application.moved',
  'application.deleted',
  'reminder.changed',
] as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[number];
