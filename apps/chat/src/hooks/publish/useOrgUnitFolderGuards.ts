import {
  useFolderGuards,
  type FolderGuards,
  type OrgUnitFolderGuardPurpose,
} from '@epam/ai-dial-chat-hooks';
import type { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFeatureFlag } from '../../context/AppConfigContext';
import { useOrgUnitsContext } from '../../context/OrgUnitsContext';
import { getOrgUnitAccessReasonKey } from '../../utils/org-unit-access';

interface Options {
  /** Save uses `canSaveAt`, Publish uses `canPublishAt` */
  purpose: OrgUnitFolderGuardPurpose;
  /** Core namespace of the resource */
  namespace: OrgUnitNamespace | undefined;
  /** Whether the panel is open; no read starts while it is false. Defaults to `false`. */
  isActive?: boolean;
  /** For applications, whether the resource is a Quick App (changes the type word in the reason). Defaults to `false`. */
  isQuickApp?: boolean;
  /** Re-reads already loaded rights each time the panel opens. Defaults to `false`. */
  shouldRefreshOnOpen?: boolean;
}

/**
 * The org-unit folder guards of a Save or Publish panel for one resource type,
 * with the typed, translated reason for a disabled folder; the rule itself is
 * `useFolderGuards` in `@epam/ai-dial-chat-hooks`.
 * @param options - purpose, namespace and panel state of the guards
 */
export const useOrgUnitFolderGuards = ({
  purpose,
  namespace,
  isActive = false,
  isQuickApp = false,
  shouldRefreshOnOpen = false,
}: Options): FolderGuards => {
  const { t } = useTranslation();
  const isEnabled = useFeatureFlag('orgUnitsEnabled');
  const orgUnits = useOrgUnitsContext();
  const getReason = useMemo(() => {
    const reasonKey =
      namespace == null
        ? undefined
        : getOrgUnitAccessReasonKey(purpose, namespace, isQuickApp);
    return reasonKey ? () => t(reasonKey) : undefined;
  }, [purpose, namespace, isQuickApp, t]);

  return useFolderGuards({
    purpose,
    namespace,
    isActive,
    isEnabled,
    orgUnits,
    shouldRefreshOnOpen,
    getReason,
  });
};
