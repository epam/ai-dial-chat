import {
  canReadAt as canReadAtAccess,
  canSaveToFolderAt,
  canWriteIntoOrgUnitAt,
  canRequestPublicationAt,
  canWriteAt as canWriteAtAccess,
  type OrgUnitAccess,
  type OrgUnitNamespace,
} from '@epam/ai-dial-chat-shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OrgUnitsListResult } from '../models';
import { OrgUnitsStatus } from '../types';

/** Options for {@link useOrgUnits}. */
export interface UseOrgUnitsOptions {
  /** Reads the org units visible to the current user; supplied by the host. */
  listOrgUnits: () => Promise<OrgUnitsListResult>;
}

/** Answers whether an action is allowed at a decoded public-relative path for a Core namespace. */
export type OrgUnitRightCheck = (
  publicPath: string,
  namespace: OrgUnitNamespace,
) => boolean;

/** State returned by {@link useOrgUnits}. */
export interface UseOrgUnitsResult {
  /** Load state of the units. */
  status: OrgUnitsStatus;
  /** Starts the read on its first call, and again after a failed read; otherwise does nothing. */
  ensureUnits: () => void;
  /** Reads the units again while the previous answer stays in use; does nothing once Core reported org units off. */
  refreshUnits: () => void;
  /** Whether the user may write at the path; `true` until the status is `Ready`. */
  canWriteAt: OrgUnitRightCheck;
  /** Whether the path is a usable save destination: `true` outside every unit, otherwise needs `write`; `true` until the status is `Ready`. */
  canSaveAt: OrgUnitRightCheck;
  /** Whether the user may write straight into the path: it lies inside an org unit that grants `write`. `false` until the status is `Ready` and outside every unit, even for a DIAL admin. */
  canSaveDirectlyAt: OrgUnitRightCheck;
  /** Whether the user may read at the path; `true` until the status is `Ready`. */
  canReadAt: OrgUnitRightCheck;
  /** Whether a publication request into the path can be sent; `true` until the status is `Ready`. */
  canPublishAt: OrgUnitRightCheck;
}

const NO_UNITS: OrgUnitAccess = { hasAdminAccess: false, units: [] };

/**
 * Loads the current user's org units once, on demand, and answers write, read and
 * save and publication-request rights per path. Until the status is `Ready` (and in
 * `Disabled` and `Error`) every answer is `true`, so missing data never disables a folder.
 * @param options - the host-supplied `listOrgUnits` read
 */
export const useOrgUnits = ({
  listOrgUnits,
}: UseOrgUnitsOptions): UseOrgUnitsResult => {
  const [access, setAccess] = useState<OrgUnitAccess>(NO_UNITS);
  const [status, setStatus] = useState(OrgUnitsStatus.Idle);
  const hasRequested = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  const isMounted = useRef(true);
  const listOrgUnitsRef = useRef(listOrgUnits);
  listOrgUnitsRef.current = listOrgUnits;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const load = useCallback(async (isRefresh: boolean): Promise<void> => {
    if (!isRefresh) setStatus(OrgUnitsStatus.Loading);
    try {
      const result = await listOrgUnitsRef.current();
      if (!isMounted.current) return;
      if (!result.enabled) {
        setAccess(NO_UNITS);
        setStatus(OrgUnitsStatus.Disabled);
        return;
      }
      setAccess({
        hasAdminAccess: result.hasAdminAccess,
        units: result.units,
      });
      setStatus(OrgUnitsStatus.Ready);
    } catch {
      /* A failed read only withholds the rights, so it is not reported to the user.
       * The BFF never caches a failure, so the next ensureUnits() may retry it.
       * A failed refresh keeps the previous answer. */
      if (isRefresh) return;
      hasRequested.current = false;
      if (!isMounted.current) return;
      setAccess(NO_UNITS);
      setStatus(OrgUnitsStatus.Error);
    }
  }, []);

  const ensureUnits = useCallback((): void => {
    if (hasRequested.current) return;
    hasRequested.current = true;
    void load(false);
  }, [load]);

  const refreshUnits = useCallback((): void => {
    if (statusRef.current === OrgUnitsStatus.Disabled) return;
    if (statusRef.current !== OrgUnitsStatus.Ready) {
      ensureUnits();
      return;
    }
    void load(true);
  }, [ensureUnits, load]);

  const isReady = status === OrgUnitsStatus.Ready;

  const canWriteAt = useCallback<OrgUnitRightCheck>(
    (publicPath, namespace) =>
      !isReady || canWriteAtAccess(access, publicPath, namespace),
    [isReady, access],
  );

  const canSaveAt = useCallback<OrgUnitRightCheck>(
    (publicPath, namespace) =>
      !isReady || canSaveToFolderAt(access, publicPath, namespace),
    [isReady, access],
  );

  const canSaveDirectlyAt = useCallback<OrgUnitRightCheck>(
    (publicPath, namespace) =>
      isReady && canWriteIntoOrgUnitAt(access, publicPath, namespace),
    [isReady, access],
  );

  const canReadAt = useCallback<OrgUnitRightCheck>(
    (publicPath, namespace) =>
      !isReady || canReadAtAccess(access, publicPath, namespace),
    [isReady, access],
  );

  const canPublishAt = useCallback<OrgUnitRightCheck>(
    (publicPath, namespace) =>
      !isReady || canRequestPublicationAt(access, publicPath, namespace),
    [isReady, access],
  );

  return useMemo(
    () => ({
      status,
      ensureUnits,
      refreshUnits,
      canWriteAt,
      canSaveAt,
      canSaveDirectlyAt,
      canReadAt,
      canPublishAt,
    }),
    [
      status,
      ensureUnits,
      refreshUnits,
      canWriteAt,
      canSaveAt,
      canSaveDirectlyAt,
      canReadAt,
      canPublishAt,
    ],
  );
};
