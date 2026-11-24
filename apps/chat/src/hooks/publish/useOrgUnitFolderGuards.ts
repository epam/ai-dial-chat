import {
  SaveDestinationRoot,
  useFolderGuards,
  type FolderGuards,
  type OrgUnitFolderGuardPurpose,
} from '@epam/ai-dial-chat-hooks';
import type { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import type { FolderDestination } from '@epam/ai-dial-publish-panel';
import { useCallback, useMemo } from 'react';
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

/** The guards of {@link useOrgUnitFolderGuards}. */
export interface OrgUnitFolderGuards extends FolderGuards {
  /** Whether a folder tree may create a new folder inside a destination: inside an org unit for the Organization root (`rootKey` `''` in a publish tree), so the new folder is not hidden by the org-unit visibility rule; always for the Personal root and while the units are not `Ready`. Pass it to the tree as `canCreateFolderIn`. */
  canCreateFolderIn: (destination: FolderDestination) => boolean;
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
}: Options): OrgUnitFolderGuards => {
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

  const guards = useFolderGuards({
    purpose,
    namespace,
    isActive,
    isEnabled,
    orgUnits,
    shouldRefreshOnOpen,
    getReason,
  });

  const { canCreatePublicFolderIn } = orgUnits;
  const canCreateFolderIn = useCallback(
    ({ rootKey, path }: FolderDestination): boolean =>
      rootKey === SaveDestinationRoot.Personal ||
      canCreatePublicFolderIn(path.join('/')),
    [canCreatePublicFolderIn],
  );

  return useMemo(
    () => ({ ...guards, canCreateFolderIn }),
    [guards, canCreateFolderIn],
  );
};
