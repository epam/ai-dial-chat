import { type OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { useEffect, useMemo, useRef } from 'react';
import {
  buildFolderGuards,
  OrgUnitFolderGuardPurpose,
  type FolderGuards,
} from '../org-unit-guards';
import { OrgUnitsStatus } from '../types';
import type { UseOrgUnitsResult } from '../useOrgUnits/useOrgUnits';

/** What {@link useFolderGuards} reads from `useOrgUnits`. */
export type FolderGuardsOrgUnits = Pick<
  UseOrgUnitsResult,
  | 'status'
  | 'ensureUnits'
  | 'refreshUnits'
  | 'canSaveAt'
  | 'canPublishAt'
  | 'canSaveDirectlyAt'
>;

/** Parameters of {@link useFolderGuards}. */
export interface UseFolderGuardsParams {
  /** Save uses `canSaveAt` (and the strict direct-save check), Publish uses `canPublishAt`. */
  purpose: OrgUnitFolderGuardPurpose;
  /** Core namespace of the resource; `undefined` turns the guards off. */
  namespace: OrgUnitNamespace | undefined;
  /** Whether the panel is open; the org-unit read starts only while it is true. */
  isActive: boolean;
  /** Whether the host's `orgUnitsEnabled` feature flag is on. */
  isEnabled: boolean;
  /** The result of `useOrgUnits` (the host usually shares one through a context). */
  orgUnits: FolderGuardsOrgUnits;
  /** Re-read already loaded rights each time the panel opens, so a right that changed since is honoured. Defaults to `false`. */
  shouldRefreshOnOpen?: boolean;
  /** The host's translated reason shown for a disabled folder; without it `getDisabledReason` is `undefined`. Keep its identity stable (memoise it): a new function each render rebuilds the guards and so re-renders the folder tree. */
  getReason?: (folderPath: string[]) => string;
}

/**
 * The org-unit folder guards of a Save or Publish panel: starts the org-unit
 * read while the panel is active, optionally re-reads loaded rights on open,
 * and builds the guards, which exist only with the flag on and the rights
 * `Ready`.
 * @param params - purpose, namespace, flag, the org-unit result and the reason callback
 */
export const useFolderGuards = ({
  purpose,
  namespace,
  isActive,
  isEnabled,
  orgUnits,
  shouldRefreshOnOpen = false,
  getReason,
}: UseFolderGuardsParams): FolderGuards => {
  const {
    status,
    ensureUnits,
    refreshUnits,
    canSaveAt,
    canPublishAt,
    canSaveDirectlyAt,
  } = orgUnits;
  const latestRef = useRef({ status, refreshUnits });
  useEffect(() => {
    latestRef.current = { status, refreshUnits };
  }, [status, refreshUnits]);

  useEffect(() => {
    if (isActive && isEnabled) ensureUnits();
  }, [isActive, isEnabled, ensureUnits]);

  useEffect(() => {
    if (!isActive || !isEnabled || !shouldRefreshOnOpen) return;
    const { status: current, refreshUnits: refresh } = latestRef.current;
    if (current === OrgUnitsStatus.Ready) refresh();
  }, [isActive, isEnabled, shouldRefreshOnOpen]);

  return useMemo(
    () =>
      buildFolderGuards({
        purpose,
        isEnabled,
        status,
        namespace,
        canSaveAt,
        canPublishAt,
        canSaveDirectlyAt:
          purpose === OrgUnitFolderGuardPurpose.Save
            ? canSaveDirectlyAt
            : undefined,
        getReason,
      }),
    [
      purpose,
      namespace,
      isEnabled,
      status,
      canSaveAt,
      canPublishAt,
      canSaveDirectlyAt,
      getReason,
    ],
  );
};
