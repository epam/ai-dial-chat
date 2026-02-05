import { useCallback, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useTranslation } from '@/src/hooks/useTranslation';

import { constructPath } from '@/src/utils/app/shared-utils';

import { Translation } from '@/src/types/translation';

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

  const handleFolderChange = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsChangeFolderModalOpened(true);
    },
    [],
  );

  const handleSelect = useCallback(
    (folderId?: string) => {
      setValue(
        PublishRequestFieldsNames.PUBLISH_TO_URL,
        constructPath(PUBLIC_URL_PREFIX, folderId),
      );
      setIsChangeFolderModalOpened(false);
      if (!folderId) {
        setValue(PublishRequestFieldsNames.RULES, []);
      }
    },
    [setValue],
  );

  return (
    <section className="mb-3">
      <h3 className="mb-1 flex text-xs text-secondary" data-qa="publish-label">
        {t('Publish to')}
      </h3>
      <div
        className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2"
        data-qa="change-path-container"
      >
        <div className="flex w-full justify-between truncate whitespace-pre break-all">
          <Tooltip
            tooltip={displayPublishToUrl}
            triggerClassName="truncate whitespace-pre"
            contentClassName="break-all"
            dataQa="path"
          >
            {displayPublishToUrl}
          </Tooltip>

          <DialLinkButton
            data-qa="change-button"
            onClick={handleFolderChange}
            label={t('Change')}
          />
        </div>
      </div>
      {isChangeFolderModalOpened && (
        <ChangePathDialog
          initiallySelectedFolderId={path}
          isOpen
          onClose={handleSelect}
          depth={maxDepth}
        />
      )}
    </section>
  );
};
