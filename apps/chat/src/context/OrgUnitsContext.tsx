import { useOrgUnits, type UseOrgUnitsResult } from '@epam/ai-dial-chat-hooks';
import {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { listOrgUnits } from '../server-api/org-units.api';
import { useFeatureFlag } from './AppConfigContext';

const OrgUnitsContext = createContext<UseOrgUnitsResult | undefined>(undefined);

interface Props {
  children: ReactNode;
}

/**
 * Shares one org-unit read between all consumers.
 * Nothing is fetched on mount: a consumer calls `ensureUnits()` when it first
 * needs the answer, so a session with no consumer never asks DIAL Core.
 * While the `orgUnitsEnabled` feature flag is off, `ensureUnits()` does nothing
 * and no folder is a unit.
 */
export const OrgUnitsProvider: FC<Props> = ({ children }) => {
  const isEnabled = useFeatureFlag('orgUnitsEnabled');
  const {
    status,
    ensureUnits: ensureLoaded,
    isOrgUnitFolder,
  } = useOrgUnits({ listOrgUnits });

  /* A new identity once the flag resolves re-runs the consumers' effects, so a
     surface mounted before the client config loaded still starts the read. */
  const ensureUnits = useCallback(() => {
    if (isEnabled) ensureLoaded();
  }, [isEnabled, ensureLoaded]);

  const value = useMemo(
    (): UseOrgUnitsResult => ({ status, ensureUnits, isOrgUnitFolder }),
    [status, ensureUnits, isOrgUnitFolder],
  );

  return (
    <OrgUnitsContext.Provider value={value}>
      {children}
    </OrgUnitsContext.Provider>
  );
};

/** The current user's org units; throws outside `OrgUnitsProvider`. */
export const useOrgUnitsContext = (): UseOrgUnitsResult => {
  const context = useContext(OrgUnitsContext);
  if (context == null) {
    throw new Error(
      'useOrgUnitsContext must be used within an OrgUnitsProvider',
    );
  }
  return context;
};
