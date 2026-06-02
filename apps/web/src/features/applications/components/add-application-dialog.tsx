'use client';

import { STATUS_LABELS } from '@jobpilot/types';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

import { useCreateApplication } from '../hooks';

const CREATE_STATUSES = ['SAVED', 'APPLIED', 'OA', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;

export const AddApplicationDialog = () => {
  const [open, setOpen] = useState(false);
  const create = useCreateApplication();
  const [form, setForm] = useState({ company: '', title: '', location: '', url: '', status: 'SAVED' });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company.trim() || !form.title.trim()) return;
    create.mutate(
      {
        company: form.company.trim(),
        title: form.title.trim(),
        location: form.location.trim() || null,
        url: form.url.trim() || null,
        status: form.status as never,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ company: '', title: '', location: '', url: '', status: 'SAVED' });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Add application
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add application</DialogTitle>
          <DialogDescription>Track a new opportunity on your board.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Company" htmlFor="company" required>
            <Input id="company" value={form.company} onChange={set('company')} required />
          </Field>
          <Field label="Role" htmlFor="title" required>
            <Input id="title" value={form.title} onChange={set('title')} required />
          </Field>
          <Field label="Location" htmlFor="location">
            <Input id="location" value={form.location} onChange={set('location')} />
          </Field>
          <Field label="Job URL" htmlFor="url">
            <Input id="url" type="url" value={form.url} onChange={set('url')} placeholder="https://" />
          </Field>
          <Field label="Status" htmlFor="status">
            <select
              id="status"
              value={form.status}
              onChange={set('status')}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {CREATE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          {create.isError ? (
            <p className="text-sm text-red-600">Could not create application.</p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
