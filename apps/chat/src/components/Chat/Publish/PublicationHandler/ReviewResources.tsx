import { IconDownload } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import {
  isApplicationId,
  isConversationId,
  isFileId,
  isPromptId,
} from '@/src/utils/app/id';
import { constructPath } from '@/src/utils/app/shared-utils';
import { ApiUtils, getVersionFromId } from '@/src/utils/server/api';

import { DialFile } from '@/src/types/files';
import {
  PublicationResource,
  PublicationReviewItem,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  FilesSelectors,
  ModelsSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { NA_VERSION } from '@/src/constants/public';

import {
  ApplicationRow,
  ConversationRow,
  FilesRow,
  PromptsRow,
} from '@/src/components/Common/ReplaceConfirmationModal/Components';

import { PublicVersionSelector } from '../PublicVersionSelector';
import { FolderRow } from './ReviewRowItems/FolderRow';

import {
  ConversationInfo,
  FolderInterface,
  Prompt,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';

interface PublicationVersionInfoProps {
  item: PublicationReviewItem;
  publicVersionGroupId?: string;
}

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
  publicVersionGroupId,
}) => {
  const { t } = useTranslation(Translation.Chat);

  const isDeleteAction = item.publicationInfo?.action === PublishActions.DELETE;

  if (isApplicationId(item.id)) {
    return (
      <span
        className={classNames(
          'shrink-0 text-xs',
          isDeleteAction && 'text-error',
        )}
        data-qa="version"
      >
        {getVersionFromId(item.id)}
      </span>
    );
  }

  if (isFileId(item.id)) {
    return (
      <a
        download={item.name}
        href={constructPath('/api', ApiUtils.encodeApiUrl(item.id))}
        data-qa="download"
      >
        <IconDownload
          className="shrink-0 text-secondary hover:text-accent-primary"
          size={18}
        />
      </a>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {!isDeleteAction && publicVersionGroupId && (
        <PublicVersionSelector
          publicVersionGroupId={publicVersionGroupId}
          textBeforeSelector={t('Last: ')}
          btnClassNames="shrink-0"
          groupVersions
          readonly
        />
      )}
      <span
        className={classNames('text-xs', isDeleteAction && 'text-error')}
        data-qa="version"
      >
        {item.publicationInfo?.version || NA_VERSION}
      </span>
    </div>
  );
};

interface PublicationResourceItemProps {
  item: PublicationReviewItem;
}

const renderRowComponent = (
  item: PublicationReviewItem,
  commonProps: {
    featureContainerClassNames: string;
    itemComponentClassNames: string;
  },
) => {
  if (isApplicationId(item.id)) {
    return <ApplicationRow {...commonProps} item={item as ShareEntity} />;
  }

  if (isConversationId(item.id)) {
    return <ConversationRow {...commonProps} item={item as ConversationInfo} />;
  }

  if (isPromptId(item.id)) {
    return <PromptsRow {...commonProps} item={item as Prompt} />;
  }

  return <FilesRow {...commonProps} item={item as DialFile} />;
};

const PublicationResourceItem = ({
  item,
  ...props
}: PublicationResourceItemProps & Record<string, unknown>) => {
  const { publicVersionGroupId } = usePublicVersionGroupId(item);

  const commonProps = {
    ...props,
    featureContainerClassNames: 'w-full',
    itemComponentClassNames: 'w-full truncate cursor-pointer',
  };

  return (
    <div className="flex items-center justify-between gap-4">
      {renderRowComponent(item, commonProps)}
      <PublicationVersionInfo
        item={item}
        publicVersionGroupId={publicVersionGroupId}
      />
    </div>
  );
};

interface BasePublicationResources {
  resources: PublicationResource[];
  entities: ShareEntity[] | Prompt[] | ConversationInfo[] | DialFile[];
  folders: FolderInterface[];
  isEditMode: boolean;
}

const BasePublicationResources = ({
  resources,
  entities,
  folders,
  isEditMode,
}: BasePublicationResources) => {
  const {
    rootPublicationFolders,
    allPublicationFolders,
    itemsToDisplay,
    folderItemsToDisplay,
  } = usePublicationResources(folders, resources, entities);

  return (
    <>
      {rootPublicationFolders.map((folder) => (
        <FolderRow
          key={folder.id}
          currentFolder={folder}
          allFolders={allPublicationFolders}
          allItems={folderItemsToDisplay}
          itemComponent={PublicationResourceItem}
          level={0}
          isEditable={isEditMode}
          editedName={folder.name}
          onEdit={() => {
            // eslint-disable-next-line no-console
            console.log('edit');
          }}
        />
      ))}
      {itemsToDisplay.map((item) => (
        <PublicationResourceItem key={item.id} item={item} level={0} />
      ))}
    </>
  );
};

interface Props {
  resources: PublicationResource[];
  isEditMode: boolean;
}

export const PromptPublicationResources = ({
  resources,
  isEditMode,
}: Props) => {
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const allFolders = useAppSelector(PromptsSelectors.selectFolders);

  return (
    <BasePublicationResources
      resources={resources}
      entities={prompts}
      folders={allFolders}
      isEditMode={isEditMode}
    />
  );
};

export const ConversationPublicationResources = ({
  resources,
  isEditMode,
}: Props) => {
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);

  return (
    <BasePublicationResources
      resources={resources}
      entities={conversations}
      folders={allFolders}
      isEditMode={isEditMode}
    />
  );
};

export const FilePublicationResources = ({ resources }: Props) => {
  const files = useAppSelector(FilesSelectors.selectFiles);
  const allFolders = useAppSelector(FilesSelectors.selectFolders);

  return (
    <BasePublicationResources
      resources={resources}
      entities={files}
      folders={allFolders}
      isEditMode={false}
    />
  );
};

export const ApplicationPublicationResources = ({ resources }: Props) => {
  const publishRequestModels = useAppSelector(
    ModelsSelectors.selectPublishRequestModels,
  );

  const filteredApps = useMemo(() => {
    const resourcesIds = resources.map((resource) => resource.reviewUrl);

    return publishRequestModels.filter((model) =>
      resourcesIds.includes(model.id),
    );
  }, [publishRequestModels, resources]);

  return (
    <>
      {filteredApps.map((application) => (
        <PublicationResourceItem
          key={application.id}
          item={application}
          level={0}
        />
      ))}
    </>
  );
};
