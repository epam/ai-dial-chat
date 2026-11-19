import { OrgUnitFolderGuardPurpose } from '@epam/ai-dial-chat-hooks';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import {
  OrgUnitAccessI18nKeys,
  PublishI18nKeys,
} from '../constants/translation-keys';

const REASON_KEYS: Partial<
  Record<
    OrgUnitFolderGuardPurpose,
    Partial<Record<OrgUnitNamespace, OrgUnitAccessI18nKeys>>
  >
> = {
  [OrgUnitFolderGuardPurpose.Save]: {
    [OrgUnitNamespace.Toolsets]: OrgUnitAccessI18nKeys.NoSaveAccessToolset,
    [OrgUnitNamespace.Prompts]: OrgUnitAccessI18nKeys.NoSaveAccessPrompt,
    [OrgUnitNamespace.Skills]: OrgUnitAccessI18nKeys.NoSaveAccessSkill,
    [OrgUnitNamespace.Conversations]:
      OrgUnitAccessI18nKeys.NoSaveAccessConversation,
    [OrgUnitNamespace.Projects]: OrgUnitAccessI18nKeys.NoSaveAccessProject,
  },
  [OrgUnitFolderGuardPurpose.Publish]: {
    [OrgUnitNamespace.Toolsets]: OrgUnitAccessI18nKeys.NoPublishAccessToolset,
    [OrgUnitNamespace.Prompts]: OrgUnitAccessI18nKeys.NoPublishAccessPrompt,
    [OrgUnitNamespace.Skills]: OrgUnitAccessI18nKeys.NoPublishAccessSkill,
    [OrgUnitNamespace.Conversations]:
      OrgUnitAccessI18nKeys.NoPublishAccessConversation,
    [OrgUnitNamespace.Projects]: OrgUnitAccessI18nKeys.NoPublishAccessProject,
  },
};

/** Applications read "QuickApp" only for a Quick App; schema-form and custom applications read "application". */
const QUICK_APP_KEYS: Record<OrgUnitFolderGuardPurpose, OrgUnitAccessI18nKeys> =
  {
    [OrgUnitFolderGuardPurpose.Save]:
      OrgUnitAccessI18nKeys.NoSaveAccessQuickApp,
    [OrgUnitFolderGuardPurpose.Publish]:
      OrgUnitAccessI18nKeys.NoPublishAccessQuickApp,
  };
const APPLICATION_KEYS: Record<
  OrgUnitFolderGuardPurpose,
  OrgUnitAccessI18nKeys
> = {
  [OrgUnitFolderGuardPurpose.Save]:
    OrgUnitAccessI18nKeys.NoSaveAccessApplication,
  [OrgUnitFolderGuardPurpose.Publish]:
    OrgUnitAccessI18nKeys.NoPublishAccessApplication,
};

/**
 * The translation key of the reason a folder is disabled for `purpose` on a
 * resource of `namespace`, or `undefined` for a namespace that is neither saved
 * nor published as a resource (files, publications).
 * @param purpose - whether the panel saves or publishes
 * @param namespace - org-unit namespace of the resource type
 * @param isQuickApp - for the applications namespace, whether the resource is a Quick App; a custom or schema-form application, or an unknown kind, reads "application"
 */
export const getOrgUnitAccessReasonKey = (
  purpose: OrgUnitFolderGuardPurpose,
  namespace: OrgUnitNamespace,
  isQuickApp = false,
): OrgUnitAccessI18nKeys | undefined => {
  if (namespace === OrgUnitNamespace.Applications) {
    return (isQuickApp ? QUICK_APP_KEYS : APPLICATION_KEYS)[purpose];
  }
  return REASON_KEYS[purpose]?.[namespace];
};

const DEPENDENCY_TYPE_KEYS: Partial<Record<OrgUnitNamespace, PublishI18nKeys>> =
  {
    [OrgUnitNamespace.Applications]:
      PublishI18nKeys.DependenciesTypeApplication,
    [OrgUnitNamespace.Toolsets]: PublishI18nKeys.DependenciesTypeToolset,
    [OrgUnitNamespace.Prompts]: PublishI18nKeys.DependenciesTypePrompt,
    [OrgUnitNamespace.Skills]: PublishI18nKeys.DependenciesTypeSkill,
  };

/**
 * The translation key of the type name shown for a namespace in the reason a folder cannot take an application's dependencies, or `undefined` for a namespace no dependency has.
 * @param namespace - org-unit namespace of a dependency
 */
export const getDependencyTypeKey = (
  namespace: OrgUnitNamespace,
): PublishI18nKeys | undefined => DEPENDENCY_TYPE_KEYS[namespace];
