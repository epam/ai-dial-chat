import { useCallback, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { useTranslation } from 'next-i18next';

import { constructPath } from '@/src/utils/app/shared-utils';

import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { Tooltip } from '@/src/components/Common/Tooltip';

import { ChangePathDialog } from '../ChangePathDialog';
import { PublicationRequestFormData, PublishRequestFieldsNames } from './form';

interface Props {
  maxDepth: number;
}

export const PublishToSection = ({ maxDepth }: Props) => {
  const { t } = useTranslation();

  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);

  const { setValue, watch } = useFormContext<PublicationRequestFormData>();
  const path = watch(PublishRequestFieldsNames.PUBLISH_TO_URL);

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
            tooltip={path}
            triggerClassName="truncate whitespace-pre"
            contentClassName="break-all"
            dataQa="path"
          >
            {path}
          </Tooltip>

          <button
            className="h-full cursor-pointer text-accent-primary"
            data-qa="change-button"
            onClick={handleFolderChange}
          >
            {t('Change')}
          </button>
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
