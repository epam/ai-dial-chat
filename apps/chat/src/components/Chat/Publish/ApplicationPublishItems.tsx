import { IconDownload } from '@tabler/icons-react';
import { useEffect, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getQuickAppDocumentUrl } from '@/src/utils/app/application';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import { isEntityIdExternal } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import { ApplicationSelectors } from '@/src/store/application/application.reducers';
import { FilesActions, FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import {
  ApplicationRow,
  FilesRow,
} from '@/src/components/Common/ReplaceConfirmationModal/Components';
import { Spinner } from '@/src/components/Common/Spinner';

import { PublishActions } from '@epam/ai-dial-shared';

interface ApplicationPublishItemsProps {
  entity: PublishRequestDialAIEntityModel;
  handleSelectItems: (ids: string[]) => void;
  publishAction: PublishActions;
  chosenItemsIds: string[];
}

export const ApplicationPublishItems = ({
  entity,
  handleSelectItems,
  publishAction,
  chosenItemsIds,
}: ApplicationPublishItemsProps) => {
  const { t } = useTranslation(Translation.Chat);
  const dispatch = useAppDispatch();

  const applicationDetails = useAppSelector(
    ApplicationSelectors.selectApplicationDetail,
  );
  const isApplicationLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
  );
  const areFilesLoading = useAppSelector(FilesSelectors.selectAreFilesLoading);
  const files = useAppSelector(FilesSelectors.selectFiles);

  const quickAppDocumentUrl = getQuickAppDocumentUrl(applicationDetails);
  const quickAppDocument = useMemo(
    () => files.find((file) => file.id === quickAppDocumentUrl),
    [files, quickAppDocumentUrl],
  );

  useEffect(() => {
    if (quickAppDocumentUrl) {
      const { apiKey, bucket, parentPath } = splitEntityId(quickAppDocumentUrl);
      dispatch(
        FilesActions.getFiles({
          id: constructPath(apiKey, bucket, parentPath),
        }),
      );
    }
  }, [dispatch, quickAppDocumentUrl]);

  return (
    <>
      <CollapsibleSection
        togglerClassName="!text-sm !text-primary"
        name={t('Applications')}
        openByDefault
        dataQa="applications-to-send-request"
        className="!pl-0"
      >
        <ApplicationRow
          onSelect={handleSelectItems}
          itemComponentClassNames={classNames(
            'cursor-pointer',
            publishAction === PublishActions.DELETE && 'text-error',
          )}
          item={entity}
          level={0}
          isChosen={chosenItemsIds.some((id) => id === entity.id)}
        />
      </CollapsibleSection>

      {publishAction === PublishActions.ADD &&
        'iconUrl' in entity &&
        entity.iconUrl &&
        isEntityIdExternal({ id: entity.iconUrl }) && (
          <CollapsibleSection
            togglerClassName="!text-sm !text-primary"
            name={t('Files')}
            openByDefault
            dataQa="files-to-send-request"
            className="!pl-0"
          >
            <ErrorMessage
              type="warning"
              error={t(
                `The icon used for this application is in the "${isEntityIdPublic({ id: entity.iconUrl }) ? 'Organization' : 'Shared with me'}" section and cannot be published. Please replace the icon, otherwise the application will be published with the default one.`,
              )}
            />
          </CollapsibleSection>
        )}

      {(isApplicationLoading || areFilesLoading) && (
        <div className="pl-3">
          <Spinner size={20} dataQa="publication-items-spinner" />
        </div>
      )}

      {!isApplicationLoading && quickAppDocument && (
        <CollapsibleSection
          name={t('Files')}
          openByDefault
          dataQa="files-to-send-request"
        >
          <div className="flex items-center gap-2">
            <FilesRow
              itemComponentClassNames={classNames(
                'w-full cursor-pointer truncate',
                publishAction === PublishActions.DELETE && 'text-error',
              )}
              item={quickAppDocument}
              level={0}
              onSelect={handleSelectItems}
              isChosen={chosenItemsIds.some((id) => id === quickAppDocument.id)}
            />
            <a
              download={quickAppDocument.name}
              href={constructPath('api', quickAppDocument.id)}
              data-qa="download"
            >
              <IconDownload
                className="shrink-0 text-secondary hover:text-accent-primary"
                size={18}
              />
            </a>
          </div>
        </CollapsibleSection>
      )}
    </>
  );
};
