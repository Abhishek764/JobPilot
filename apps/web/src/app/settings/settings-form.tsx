'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { EXPERIENCE_LEVELS } from '@jobpilot/types';
import { UpdateProfileSchema, type UpdateProfileInput } from '@jobpilot/types/schemas';
import { useTransition, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';

import { updateProfileAction } from '../onboarding/actions';

interface Props {
  defaults: UpdateProfileInput;
}

export const SettingsForm = ({ defaults }: Props) => {
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    mode: 'onBlur',
    defaultValues: defaults,
  });

  const errors = form.formState.errors;

  const onSubmit = (values: UpdateProfileInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = await updateProfileAction(values);
      if (res.success) {
        setSavedAt(new Date());
      } else {
        setServerError(res.error);
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input id="name" aria-invalid={!!errors.name} {...form.register('name')} />
        </Field>
        <Field label="Location" htmlFor="location" error={errors.location?.message}>
          <Input id="location" aria-invalid={!!errors.location} {...form.register('location')} />
        </Field>
      </div>

      <Field label="Experience level" htmlFor="experienceLevel" error={errors.experienceLevel?.message}>
        <Select id="experienceLevel" aria-invalid={!!errors.experienceLevel} {...form.register('experienceLevel')}>
          {EXPERIENCE_LEVELS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Bio" htmlFor="bio" error={errors.bio?.message}>
        <Textarea id="bio" rows={4} aria-invalid={!!errors.bio} {...form.register('bio')} />
      </Field>

      <Field label="Skills" htmlFor="skills" hint="Enter or comma to add." error={errors.skills?.message as string}>
        <Controller
          control={form.control}
          name="skills"
          render={({ field }) => (
            <TagInput id="skills" value={field.value ?? []} onChange={field.onChange} ariaInvalid={!!errors.skills} />
          )}
        />
      </Field>

      <Field
        label="Preferred roles"
        htmlFor="preferredRoles"
        error={errors.preferredRoles?.message as string}
      >
        <Controller
          control={form.control}
          name="preferredRoles"
          render={({ field }) => (
            <TagInput
              id="preferredRoles"
              value={field.value ?? []}
              onChange={field.onChange}
              ariaInvalid={!!errors.preferredRoles}
            />
          )}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Resume URL" htmlFor="resumeUrl" error={errors.resumeUrl?.message as string}>
          <Input id="resumeUrl" type="url" aria-invalid={!!errors.resumeUrl} {...form.register('resumeUrl')} />
        </Field>
        <Field label="GitHub URL" htmlFor="githubUrl" error={errors.githubUrl?.message as string}>
          <Input id="githubUrl" type="url" aria-invalid={!!errors.githubUrl} {...form.register('githubUrl')} />
        </Field>
        <Field label="LinkedIn URL" htmlFor="linkedinUrl" error={errors.linkedinUrl?.message as string}>
          <Input id="linkedinUrl" type="url" aria-invalid={!!errors.linkedinUrl} {...form.register('linkedinUrl')} />
        </Field>
      </div>

      {serverError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {savedAt ? `Saved at ${savedAt.toLocaleTimeString()}` : ''}
        </p>
        <Button type="submit" loading={pending} disabled={!form.formState.isDirty}>
          Save changes
        </Button>
      </div>
    </form>
  );
};
