import React, { useCallback, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { publishToUrlToOrganizationFolderId } from '@/src/utils/app/publications';
import { constructPath } from '@/src/utils/app/shared-utils';

import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { FilesSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChangePathDialog } from '../ChangePathDialog';
import { PublicationRequestFormData, PublishRequestFieldsNames } from './form';

import { DialLinkButton } from '@epam/ai-dial-ui-kit';

interface Props {
  maxDepth: number;
  displayPublishToUrl: string;
}

export const PublishToSection = ({ maxDepth, displayPublishToUrl }: Props) => {
  const { t } = useTranslation(Translation.Chat);

  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);

  const { setValue } = useFormContext<PublicationRequestFormData>();
  const path = useWatch<
    PublicationRequestFormData,
    typeof PublishRequestFieldsNames.PUBLISH_TO_URL
  >({
    name: PublishRequestFieldsNames.PUBLISH_TO_URL,
  });

  const folders = useAppSelector(FilesSelectors.selectFolders);

  const handleFolderChange = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsChangeFolderModalOpened(true);
    },
    [],
  );

  const handleSelect = useCallback(
    (folderId: string | false) => {
      setIsChangeFolderModalOpened(false);

      if (folderId === false) {
        if (path && path !== PUBLIC_URL_PREFIX) {
          const folderIdToCheck = publishToUrlToOrganizationFolderId(path);
          const exists = folders.some((f) => f.id === folderIdToCheck);
          if (!exists) {
            setValue(
              PublishRequestFieldsNames.PUBLISH_TO_URL,
              PUBLIC_URL_PREFIX,
              { shouldDirty: true },
            );
            setValue(PublishRequestFieldsNames.RULES, []);
          }
        }
        return;
      }

      const targetId = folderId || undefined;

      setValue(
        PublishRequestFieldsNames.PUBLISH_TO_URL,
        constructPath(PUBLIC_URL_PREFIX, targetId),
        { shouldDirty: true },
      );

      if (!targetId) {
        setValue(PublishRequestFieldsNames.RULES, []);
      }
    },
    [setValue, path, folders],
  );

  return (
    <section className="mb-3">
      <h3 className="mb-1 flex text-xs text-secondary" data-qa="publish-label">
        {t(ChatI18nKeys.PublishTo)}
      </h3>
      <div
        className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2"
        data-qa="change-path-container"
      >
        <div className="flex w-full min-w-0 items-center justify-between">
          <Tooltip
            tooltip={displayPublishToUrl}
            triggerClassName="truncate whitespace-pre block min-w-0 text-start"
            contentClassName="break-all"
            dataQa="path"
          >
            {displayPublishToUrl}
          </Tooltip>

          <DialLinkButton
            className="shrink-0"
            data-qa="change-button"
            onClick={handleFolderChange}
            label={t(ChatI18nKeys.Change)}
          />
        </div>
      </div>
      {isChangeFolderModalOpened && (
        <ChangePathDialog
          initiallySelectedFolderId={path}
          isOpen
          onClose={handleSelect}
          depth={maxDepth}
          onRenamePath={(newPath) => {
            setValue(
              PublishRequestFieldsNames.PUBLISH_TO_URL,
              constructPath(PUBLIC_URL_PREFIX, newPath),
              { shouldDirty: true },
            );
          }}
        />
      )}
    </section>
  );
};
