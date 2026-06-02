'use client';

import { useAuth } from '@clerk/nextjs';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

import { env } from '@/lib/env';

import { applicationKeys } from './keys';

type IdPayload = { id?: string; applicationId?: string };

/**
 * Subscribe to the user's realtime room and refresh affected React Query
 * caches when another device mutates an application, note or reminder.
 */
export const useApplicationsRealtime = (): void => {
  const { getToken } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    let socket: Socket | undefined;
    let active = true;

    const invalidateBoard = (): void => {
      void qc.invalidateQueries({ queryKey: applicationKeys.all });
    };

    void (async () => {
      const token = await getToken();
      if (!active) return;

      socket = io(env.NEXT_PUBLIC_API_URL, {
        path: '/realtime',
        transports: ['websocket'],
        auth: { token },
      });

      socket.on('application.created', invalidateBoard);
      socket.on('application.moved', invalidateBoard);
      socket.on('application.deleted', invalidateBoard);
      socket.on('application.updated', (p: IdPayload) => {
        invalidateBoard();
        const id = p?.id;
        if (id) {
          void qc.invalidateQueries({ queryKey: applicationKeys.notes(id) });
          void qc.invalidateQueries({ queryKey: applicationKeys.events(id) });
        }
      });
      socket.on('reminder.changed', (p: IdPayload) => {
        const id = p?.applicationId;
        if (id) {
          void qc.invalidateQueries({ queryKey: applicationKeys.reminders(id) });
          void qc.invalidateQueries({ queryKey: applicationKeys.events(id) });
        }
      });
    })();

    return () => {
      active = false;
      socket?.disconnect();
    };
  }, [getToken, qc]);
};
