import {
  OrgUnitFolderGuardPurpose,
  type FolderGuards,
} from '@epam/ai-dial-chat-hooks';
import type { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { useOrgUnitFolderGuards } from './useOrgUnitFolderGuards';

/**
 * The org-unit publish guards for one resource type; see
 * {@link useOrgUnitFolderGuards}.
 * @param namespace - Core namespace of the resource being published
 * @param isActive - whether a publish panel is open; no read starts while it is false
 * @param isQuickApp - for applications, whether the resource is a Quick App
 */
export const usePublishFolderGuards = (
  namespace: OrgUnitNamespace | undefined,
  isActive = false,
  isQuickApp = false,
): FolderGuards =>
  useOrgUnitFolderGuards(
    OrgUnitFolderGuardPurpose.Publish,
    namespace,
    isActive,
    isQuickApp,
  );
