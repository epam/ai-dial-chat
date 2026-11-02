import { formatFileSize } from '@epam/ai-dial-chat-shared';
import {
  ContextFileRejection,
  ProjectNameError,
  type ProjectCreateFormLabels,
} from '@epam/ai-dial-projects';
import { createElement, useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import {
  ButtonsI18nKeys,
  ProjectsI18nKeys,
} from '../../constants/translation-keys';
import { useTextRefinementLabels } from '../useTextRefinementLabels';

/** Context limits the New project copy names. */
export interface ProjectCreateLabelLimits {
  allowedExtensions: string[];
  maxFileBytes: number;
}

/**
 * Resolves every `ProjectCreateForm` string, since the projects lib takes
 * no translation keys. Lives in its own hook so the page stays about state
 * and submission; the hint and the too-large message name the configured
 * limits.
 */
export const useProjectCreateFormLabels = ({
  allowedExtensions,
  maxFileBytes,
}: ProjectCreateLabelLimits): ProjectCreateFormLabels => {
  const { t } = useTranslation();
  const refinement = useTextRefinementLabels();

  return useMemo<ProjectCreateFormLabels>(() => {
    const maxSize = formatFileSize(maxFileBytes);
    const extensions = allowedExtensions
      .map((extension) => `.${extension}`)
      .join(', ');

    return {
      title: t(ProjectsI18nKeys.CreateTitle),
      backLabel: t(ButtonsI18nKeys.Back),
      cancelLabel: t(ButtonsI18nKeys.Cancel),
      createLabel: t(ButtonsI18nKeys.Create),
      submittingLabel: t(ProjectsI18nKeys.CreateStatusCreating),
      nameLabel: t(ProjectsI18nKeys.CreateNameLabel),
      namePlaceholder: t(ProjectsI18nKeys.CreateNamePlaceholder),
      nameErrors: {
        [ProjectNameError.Required]: t(
          ProjectsI18nKeys.CreateErrorNameRequired,
        ),
        [ProjectNameError.InvalidCharacters]: t(
          ProjectsI18nKeys.CreateErrorNameInvalid,
        ),
        [ProjectNameError.Reserved]: t(
          ProjectsI18nKeys.CreateErrorNameReserved,
        ),
        [ProjectNameError.TooLong]: t(ProjectsI18nKeys.CreateErrorNameTooLong),
      },
      instructionsLabel: t(ProjectsI18nKeys.CreateInstructionsLabel),
      instructionsPlaceholder: t(
        ProjectsI18nKeys.CreateInstructionsPlaceholder,
      ),
      contextLabel: t(ProjectsI18nKeys.CreateContextLabel),
      dropZoneLabel: ({ fromDevice, fileManager }) =>
        createElement(Trans, {
          i18nKey: fileManager
            ? ProjectsI18nKeys.CreateContextDropZone
            : ProjectsI18nKeys.CreateContextDropZoneDeviceOnly,
          components: fileManager
            ? { device: fromDevice, manager: fileManager }
            : { device: fromDevice },
        }),
      dropZoneAriaLabel: t(ProjectsI18nKeys.CreateContextUploadFromDevice),
      dropZoneHint: t(ProjectsI18nKeys.CreateContextHint, {
        extensions,
        maxSize,
      }),
      dropOverlayTitle: t(ProjectsI18nKeys.CreateContextDropOverlayTitle),
      dropOverlaySubtitle: t(ProjectsI18nKeys.CreateContextDropOverlaySubtitle),
      removeFileLabel: (name) =>
        t(ProjectsI18nKeys.CreateContextRemove, { name }),
      openFileLabel: (name) => t(ProjectsI18nKeys.CreateContextOpen, { name }),
      fileRejections: {
        [ContextFileRejection.UnsupportedType]: (name) =>
          t(ProjectsI18nKeys.CreateErrorUnsupportedType, { name }),
        [ContextFileRejection.TooLarge]: (name) =>
          t(ProjectsI18nKeys.CreateErrorTooLarge, { name, maxSize }),
        [ContextFileRejection.CapacityExceeded]: (name) =>
          t(ProjectsI18nKeys.CreateErrorCapacityExceeded, { name }),
        [ContextFileRejection.Duplicate]: (name) =>
          t(ProjectsI18nKeys.CreateErrorDuplicate, { name }),
        [ContextFileRejection.InvalidName]: (name) =>
          t(ProjectsI18nKeys.CreateErrorInvalidFileName, { name }),
      },
      filesAddedStatus: (count) =>
        t(ProjectsI18nKeys.CreateStatusAdded, { count }),
      fileRemovedStatus: (name) =>
        t(ProjectsI18nKeys.CreateStatusRemoved, { name }),
      creatingStatus: t(ProjectsI18nKeys.CreateStatusCreating),
      refinement,
    };
  }, [t, refinement, allowedExtensions, maxFileBytes]);
};
