'use server';

import { OnboardingSchema, UpdateProfileSchema } from '@jobpilot/types/schemas';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { apiServer, ApiServerError } from '@/lib/api-server';

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export const submitOnboardingAction = async (raw: unknown): Promise<ActionResult> => {
  const parsed = OnboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const data = await apiServer<unknown>('/users/me/onboard', {
      method: 'POST',
      body: parsed.data,
    });
    revalidatePath('/dashboard');
    redirect('/dashboard');
    return { success: true, data };
  } catch (err) {
    if (err instanceof ApiServerError) {
      return {
        success: false,
        error: err.message,
        fieldErrors: (err.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors,
      };
    }
    throw err;
  }
};

export const updateProfileAction = async (raw: unknown): Promise<ActionResult> => {
  const parsed = UpdateProfileSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Validation failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const data = await apiServer<unknown>('/users/me', {
      method: 'PATCH',
      body: parsed.data,
    });
    revalidatePath('/settings');
    revalidatePath('/dashboard');
    return { success: true, data };
  } catch (err) {
    if (err instanceof ApiServerError) {
      return { success: false, error: err.message };
    }
    throw err;
  }
};
