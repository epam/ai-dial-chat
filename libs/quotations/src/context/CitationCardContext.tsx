import { createContext, useContext } from 'react';
import type { useCitationCard } from '../utils/useCitationCard';

/** The shape returned by `useCitationCard`. */
export type CitationCardHook = ReturnType<typeof useCitationCard>;

const CitationCardContext = createContext<CitationCardHook | null>(null);

/** Provider that supplies `CitationCardHook` state to a citation subtree. */
export const CitationCardProvider = CitationCardContext.Provider;

/** Returns the nearest `CitationCardHook` from context. Throws when used outside a `CitationCardProvider`. */
export const useCitationCardContext = (): CitationCardHook => {
  const ctx = useContext(CitationCardContext);
  if (ctx == null)
    throw new Error(
      'useCitationCardContext must be used within a CitationCardProvider',
    );
  return ctx;
};
