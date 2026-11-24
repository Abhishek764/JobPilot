import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../shared/errors';

const repo = vi.hoisted(() => ({
  findById: vi.fn(),
  maxPosition: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  move: vi.fn(),
  delete: vi.fn(),
  recordEvent: vi.fn(),
  insights: vi.fn(),
}));
const notes = vi.hoisted(() => ({ create: vi.fn() }));
const reminders = vi.hoisted(() => ({ create: vi.fn() }));
const users = vi.hoisted(() => ({ getByClerkId: vi.fn() }));

vi.mock('./application.repository', () => ({ applicationRepository: repo }));
vi.mock('./note.repository', () => ({ noteRepository: notes }));
vi.mock('./reminder.repository', () => ({ reminderRepository: reminders }));
vi.mock('../users/user.service', () => ({ userService: users }));
vi.mock('../../realtime/gateway', () => ({ emitToUser: vi.fn() }));

import { applicationService } from './application.service';
import { noteService } from './note.service';
import { reminderService } from './reminder.service';

const CLERK = 'clerk_1';
const USER = 'user_1';
const owned = { id: 'app_1', userId: USER, status: 'SAVED', position: 1024 };

describe('application workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    users.getByClerkId.mockResolvedValue({ id: USER });
    repo.findById.mockImplementation(async (userId: string, id: string) =>
      userId === USER && id === 'app_1' ? owned : null,
    );
  });

  it('create scopes the row to the user and appends to the column', async () => {
    repo.maxPosition.mockResolvedValue(2048);
    repo.create.mockResolvedValue({ ...owned, events: [] });
    await applicationService.create(CLERK, { company: 'Acme', title: 'Intern', status: 'SAVED' } as never);
    expect(repo.maxPosition).toHaveBeenCalledWith(USER, 'SAVED');
    expect(repo.create).toHaveBeenCalledWith(USER, expect.objectContaining({ company: 'Acme', position: 3072 }));
  });

  it('update records an UPDATED event for an owned application', async () => {
    repo.update.mockResolvedValue({ count: 1 });
    await applicationService.update(CLERK, 'app_1', { notes: 'hi' } as never);
    expect(repo.update).toHaveBeenCalledWith(USER, 'app_1', { notes: 'hi' });
    expect(repo.recordEvent).toHaveBeenCalledWith('app_1', 'UPDATED', { fields: ['notes'] });
  });

  it('update of a foreign application is NotFound and records nothing', async () => {
    repo.update.mockResolvedValue({ count: 0 });
    await expect(applicationService.update(CLERK, 'app_x', { notes: 'x' } as never)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repo.recordEvent).not.toHaveBeenCalled();
  });

  it('move is scoped by user and fails for foreign applications', async () => {
    repo.move.mockResolvedValue(null);
    await expect(
      applicationService.move(CLERK, 'app_x', { status: 'APPLIED', position: 1 } as never),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.move).toHaveBeenCalledWith(USER, 'app_x', 'APPLIED', 1);
  });

  it('status update checks ownership before moving', async () => {
    await expect(applicationService.updateStatus(CLERK, 'app_x', { status: 'OFFER' } as never)).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(repo.move).not.toHaveBeenCalled();
  });

  it('delete is scoped by user', async () => {
    repo.delete.mockResolvedValue({ count: 0 });
    await expect(applicationService.delete(CLERK, 'app_x')).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.delete).toHaveBeenCalledWith(USER, 'app_x');
  });

  it('note creation requires ownership and records NOTE_ADDED', async () => {
    await expect(noteService.create(CLERK, 'app_x', { body: 'x' })).rejects.toBeInstanceOf(NotFoundError);
    expect(notes.create).not.toHaveBeenCalled();

    notes.create.mockResolvedValue({ id: 'note_1' });
    await noteService.create(CLERK, 'app_1', { body: 'Called recruiter' });
    expect(repo.recordEvent).toHaveBeenCalledWith('app_1', 'NOTE_ADDED', { noteId: 'note_1' });
  });

  it('reminder creation requires ownership and records REMINDER_ADDED', async () => {
    const dueAt = new Date('2026-12-01T09:00:00Z');
    await expect(reminderService.create(CLERK, 'app_x', { title: 'x', dueAt })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    reminders.create.mockResolvedValue({ id: 'rem_1', dueAt });
    await reminderService.create(CLERK, 'app_1', { title: 'Follow up', dueAt });
    expect(repo.recordEvent).toHaveBeenCalledWith('app_1', 'REMINDER_ADDED', { reminderId: 'rem_1', dueAt });
  });

  it('insights aggregate persisted counts for the caller only', async () => {
    const now = new Date('2026-11-24T12:00:00Z');
    repo.insights.mockResolvedValue({
      byStatus: [
        { status: 'SAVED', count: 3 },
        { status: 'APPLIED', count: 2 },
      ],
      upcomingReminders: 1,
      recentActivity: [],
    });
    const result = await applicationService.insights(CLERK, now);
    expect(repo.insights).toHaveBeenCalledWith(USER, now);
    expect(result.total).toBe(5);
    expect(result.byStatus.SAVED).toBe(3);
    expect(result.byStatus.APPLIED).toBe(2);
    expect(result.byStatus.OFFER).toBe(0);
    expect(result.upcomingReminders).toBe(1);
  });
});
