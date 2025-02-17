import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { isEntityIdExternal } from '@/src/utils/app/id';
import { isEntityIdPublic } from '@/src/utils/app/publications';

import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import { Translation } from '@/src/types/translation';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { ApplicationRow } from '@/src/components/Common/ReplaceConfirmationModal/Components';

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
          isChosen={chosenItemsIds.includes(entity.id)}
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
    </>
  );
};
