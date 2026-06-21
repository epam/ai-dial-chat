import type { ReactNode } from 'react';

export interface SheetPage {
  title: string;
  content: ReactNode;
}

export interface SheetNavigation {
  push: (page: SheetPage) => void;
  pop: () => void;
  close: () => void;
}
