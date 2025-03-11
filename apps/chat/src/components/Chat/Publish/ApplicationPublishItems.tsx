import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdExternal } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { ApplicationRow } from '@/src/components/Common/ReplaceConfirmationModal/Components';

import { PublicationItem } from './PublicationItem';

import { PublishActions } from '@epam/ai-dial-shared';

interface ApplicationPublishItemsProps {
  entity: PublishRequestDialAIEntityModel;
  publishAction: PublishActions;
  chosenItemsIds: string[];
  path: string;
  handleSelectItems: (ids: string[]) => void;
}

export const ApplicationPublishItems = ({
  entity,
  publishAction,
  chosenItemsIds,
  path,
  handleSelectItems,
}: ApplicationPublishItemsProps) => {
  const { t } = useTranslation(Translation.Chat);

  return (
    <>
      <CollapsibleSection
        togglerClassName="!text-sm !text-primary"
        name={t('Applications')}
        openByDefault
        dataQa="applications-to-send-request"
        className="!pl-0"
      >
        <PublicationItem
          path={path}
          type={SharingType.Application}
          entity={entity}
          publishAction={publishAction}
        >
          <ApplicationRow
            onSelect={handleSelectItems}
            itemComponentClassNames={classNames(
              '!w-full cursor-pointer',
              publishAction === PublishActions.DELETE && 'text-error',
            )}
            featureContainerClassNames="!w-full"
            item={entity}
            level={0}
            isChosen={chosenItemsIds.includes(entity.id)}
          />
        </PublicationItem>
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
    </>
  );
};
