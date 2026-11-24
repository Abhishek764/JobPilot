'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ApplicationDrawer } from './application-drawer';
import { ApplicationInsights } from './application-insights';
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
    <div className="flex h-full flex-col gap-4">
      <ApplicationInsights onOpen={setSelectedId} />
      <div className="min-h-0 flex-1">
        <KanbanBoard onSelect={setSelectedId} />
      </div>
      <ApplicationDrawer id={selectedId} onClose={close} />
    </div>
  );
};
