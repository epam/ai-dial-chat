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
import { getVersionFromId } from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { PublicationResource } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  FilesSelectors,
  ModelsSelectors,
  PromptsSelectors,
} from '@/src/store/selectors';

import { NA_VERSION } from '@/src/constants/public';

import { FolderRow } from '@/src/components/Common/FolderRow';
import {
  ApplicationRow,
  ConversationRow,
  FilesRow,
  PromptsRow,
} from '@/src/components/Common/ReplaceConfirmationModal/Components';

import { PublicVersionSelector } from '../PublicVersionSelector';

import {
  ConversationInfo,
  FolderInterface,
  Prompt,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';

type ItemType = ShareEntity | Prompt | ConversationInfo | DialFile;

interface PublicationVersionInfoProps {
  item: ItemType;
  publicVersionGroupId?: string;
}

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
  publicVersionGroupId,
}) => {
  const { t } = useTranslation(Translation.Chat);

  if (isApplicationId(item.id)) {
    return getVersionFromId(item.id);
  }

  if (isFileId(item.id)) {
    return (
      <a
        download={props.item.name}
        href={constructPath('/api', ApiUtils.encodeApiUrl(props.item.id))}
        data-qa="download"
      >
        <IconDownload
          className="shrink-0 text-secondary hover:text-accent-primary"
          size={18}
        />
      </a>
    );
  }

  const isDeleteAction = item.publicationInfo?.action === PublishActions.DELETE;

  return (
    <>
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
    </>
  );
};

interface PublicationResourceItemProps {
  item: ItemType;
}

const renderRowComponent = (
  item: ItemType,
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
      <div className="flex shrink-0 items-center gap-2">
        <PublicationVersionInfo
          item={item}
          publicVersionGroupId={publicVersionGroupId}
        />
      </div>
    </div>
  );
};

interface BasePublicationResources {
  featureType: FeatureType;
  resources: PublicationResource[];
  entities: ShareEntity[] | Prompt[] | ConversationInfo[] | DialFile[];
  folders: FolderInterface[];
}

const BasePublicationResources = ({
  featureType,
  resources,
  entities,
  folders,
}: BasePublicationResources) => {
  const {
    rootPublicationFolders,
    allPublicationFolders,
    allPublicationFoldersIds,
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
          openedFoldersIds={allPublicationFoldersIds}
          allItems={folderItemsToDisplay}
          itemComponent={PublicationResourceItem}
          featureType={featureType}
          level={0}
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
}

export const PromptPublicationResources = ({ resources }: Props) => {
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const allFolders = useAppSelector(PromptsSelectors.selectFolders);

  return (
    <BasePublicationResources
      featureType={FeatureType.Prompt}
      resources={resources}
      entities={prompts}
      folders={allFolders}
    />
  );
};

export const ConversationPublicationResources = ({ resources }: Props) => {
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const allFolders = useAppSelector(ConversationsSelectors.selectFolders);

  return (
    <BasePublicationResources
      featureType={FeatureType.Chat}
      resources={resources}
      entities={conversations}
      folders={allFolders}
    />
  );
};

export const FilePublicationResources = ({ resources }: Props) => {
  const files = useAppSelector(FilesSelectors.selectFiles);
  const allFolders = useAppSelector(FilesSelectors.selectFolders);

  return (
    <BasePublicationResources
      featureType={FeatureType.File}
      resources={resources}
      entities={files}
      folders={allFolders}
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
