import { createContext } from 'react';
import type { SheetNavigation } from '../models/sheet-navigation';

/** Provided by `NavigableBottomSheet`; consumed through `useSheetNavigation`. */
export const SheetNavigationContext = createContext<
  SheetNavigation | undefined
>(undefined);
