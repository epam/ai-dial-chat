import { OrgUnitFolderGuardPurpose } from '@epam/ai-dial-chat-hooks';
import { OrgUnitNamespace } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { OrgUnitAccessI18nKeys } from '../../constants/translation-keys';
import en from '../../i18n/locales/en.json';
import { getOrgUnitAccessReasonKey } from '../org-unit-access';

const RESOURCE_NAMESPACES = [
  OrgUnitNamespace.Applications,
  OrgUnitNamespace.Toolsets,
  OrgUnitNamespace.Prompts,
  OrgUnitNamespace.Skills,
  OrgUnitNamespace.Conversations,
  OrgUnitNamespace.Projects,
];

describe('getOrgUnitAccessReasonKey', () => {
  it.each(
    RESOURCE_NAMESPACES.flatMap((namespace) =>
      [OrgUnitFolderGuardPurpose.Save, OrgUnitFolderGuardPurpose.Publish].map(
        (purpose) => [purpose, namespace] as const,
      ),
    ),
  )('has a reason for %s and %s', (purpose, namespace) => {
    expect(getOrgUnitAccessReasonKey(purpose, namespace)).toBeDefined();
  });

  it('says QuickApp only for a Quick App and application otherwise', () => {
    const { Save, Publish } = OrgUnitFolderGuardPurpose;
    const apps = OrgUnitNamespace.Applications;

    expect(getOrgUnitAccessReasonKey(Save, apps, true)).toBe(
      OrgUnitAccessI18nKeys.NoSaveAccessQuickApp,
    );
    expect(getOrgUnitAccessReasonKey(Publish, apps, true)).toBe(
      OrgUnitAccessI18nKeys.NoPublishAccessQuickApp,
    );
    expect(getOrgUnitAccessReasonKey(Save, apps)).toBe(
      OrgUnitAccessI18nKeys.NoSaveAccessApplication,
    );
    expect(getOrgUnitAccessReasonKey(Publish, apps)).toBe(
      OrgUnitAccessI18nKeys.NoPublishAccessApplication,
    );
  });

  it('gives save and publish different reasons for the same type', () => {
    expect(
      getOrgUnitAccessReasonKey(
        OrgUnitFolderGuardPurpose.Save,
        OrgUnitNamespace.Toolsets,
      ),
    ).toBe(OrgUnitAccessI18nKeys.NoSaveAccessToolset);
    expect(
      getOrgUnitAccessReasonKey(
        OrgUnitFolderGuardPurpose.Publish,
        OrgUnitNamespace.Toolsets,
      ),
    ).toBe(OrgUnitAccessI18nKeys.NoPublishAccessToolset);
  });

  it('has no reason for a namespace that is not saved or published as a resource', () => {
    expect(
      getOrgUnitAccessReasonKey(
        OrgUnitFolderGuardPurpose.Save,
        OrgUnitNamespace.Files,
      ),
    ).toBeUndefined();
  });

  it('declares every key in en.json with a non-empty sentence', () => {
    const texts = en.orgUnitAccess as Record<string, string>;
    for (const key of Object.values(OrgUnitAccessI18nKeys)) {
      expect(texts[key.replace('orgUnitAccess.', '')]).toMatch(
        /^You have no access to (save|publish) your .+ to this folder\.$/,
      );
    }
  });
});
