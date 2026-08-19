import type { ReactNode } from 'react';

/** A page pushed onto the bottom sheet's navigation stack. */
export interface SheetPage {
  /** Header title shown while the page is on top of the stack. */
  title: string;
  /** Page body. */
  content: ReactNode;
}

/** Stack controls exposed to sheet page content via `useSheetNavigation`. */
export interface SheetNavigation {
  /** Pushes a page on top of the stack. */
  push: (page: SheetPage) => void;
  /** Pops the top page, revealing the one beneath it. */
  pop: () => void;
  /** Clears the stack and closes the sheet. */
  close: () => void;
}
