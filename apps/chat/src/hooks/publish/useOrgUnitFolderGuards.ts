import {
  buildFolderGuards,
  OrgUnitFolderGuardPurpose,
  OrgUnitsStatus,
  type FolderGuards,
} from '@epam/ai-dial-chat-hooks';
import type { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useOrgUnitsContext } from '../../context/OrgUnitsContext';
import { getOrgUnitAccessReasonKey } from '../../utils/org-unit-access';

/**
 * The org-unit folder guards of a Save or Publish panel for one resource type,
 * with the typed, translated reason for a disabled folder. Starts the org-unit
 * read only while `isActive` is true; the guards exist only with
 * `orgUnitsEnabled` on and the rights loaded, so a panel otherwise keeps
 * today's behaviour.
 * @param purpose - Save uses `canSaveAt`, Publish uses `canPublishAt`
 * @param namespace - Core namespace of the resource
 * @param isActive - whether the panel is open; no read starts while it is false
 * @param isQuickApp - for applications, whether the resource is a Quick App (changes the type word in the reason)
 * @param shouldRefreshOnOpen - re-read already loaded rights each time the panel opens, so a right that changed since is honoured
 */
export const useOrgUnitFolderGuards = (
  purpose: OrgUnitFolderGuardPurpose,
  namespace: OrgUnitNamespace | undefined,
  isActive = false,
  isQuickApp = false,
  shouldRefreshOnOpen = false,
): FolderGuards => {
  const { t } = useTranslation();
  const isEnabled = useFeatureFlag('orgUnitsEnabled');
  const {
    status,
    ensureUnits,
    refreshUnits,
    canSaveAt,
    canPublishAt,
    canSaveDirectlyAt,
  } = useOrgUnitsContext();
  const latestRef = useRef({ status, refreshUnits });
  useEffect(() => {
    latestRef.current = { status, refreshUnits };
  }, [status, refreshUnits]);

  useEffect(() => {
    if (isActive) ensureUnits();
  }, [isActive, ensureUnits]);

  /* Only the opening re-reads: rights loaded earlier may be stale, and a first load is already `ensureUnits`'s. */
  useEffect(() => {
    if (!isActive || !shouldRefreshOnOpen) return;
    const { status: current, refreshUnits: refresh } = latestRef.current;
    if (current === OrgUnitsStatus.Ready) refresh();
  }, [isActive, shouldRefreshOnOpen]);

  return useMemo(() => {
    const reasonKey =
      namespace == null
        ? undefined
        : getOrgUnitAccessReasonKey(purpose, namespace, isQuickApp);
    return buildFolderGuards({
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
      getReason: reasonKey && (() => t(reasonKey)),
    });
  }, [
    purpose,
    namespace,
    isQuickApp,
    isEnabled,
    status,
    canSaveAt,
    canPublishAt,
    canSaveDirectlyAt,
    t,
  ]);
};
