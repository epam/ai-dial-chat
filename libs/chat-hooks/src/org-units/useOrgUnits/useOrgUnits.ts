import {
  isOrgUnitFolder as isFolderInSet,
  type OrgUnit,
  toOrgUnitFolderSet,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrgUnitsListResult } from '../models';
import { OrgUnitsStatus } from '../types';

/** Options for {@link useOrgUnits}. */
export interface UseOrgUnitsOptions {
  /** Reads the org units visible to the current user; supplied by the host. */
  listOrgUnits: () => Promise<OrgUnitsListResult>;
}

/** State returned by {@link useOrgUnits}. */
export interface UseOrgUnitsResult {
  /** Load state of the units. */
  status: OrgUnitsStatus;
  /** Starts the read on its first call, and again after a failed read; otherwise does nothing. */
  ensureUnits: () => void;
  /** Whether a public-bucket path is a unit's own folder; `false` until the units are loaded. */
  isOrgUnitFolder: (publicPath: string) => boolean;
}

/** Loads the current user's org units once, on demand, and answers which public folders are units. */
export const useOrgUnits = ({
  listOrgUnits,
}: UseOrgUnitsOptions): UseOrgUnitsResult => {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [status, setStatus] = useState(OrgUnitsStatus.Idle);
  const hasRequested = useRef(false);
  const isMounted = useRef(true);
  const listOrgUnitsRef = useRef(listOrgUnits);
  listOrgUnitsRef.current = listOrgUnits;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async (): Promise<void> => {
    setStatus(OrgUnitsStatus.Loading);
    try {
      const result = await listOrgUnitsRef.current();
      if (!isMounted.current) return;
      if (!result.enabled) {
        setUnits([]);
        setStatus(OrgUnitsStatus.Disabled);
        return;
      }
      setUnits(result.units);
      setStatus(OrgUnitsStatus.Ready);
    } catch {
      /* A failed read only withholds the unit answer, so it is not reported to the user.
       * The BFF never caches a failure, so the next ensureUnits() may retry it. */
      hasRequested.current = false;
      if (!isMounted.current) return;
      setUnits([]);
      setStatus(OrgUnitsStatus.Error);
    }
  }, []);

  const ensureUnits = useCallback((): void => {
    if (hasRequested.current) return;
    hasRequested.current = true;
    void load();
  }, [load]);

  const unitFolders = useMemo(() => toOrgUnitFolderSet(units), [units]);

  const isOrgUnitFolder = useCallback(
    (publicPath: string): boolean =>
      status === OrgUnitsStatus.Ready && isFolderInSet(unitFolders, publicPath),
    [status, unitFolders],
  );

  return { status, ensureUnits, isOrgUnitFolder };
};
