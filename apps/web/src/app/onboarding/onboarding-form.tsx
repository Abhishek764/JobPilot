'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { EXPERIENCE_LEVELS } from '@jobpilot/types';
import { OnboardingSchema, type OnboardingInput } from '@jobpilot/types/schemas';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTransition, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TagInput } from '@/components/ui/tag-input';
import { Textarea } from '@/components/ui/textarea';

import { submitOnboardingAction } from './actions';

const STEPS = [
  { id: 'basics', title: 'Basics', desc: 'Tell us who you are.' },
  { id: 'experience', title: 'Experience', desc: 'What level are you at?' },
  { id: 'preferences', title: 'Preferences', desc: 'What roles + skills?' },
  { id: 'links', title: 'Links', desc: 'Resume + socials (optional).' },
] as const;

const EXPERIENCE_LABELS: Record<(typeof EXPERIENCE_LEVELS)[number], string> = {
  INTERN: 'Intern',
  JUNIOR: 'Junior (0–2 yrs)',
  MID: 'Mid (2–5 yrs)',
  SENIOR: 'Senior (5–8 yrs)',
  STAFF: 'Staff (8–12 yrs)',
  PRINCIPAL: 'Principal (12+ yrs)',
  EXECUTIVE: 'Executive',
};

type StepFields = Record<(typeof STEPS)[number]['id'], (keyof OnboardingInput)[]>;
const STEP_FIELDS: StepFields = {
  basics: ['name', 'location'],
  experience: ['experienceLevel', 'bio'],
  preferences: ['skills', 'preferredRoles'],
  links: ['resumeUrl', 'githubUrl', 'linkedinUrl'],
};

export const OnboardingForm = ({ defaultName }: { defaultName?: string }) => {
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(OnboardingSchema),
    mode: 'onBlur',
    defaultValues: {
      name: defaultName ?? '',
      location: '',
      experienceLevel: 'MID',
      bio: '',
      skills: [],
      preferredRoles: [],
      resumeUrl: null,
      githubUrl: null,
      linkedinUrl: null,
    },
  });

  const next = async () => {
    const fields = STEP_FIELDS[STEPS[step].id];
    const ok = await form.trigger(fields);
    if (ok) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onSubmit = (values: OnboardingInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = await submitOnboardingAction(values);
      if (!res.success) {
        setServerError(res.error);
        if (res.fieldErrors) {
          Object.entries(res.fieldErrors).forEach(([k, v]) => {
            if (v && v[0]) form.setError(k as keyof OnboardingInput, { message: v[0] });
          });
        }
      }
    });
  };

  const errors = form.formState.errors;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Welcome to JobPilot</CardTitle>
        <CardDescription>{current.desc}</CardDescription>
        <ol className="mt-4 flex gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-muted'}`}
              aria-current={i === step ? 'step' : undefined}
            />
          ))}
        </ol>
      </CardHeader>

      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {current.id === 'basics' ? (
            <>
              <Field label="Full name" htmlFor="name" required error={errors.name?.message}>
                <Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...form.register('name')} />
              </Field>
              <Field
                label="Location"
                htmlFor="location"
                hint="City, country — used to filter remote/onsite roles."
                error={errors.location?.message}
              >
                <Input
                  id="location"
                  autoComplete="address-level2"
                  aria-invalid={!!errors.location}
                  {...form.register('location')}
                />
              </Field>
            </>
          ) : null}

          {current.id === 'experience' ? (
            <>
              <Field
                label="Experience level"
                htmlFor="experienceLevel"
                required
                error={errors.experienceLevel?.message}
              >
                <Select id="experienceLevel" aria-invalid={!!errors.experienceLevel} {...form.register('experienceLevel')}>
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {EXPERIENCE_LABELS[lvl]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Short bio"
                htmlFor="bio"
                hint="One paragraph. Used to personalize AI matches."
                error={errors.bio?.message}
              >
                <Textarea id="bio" rows={4} aria-invalid={!!errors.bio} {...form.register('bio')} />
              </Field>
            </>
          ) : null}

          {current.id === 'preferences' ? (
            <>
              <Field label="Skills" htmlFor="skills" required hint="Press Enter or comma to add." error={errors.skills?.message as string}>
                <Controller
                  control={form.control}
                  name="skills"
                  render={({ field }) => (
                    <TagInput
                      id="skills"
                      value={field.value ?? []}
                      onChange={field.onChange}
                      ariaInvalid={!!errors.skills}
                      placeholder="typescript, react, postgres..."
                    />
                  )}
                />
              </Field>
              <Field
                label="Preferred roles"
                htmlFor="preferredRoles"
                required
                hint="Job titles you'd consider."
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
                      placeholder="Senior Software Engineer, Staff Engineer..."
                    />
                  )}
                />
              </Field>
            </>
          ) : null}

          {current.id === 'links' ? (
            <>
              <Field label="Resume URL" htmlFor="resumeUrl" hint="https link to a hosted PDF." error={errors.resumeUrl?.message as string}>
                <Input id="resumeUrl" type="url" placeholder="https://..." aria-invalid={!!errors.resumeUrl} {...form.register('resumeUrl')} />
              </Field>
              <Field label="GitHub URL" htmlFor="githubUrl" error={errors.githubUrl?.message as string}>
                <Input id="githubUrl" type="url" placeholder="https://github.com/yourname" aria-invalid={!!errors.githubUrl} {...form.register('githubUrl')} />
              </Field>
              <Field label="LinkedIn URL" htmlFor="linkedinUrl" error={errors.linkedinUrl?.message as string}>
                <Input id="linkedinUrl" type="url" placeholder="https://linkedin.com/in/yourname" aria-invalid={!!errors.linkedinUrl} {...form.register('linkedinUrl')} />
              </Field>
            </>
          ) : null}

          {serverError ? (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </p>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={step === 0 || pending}
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>

            {isLast ? (
              <Button type="submit" loading={pending}>
                <CheckCircle2 className="h-4 w-4" /> Finish
              </Button>
            ) : (
              <Button type="button" onClick={() => void next()}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
