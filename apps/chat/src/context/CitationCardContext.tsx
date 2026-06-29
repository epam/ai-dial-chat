import { createContext, useContext } from 'react';
import type { useCitationCard } from '../hooks/citations/useCitationCard';

export type CitationCardHook = ReturnType<typeof useCitationCard>;

const CitationCardContext = createContext<CitationCardHook | null>(null);

export const CitationCardProvider = CitationCardContext.Provider;

export const useCitationCardContext = (): CitationCardHook => {
  const ctx = useContext(CitationCardContext);
  if (ctx == null)
    throw new Error(
      'useCitationCardContext must be used within a CitationCardProvider',
    );
  return ctx;
};
