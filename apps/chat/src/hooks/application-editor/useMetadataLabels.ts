import type { DeploymentCreationFormLabels } from '@epam/ai-dial-builder-form';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EditorI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../constants/translation-keys';
import { buildLocaleFieldLabels } from '../../utils/locale';

/**
 * Builds the translated Metadata field labels shared by every entity editor.
 *
 * Only a kind's placeholders differ, so a kind passes a module-level
 * `getOverrides` function instead of re-declaring the whole label set.
 */
export const useMetadataLabels = (
  getOverrides?: (t: TFunction) => Partial<DeploymentCreationFormLabels>,
): DeploymentCreationFormLabels => {
  const { t } = useTranslation();

  return useMemo(
    () => ({
      name: { label: t(EditorI18nKeys.NameLabel) },
      description: { label: t(EditorI18nKeys.DescriptionLabel) },
      iconUrl: {
        label: t(EditorI18nKeys.AvatarLabel),
        addAvatarLabel: t(EditorI18nKeys.AddAvatarButtonLabel),
        captionText: t(EditorI18nKeys.AvatarCaption),
      },
      version: {
        label: t(EditorI18nKeys.VersionLabel),
        placeholder: t(EditorI18nKeys.VersionPlaceholder),
      },
      topics: {
        label: t(EditorI18nKeys.TopicsLabel),
        placeholder: t(EditorI18nKeys.TopicsPlaceholder),
      },
      otherLocales: buildLocaleFieldLabels(t),
      ariaLabel: t(ToolsetEditorI18nKeys.MetadataSectionTitle),
      ...getOverrides?.(t),
    }),
    [t, getOverrides],
  );
};
