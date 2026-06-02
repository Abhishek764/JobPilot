'use client';

import { useState } from 'react';

import { ApplicationDrawer } from './application-drawer';
import { KanbanBoard } from './kanban-board';

export const ApplicationsBoard = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <>
      <KanbanBoard onSelect={setSelectedId} />
      <ApplicationDrawer id={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
};
