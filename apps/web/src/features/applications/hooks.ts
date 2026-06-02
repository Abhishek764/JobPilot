'use client';

import { useAuth } from '@clerk/nextjs';
import type { Application, Board } from '@jobpilot/types';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import { applicationsApi, type BoardFilters } from './api';
import { applicationKeys } from './keys';

const useToken = (): (() => Promise<string | null>) => {
  const { getToken } = useAuth();
  return useCallback(() => getToken(), [getToken]);
};

const boardFilter = { queryKey: applicationKeys.all } as const;

/** Apply a card move to a cached Board, keeping each column sorted by position. */
const applyMove = (board: Board, id: string, status: string, position: number): Board => {
  let card: Application | undefined;
  for (const col of board.columns) {
    const found = col.items.find((c) => c.id === id);
    if (found) {
      card = { ...found, status: status as Application['status'], position };
      break;
    }
  }
  if (!card) return board;

  return {
    columns: board.columns.map((col) => {
      const items = col.items.filter((c) => c.id !== id);
      if (col.status === status) items.push(card!);
      items.sort((a, b) => a.position - b.position);
      return { ...col, items, total: items.length };
    }),
  };
};

export const useBoard = (filters: BoardFilters) => {
  const token = useToken();
  return useQuery({
    queryKey: applicationKeys.board(filters),
    queryFn: async () => applicationsApi.board(await token(), filters),
  });
};

export const useApplication = (id: string | null) => {
  const token = useToken();
  return useQuery({
    queryKey: applicationKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => applicationsApi.get(await token(), id!),
  });
};

export const useSetStatus = (id: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (status: string) => applicationsApi.setStatus(await token(), id, status),
    onSuccess: () => {
      void qc.invalidateQueries(boardFilter);
      void qc.invalidateQueries({ queryKey: applicationKeys.detail(id) });
    },
  });
};

export const useMoveApplication = () => {
  const token = useToken();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (v: { id: string; status: string; position: number }) =>
      applicationsApi.move(await token(), v.id, { status: v.status, position: v.position }),

    onMutate: async (v) => {
      await qc.cancelQueries(boardFilter);
      const snapshots = qc.getQueriesData<Board>(boardFilter);
      for (const [key, board] of snapshots) {
        if (board) qc.setQueryData(key, applyMove(board, v.id, v.status, v.position));
      }
      return { snapshots };
    },

    onError: (_err, _v, ctx) => {
      ctx?.snapshots.forEach(([key, board]) => qc.setQueryData(key, board));
    },

    onSettled: () => {
      void qc.invalidateQueries(boardFilter);
    },
  });
};

export const useCreateApplication = () => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Application>) => applicationsApi.create(await token(), body),
    onSuccess: () => void qc.invalidateQueries(boardFilter),
  });
};

export const useDeleteApplication = () => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => applicationsApi.remove(await token(), id),
    onSuccess: () => void qc.invalidateQueries(boardFilter),
  });
};

export const useEvents = (id: string, enabled = true) => {
  const token = useToken();
  return useQuery({
    queryKey: applicationKeys.events(id),
    enabled,
    queryFn: async () => applicationsApi.events(await token(), id),
  });
};

export const useNotes = (id: string, enabled = true) => {
  const token = useToken();
  return useQuery({
    queryKey: applicationKeys.notes(id),
    enabled,
    queryFn: async () => applicationsApi.notes.list(await token(), id),
  });
};

const invalidateDetail = (qc: QueryClient, id: string): void => {
  void qc.invalidateQueries({ queryKey: applicationKeys.notes(id) });
  void qc.invalidateQueries({ queryKey: applicationKeys.events(id) });
};

export const useCreateNote = (id: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => applicationsApi.notes.create(await token(), id, body),
    onSuccess: () => invalidateDetail(qc, id),
  });
};

export const useDeleteNote = (id: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: string) => applicationsApi.notes.remove(await token(), id, noteId),
    onSuccess: () => invalidateDetail(qc, id),
  });
};

export const useReminders = (id: string, enabled = true) => {
  const token = useToken();
  return useQuery({
    queryKey: applicationKeys.reminders(id),
    enabled,
    queryFn: async () => applicationsApi.reminders.list(await token(), id),
  });
};

const invalidateReminders = (qc: QueryClient, id: string): void => {
  void qc.invalidateQueries({ queryKey: applicationKeys.reminders(id) });
  void qc.invalidateQueries({ queryKey: applicationKeys.events(id) });
};

export const useCreateReminder = (id: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { title: string; dueAt: string }) =>
      applicationsApi.reminders.create(await token(), id, v),
    onSuccess: () => invalidateReminders(qc, id),
  });
};

export const useCompleteReminder = (id: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reminderId: string) =>
      applicationsApi.reminders.complete(await token(), id, reminderId),
    onSuccess: () => invalidateReminders(qc, id),
  });
};

export const useDeleteReminder = (id: string) => {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reminderId: string) =>
      applicationsApi.reminders.remove(await token(), id, reminderId),
    onSuccess: () => invalidateReminders(qc, id),
  });
};
