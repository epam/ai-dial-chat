import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { usePublicVersionGroupId } from '@/src/hooks/usePublicVersionGroupIdFromPublicEntity';
import { usePublicationResources } from '@/src/hooks/usePublicationResources';

import {
  isApplicationId,
  isConversationId,
  isPromptId,
} from '@/src/utils/app/id';

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

import {
  ApplicationRow,
  ConversationRow,
  FilesRow,
  PromptsRow,
} from '@/src/components/Common/ReplaceConfirmationModal/Components';
import { Folder } from '@/src/components/Folder/Folder';

import { PublicVersionSelector } from './PublicVersionSelector';

import {
  ConversationInfo,
  FolderInterface,
  Prompt,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';

interface PublicationResourceItemProps {
  item: ShareEntity | Prompt | ConversationInfo | DialFile;
}

const PublicationResourceItem = ({
  item,
  ...props
}: PublicationResourceItemProps & Record<string, unknown>) => {
  const { t } = useTranslation(Translation.Chat);

  const { publicVersionGroupId } = usePublicVersionGroupId(item);

  return (
    <div className="flex items-center justify-between gap-4">
      {isApplicationId(item.id) ? (
        <ApplicationRow
          {...props}
          item={item as ShareEntity}
          featureContainerClassNames="w-full"
          itemComponentClassNames="w-full truncate cursor-pointer"
        />
      ) : isConversationId(item.id) ? (
        <ConversationRow
          {...props}
          item={item as ConversationInfo}
          featureContainerClassNames="w-full"
          itemComponentClassNames="w-full truncate cursor-pointer"
        />
      ) : isPromptId(item.id) ? (
        <PromptsRow
          {...props}
          item={item as Prompt}
          featureContainerClassNames="w-full"
          itemComponentClassNames="w-full truncate cursor-pointer"
        />
      ) : (
        <FilesRow
          {...props}
          item={item as DialFile}
          featureContainerClassNames="w-full"
          itemComponentClassNames="w-full truncate cursor-pointer"
        />
      )}
      <div className="flex shrink-0 items-center gap-2">
        {item.publicationInfo?.action !== PublishActions.DELETE &&
          publicVersionGroupId && (
            <PublicVersionSelector
              publicVersionGroupId={publicVersionGroupId}
              textBeforeSelector={t('Last: ')}
              btnClassNames="shrink-0"
              groupVersions
              readonly
            />
          )}
        <span
          className={classNames(
            'text-xs',
            item.publicationInfo?.action === PublishActions.DELETE &&
              'text-error',
          )}
          data-qa="version"
        >
          {item.publicationInfo?.version || NA_VERSION}
        </span>
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
        <Folder
          readonly
          key={folder.id}
          noCaretIcon
          currentFolder={folder}
          allFolders={allPublicationFolders}
          openedFoldersIds={allPublicationFoldersIds}
          allItems={folderItemsToDisplay}
          itemComponent={PublicationResourceItem}
          featureType={featureType}
          folderClassName="h-[38px]"
          showTooltip
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
