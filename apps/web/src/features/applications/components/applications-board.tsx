'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ApplicationDrawer } from './application-drawer';
import { KanbanBoard } from './kanban-board';

export const ApplicationsBoard = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [selectedId, setSelectedId] = useState<string | null>(() => searchParams.get('open'));

  const close = () => {
    setSelectedId(null);
    if (searchParams.has('open')) router.replace(pathname, { scroll: false });
  };

  return (
    <>
      <KanbanBoard onSelect={setSelectedId} />
      <ApplicationDrawer id={selectedId} onClose={close} />
    </>
  );
};
