'use client';

import type { ApplicationEventType } from '@jobpilot/types';
import { STATUS_LABELS } from '@jobpilot/types';
import { Bell, Check, ExternalLink, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CoverLetterPanel } from '@/features/cover-letters/components/cover-letter-panel';

import {
  useApplication,
  useCompleteReminder,
  useCreateNote,
  useCreateReminder,
  useDeleteApplication,
  useDeleteNote,
  useDeleteReminder,
  useEvents,
  useNotes,
  useReminders,
  useSetStatus,
} from '../hooks';

const DRAWER_STATUSES = ['SAVED', 'APPLIED', 'OA', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;

const EVENT_LABELS: Record<ApplicationEventType, string> = {
  CREATED: 'Created',
  STATUS_CHANGED: 'Status changed',
  MOVED: 'Reordered',
  UPDATED: 'Updated',
  NOTE_ADDED: 'Note added',
  NOTE_UPDATED: 'Note edited',
  NOTE_DELETED: 'Note removed',
  REMINDER_ADDED: 'Reminder added',
  REMINDER_COMPLETED: 'Reminder completed',
  REMINDER_DELETED: 'Reminder removed',
};

const fmtDate = (value: string | Date): string =>
  new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const fmtDateTime = (value: string | Date): string =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

interface Props {
  id: string | null;
  onClose: () => void;
}

export const ApplicationDrawer = ({ id, onClose }: Props) => {
  const open = Boolean(id);
  const { data: app } = useApplication(id);
  const events = useEvents(id ?? '', open);
  const notes = useNotes(id ?? '', open);
  const reminders = useReminders(id ?? '', open);

  const setStatus = useSetStatus(id ?? '');
  const removeApp = useDeleteApplication();
  const createNote = useCreateNote(id ?? '');
  const deleteNote = useDeleteNote(id ?? '');
  const createReminder = useCreateReminder(id ?? '');
  const completeReminder = useCompleteReminder(id ?? '');
  const deleteReminder = useDeleteReminder(id ?? '');

  const [noteBody, setNoteBody] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDue, setReminderDue] = useState('');

  const submitNote = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    createNote.mutate(noteBody.trim(), { onSuccess: () => setNoteBody('') });
  };

  const submitReminder = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!reminderTitle.trim() || !reminderDue) return;
    createReminder.mutate(
      { title: reminderTitle.trim(), dueAt: new Date(reminderDue).toISOString() },
      {
        onSuccess: () => {
          setReminderTitle('');
          setReminderDue('');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent side="right" className="flex flex-col gap-6">
        {app ? (
          <>
            <header className="space-y-2 pr-6">
              <DialogTitle className="text-xl">{app.title}</DialogTitle>
              <p className="text-sm text-muted-foreground">{app.company}</p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  value={app.status}
                  onChange={(e) => setStatus.mutate(e.target.value)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                >
                  {DRAWER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                {app.url ? (
                  <a
                    href={app.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" /> Posting
                  </a>
                ) : null}
              </div>
              <dl className="grid grid-cols-2 gap-2 pt-2 text-xs">
                {app.location ? (
                  <div>
                    <dt className="text-muted-foreground">Location</dt>
                    <dd>{app.location}</dd>
                  </div>
                ) : null}
                {app.source ? (
                  <div>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd>{app.source}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground">Added</dt>
                  <dd>{fmtDate(app.createdAt)}</dd>
                </div>
                {app.appliedAt ? (
                  <div>
                    <dt className="text-muted-foreground">Applied</dt>
                    <dd>{fmtDate(app.appliedAt)}</dd>
                  </div>
                ) : null}
              </dl>
            </header>

            {/* Cover letter */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Cover letter</h3>
              <CoverLetterPanel jobId={app.jobId} />
            </section>

            {/* Reminders */}
            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Bell className="h-4 w-4" /> Reminders
              </h3>
              <form onSubmit={submitReminder} className="flex flex-wrap items-center gap-2">
                <Input
                  value={reminderTitle}
                  onChange={(e) => setReminderTitle(e.target.value)}
                  placeholder="Follow up…"
                  className="h-8 flex-1"
                />
                <Input
                  type="datetime-local"
                  value={reminderDue}
                  onChange={(e) => setReminderDue(e.target.value)}
                  className="h-8 w-44"
                />
                <Button type="submit" size="sm" variant="outline" loading={createReminder.isPending}>
                  Add
                </Button>
              </form>
              <ul className="space-y-1.5">
                {reminders.data?.map((r) => {
                  const overdue = r.status === 'PENDING' && new Date(r.dueAt) < new Date();
                  return (
                    <li
                      key={r.id}
                      className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs"
                    >
                      <div className={r.status === 'COMPLETED' ? 'text-muted-foreground line-through' : ''}>
                        <p className="font-medium">{r.title}</p>
                        <p className={overdue ? 'text-red-600' : 'text-muted-foreground'}>
                          {fmtDateTime(r.dueAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {r.status === 'PENDING' ? (
                          <button
                            onClick={() => completeReminder.mutate(r.id)}
                            className="rounded p-1 text-muted-foreground hover:text-emerald-600"
                            aria-label="Complete reminder"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => deleteReminder.mutate(r.id)}
                          className="rounded p-1 text-muted-foreground hover:text-red-600"
                          aria-label="Delete reminder"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
                {reminders.data?.length === 0 ? (
                  <li className="text-xs text-muted-foreground">No reminders.</li>
                ) : null}
              </ul>
            </section>

            {/* Notes */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Notes</h3>
              <form onSubmit={submitNote} className="space-y-2">
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="outline" loading={createNote.isPending}>
                    Save note
                  </Button>
                </div>
              </form>
              <ul className="space-y-2">
                {notes.data?.map((n) => (
                  <li key={n.id} className="rounded-md border p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="whitespace-pre-wrap">{n.body}</p>
                      <button
                        onClick={() => deleteNote.mutate(n.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-600"
                        aria-label="Delete note"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">{fmtDateTime(n.createdAt)}</p>
                  </li>
                ))}
                {notes.data?.length === 0 ? (
                  <li className="text-xs text-muted-foreground">No notes yet.</li>
                ) : null}
              </ul>
            </section>

            {/* Activity */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Activity</h3>
              <ul className="space-y-1.5 border-l pl-3">
                {events.data?.items.map((ev) => (
                  <li key={ev.id} className="text-xs">
                    <span className="font-medium">{EVENT_LABELS[ev.type]}</span>
                    <span className="text-muted-foreground"> · {fmtDateTime(ev.createdAt)}</span>
                  </li>
                ))}
                {events.data?.items.length === 0 ? (
                  <li className="text-xs text-muted-foreground">No activity.</li>
                ) : null}
              </ul>
            </section>

            <footer className="mt-auto border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                loading={removeApp.isPending}
                onClick={() => removeApp.mutate(app.id, { onSuccess: onClose })}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete application
              </Button>
            </footer>
          </>
        ) : (
          <DialogTitle className="text-sm text-muted-foreground">Loading…</DialogTitle>
        )}
      </DialogContent>
    </Dialog>
  );
};
