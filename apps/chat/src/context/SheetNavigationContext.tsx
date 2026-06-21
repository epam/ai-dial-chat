import { createContext } from 'react';
import type { SheetNavigation } from '../models/sheet-navigation';

export const SheetNavigationContext = createContext<
  SheetNavigation | undefined
>(undefined);
