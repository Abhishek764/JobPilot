'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';

/** Stable accessor for the Clerk session token, for use inside query functions. */
export const useToken = (): (() => Promise<string | null>) => {
  const { getToken } = useAuth();
  return useCallback(() => getToken(), [getToken]);
};
