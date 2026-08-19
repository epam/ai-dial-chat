import { useContext } from 'react';
import { SheetNavigationContext } from '../context/SheetNavigationContext';
import type { SheetNavigation } from '../models/sheet-navigation';

/** Stack controls for content rendered inside a `NavigableBottomSheet`. */
export const useSheetNavigation = (): SheetNavigation => {
  const ctx = useContext(SheetNavigationContext);
  if (!ctx) {
    throw new Error(
      'useSheetNavigation must be used within a NavigableBottomSheet',
    );
  }
  return ctx;
};
