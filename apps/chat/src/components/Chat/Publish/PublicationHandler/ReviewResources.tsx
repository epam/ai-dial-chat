import { IconDownload } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';

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

import { FilesRow } from '@/src/components/Common/ReplaceConfirmationModal/Components';

import { PublicVersionSelector } from '../PublicVersionSelector';
import { PublicationApplicationRow } from './ReviewRowItems/PublicationApplicationRow';
import { PublicationConversationRow } from './ReviewRowItems/PublicationConversationRow';
import { PublicationFolderRow } from './ReviewRowItems/PublicationFolderRow';
import { PublicationPromptRow } from './ReviewRowItems/PublicationPromptRow';

import {
  ConversationInfo,
  FolderInterface,
  Prompt,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';

interface PublicationVersionInfoProps {
  item: PublicationReviewItem;
  isEditable: boolean;
  publicVersionGroupId: string | undefined;
}

const PublicationVersionInfo: React.FC<PublicationVersionInfoProps> = ({
  item,
  isEditable,
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
        {isEditable ? (
          <input
            className="h-[24px] w-[35px] border-b border-primary bg-layer-2 px-1 py-[2px] text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
            value={getVersionFromId(item.id)}
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
            onChange={() => {}}
          />
        ) : (
          getVersionFromId(item.id)
        )}
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
        className={classNames('pr-2 text-xs', isDeleteAction && 'text-error')}
        data-qa="version"
      >
        {isEditable ? (
          <input
            className="h-[24px] w-[35px] border-b border-primary bg-layer-2 px-1 py-[2px] text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
            value={item.publicationInfo?.version || NA_VERSION}
            onChange={() => {
              // eslint-disable-next-line no-console
              console.log('edit');
            }}
          />
        ) : (
          item.publicationInfo?.version || NA_VERSION
        )}
      </span>
    </div>
  );
};

interface PublicationResourceItemProps {
  item: PublicationReviewItem;
  editedName: string | undefined;
  level: number;
  isEditMode: boolean;
}

const renderRowComponent = (
  item: PublicationReviewItem,
  editedName: string | undefined,
  isEditMode: boolean,
  level: number,
  commonProps: {
    featureContainerClassNames: string;
    itemComponentClassNames: string;
  },
) => {
  if (isApplicationId(item.id)) {
    return (
      <PublicationApplicationRow
        {...commonProps}
        level={level}
        isEditable={isEditMode}
        editedName={editedName ?? item.name}
        application={item as ShareEntity}
      />
    );
  }

  if (isConversationId(item.id)) {
    return (
      <PublicationConversationRow
        {...commonProps}
        level={level}
        isEditable={isEditMode}
        editedName={editedName ?? item.name}
        conversation={item as ConversationInfo}
      />
    );
  }

  if (isPromptId(item.id)) {
    return (
      <PublicationPromptRow
        {...commonProps}
        level={level}
        isEditable={isEditMode}
        editedName={editedName ?? item.name}
        prompt={item as Prompt}
      />
    );
  }

  return <FilesRow {...commonProps} item={item as DialFile} />;
};

const PublicationResourceItem = ({
  item,
  editedName,
  isEditMode,
  level,
  ...props
}: PublicationResourceItemProps & Record<string, unknown>) => {
  const [isFocused, setIsFocused] = useState(false);

  const { publicVersionGroupId } = usePublicVersionGroupId(item);

  const commonProps = useMemo(
    () => ({
      ...props,
      featureContainerClassNames: 'w-full',
      itemComponentClassNames: 'w-full truncate cursor-pointer',
    }),
    [props],
  );

  const rowComponent = useMemo(
    () => renderRowComponent(item, editedName, isEditMode, level, commonProps),
    [item, editedName, isEditMode, level, commonProps],
  );

  return (
    <div
      className={classNames(
        'flex items-center justify-between gap-2 rounded hover:bg-accent-primary-alpha',
        isFocused && 'bg-accent-primary-alpha',
      )}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {rowComponent}
      <PublicationVersionInfo
        item={item}
        isEditable={isEditMode}
        publicVersionGroupId={publicVersionGroupId}
      />
    </div>
  );
};

interface Props {
  resources: PublicationResource[];
  isEditMode: boolean;
}

interface BasePublicationResources extends Props {
  entities: ShareEntity[] | Prompt[] | ConversationInfo[] | DialFile[];
  folders: FolderInterface[];
}

const BasePublicationResources: React.FC<BasePublicationResources> = ({
  resources,
  entities,
  folders,
  isEditMode,
}) => {
  const {
    rootPublicationFolders,
    allPublicationFolders,
    itemsToDisplay,
    folderItemsToDisplay,
  } = usePublicationResources(folders, resources, entities);

  const itemComponent = useCallback(
    (props: { item: PublicationReviewItem; level: number }) => (
      <PublicationResourceItem
        {...props}
        editedName={props.item.name}
        isEditMode={isEditMode}
      />
    ),
    [isEditMode],
  );

  return (
    <>
      {rootPublicationFolders.map((folder) => (
        <PublicationFolderRow
          key={folder.id}
          currentFolder={folder}
          allFolders={allPublicationFolders}
          allItems={folderItemsToDisplay}
          itemComponent={itemComponent}
          level={0}
          isEditable={isEditMode}
          editedName={folder.name}
        />
      ))}
      {itemsToDisplay.map((item) => (
        <PublicationResourceItem
          key={item.id}
          isEditMode={isEditMode}
          editedName={item.name}
          item={item}
          level={0}
        />
      ))}
    </>
  );
};

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

export const ApplicationPublicationResources = ({
  resources,
  isEditMode,
}: Props) => {
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
          isEditMode={isEditMode}
          editedName={application.name}
        />
      ))}
    </>
  );
};
