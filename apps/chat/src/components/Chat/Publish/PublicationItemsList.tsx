import { IconDownload } from '@tabler/icons-react';
import { useCallback, useEffect } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import { ApiUtils } from '@/src/utils/server/api';

import { ConversationInfo } from '@/src/types/chat';
import { Entity, FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { PublishActions } from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import {
  ConversationRow,
  FilesRow,
  PromptsRow,
} from '@/src/components/Common/ReplaceConfirmationModal/Components';

import Folder from '../../Folder/Folder';

interface Props {
  type: SharingType;
  entity: Entity;
  entities: Entity[];
  files: DialFile[];
  containerClassNames?: string;
  publishAction: PublishActions;
}

export function PublicationItemsList({
  type,
  entities,
  entity,
  files,
  containerClassNames,
  publishAction,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const { fullyChosenFolderIds, partialChosenFolderIds } = useAppSelector(
    (state) => PublicationSelectors.selectChosenFolderIds(state, entities),
  );
  const chosenItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );
  const promptFolders = useAppSelector(PromptsSelectors.selectFolders);
  const conversationFolders = useAppSelector(
    ConversationsSelectors.selectFolders,
  );

  useEffect(() => {
    dispatch(
      PublicationActions.selectItemsToPublish({
        ids: [...entities.map((e) => e.id), ...files.map((f) => f.id)],
      }),
    );

    return () => {
      dispatch(PublicationActions.resetItemsToPublish());
    };
  }, [dispatch, entities, files]);

  const handleSelect = useCallback(
    (ids: string[]) => {
      dispatch(
        PublicationActions.selectItemsToPublish({
          ids,
        }),
      );
    },
    [dispatch],
  );

  return (
    <div
      className={classNames(
        'flex w-full flex-col gap-[2px] overflow-y-visible md:max-w-[550px]',
        containerClassNames,
      )}
    >
      {(type === SharingType.Conversation ||
        type === SharingType.ConversationFolder) && (
        <>
          <CollapsibleSection
            togglerClassName="!text-sm !text-primary"
            name={t('Conversations')}
            openByDefault
            className="!pl-0"
            dataQa="conversations-to-send-request"
          >
            {type === SharingType.Conversation ? (
              <ConversationRow
                onSelect={handleSelect}
                itemComponentClassNames={classNames(
                  'group/conversation-item cursor-pointer',
                  publishAction === PublishActions.DELETE && 'text-error',
                )}
                item={entity as ConversationInfo}
                level={0}
                isChosen={chosenItemsIds.some((id) => id === entity.id)}
              />
            ) : (
              <Folder
                noCaretIcon
                level={0}
                currentFolder={entity as FolderInterface}
                allFolders={conversationFolders.filter((f) =>
                  entities.some((item) => item.id.startsWith(`${f.id}/`)),
                )}
                searchTerm={''}
                openedFoldersIds={conversationFolders.map((f) => f.id)}
                onSelectFolder={(folderId) => {
                  handleSelect(
                    entities
                      .filter(
                        (e) =>
                          e.id.startsWith(folderId) &&
                          (!partialChosenFolderIds.includes(folderId) ||
                            !chosenItemsIds.includes(e.id)),
                      )
                      .map((e) => e.id),
                  );
                }}
                allItems={entities}
                itemComponent={({ item, ...props }) => (
                  <ConversationRow
                    {...props}
                    item={item as ConversationInfo}
                    onSelect={handleSelect}
                    isChosen={chosenItemsIds.some((id) => id === item.id)}
                  />
                )}
                featureType={FeatureType.Chat}
                folderClassName="h-[38px]"
                itemComponentClassNames={classNames(
                  'group/conversation-item cursor-pointer',
                  publishAction === PublishActions.DELETE && 'text-error',
                )}
                additionalItemData={{
                  partialSelectedFolderIds: partialChosenFolderIds,
                  selectedFolderIds: fullyChosenFolderIds,
                }}
                showTooltip
                canSelectFolders
                isSelectAlwaysVisible
              />
            )}
          </CollapsibleSection>

          <CollapsibleSection
            togglerClassName="!text-sm !text-primary"
            name={t('Files')}
            openByDefault
            dataQa="files-to-send-request"
            className="!pl-0"
          >
            {files.length ? (
              files.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <FilesRow
                    itemComponentClassNames={classNames(
                      'group/file-item w-full cursor-pointer truncate',
                      publishAction === PublishActions.DELETE && 'text-error',
                    )}
                    key={f.id}
                    item={f}
                    level={0}
                    onSelect={handleSelect}
                    isChosen={chosenItemsIds.some((id) => id === f.id)}
                  />
                  <a
                    download={f.name}
                    href={constructPath('api', ApiUtils.encodeApiUrl(f.id))}
                  >
                    <IconDownload
                      className="shrink-0 text-secondary hover:text-accent-primary"
                      size={18}
                    />
                  </a>
                </div>
              ))
            ) : (
              <p className="pl-3.5 text-secondary">
                {type === SharingType.Conversation
                  ? t("This conversation doesn't contain any files")
                  : t("These conversations don't contain any files")}
              </p>
            )}
          </CollapsibleSection>
        </>
      )}
      {(type === SharingType.Prompt || type === SharingType.PromptFolder) && (
        <CollapsibleSection
          togglerClassName="!text-sm !text-primary"
          name={t('Prompts')}
          openByDefault
          dataQa="prompts-to-send-request"
          className="!pl-0"
        >
          {type === SharingType.Prompt ? (
            <PromptsRow
              onSelect={handleSelect}
              itemComponentClassNames={classNames(
                'group/prompt-item cursor-pointer',
                publishAction === PublishActions.DELETE && 'text-error',
              )}
              item={entity}
              level={0}
              isChosen={chosenItemsIds.some((id) => id === entity.id)}
            />
          ) : (
            <Folder
              readonly
              noCaretIcon
              level={0}
              currentFolder={entity as FolderInterface}
              allFolders={promptFolders.filter((f) =>
                entities.some((item) => item.id.startsWith(`${f.id}/`)),
              )}
              searchTerm={''}
              openedFoldersIds={promptFolders.map((f) => f.id)}
              allItems={entities}
              itemComponent={(props) => (
                <PromptsRow
                  {...props}
                  onSelect={handleSelect}
                  isChosen={chosenItemsIds.some((id) => id === props.item.id)}
                />
              )}
              featureType={FeatureType.Prompt}
              folderClassName="h-[38px]"
              itemComponentClassNames={classNames(
                'group/prompt-item cursor-pointer',
                publishAction === PublishActions.DELETE && 'text-error',
              )}
              additionalItemData={{
                partialSelectedFolderIds: partialChosenFolderIds,
                selectedFolderIds: fullyChosenFolderIds,
              }}
              showTooltip
              canSelectFolders
              isSelectAlwaysVisible
              onSelectFolder={(folderId) => {
                handleSelect(
                  entities
                    .filter(
                      (e) =>
                        e.id.startsWith(folderId) &&
                        (!partialChosenFolderIds.includes(folderId) ||
                          !chosenItemsIds.includes(e.id)),
                    )
                    .map((e) => e.id),
                );
              }}
            />
          )}
        </CollapsibleSection>
      )}
      {type === SharingType.Application && (
        <CollapsibleSection
          togglerClassName="!text-sm !text-primary"
          name={t('Applications')}
          openByDefault
          dataQa="applications-to-send-request"
          className="!pl-0"
        >
          <PromptsRow
            onSelect={handleSelect}
            itemComponentClassNames={classNames(
              'group/prompt-item cursor-pointer',
              publishAction === PublishActions.DELETE && 'text-error',
            )}
            item={entity}
            level={0}
            isChosen={chosenItemsIds.some((id) => id === entity.id)}
          />
        </CollapsibleSection>
      )}
    </div>
  );
}
