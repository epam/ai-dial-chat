import { IconDownload } from '@tabler/icons-react';
import { memo, useCallback, useEffect, useMemo } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/shared-utils';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { DialFile } from '@/src/types/files';
import { FolderInterface } from '@/src/types/folder';
import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsSelectors } from '@/src/store/prompts/prompts.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import { ApplicationPublishItems } from '@/src/components/Chat/Publish/ApplicationPublishItems';
import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import {
  ConversationRow,
  FilesRow,
  PromptsRow,
} from '@/src/components/Common/ReplaceConfirmationModal/Components';
import Folder from '@/src/components/Folder/Folder';

import { PublicationItem } from './PublicationItem';

import {
  ConversationInfo,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';

interface Props<
  T extends Conversation | ShareEntity | PublishRequestDialAIEntityModel,
> {
  path: string;
  type: SharingType;
  entity: T;
  entities: T[];
  files: DialFile[];
  containerClassNames?: string;
  publishAction: PublishActions;
  onChangeVersion: (id: string, version: string) => void;
}

const getParentFolderNames = (
  itemId: string,
  rootFolderId: string,
  folders: FolderInterface[],
) =>
  folders
    .filter(
      (folder) =>
        itemId.startsWith(`${folder.id}/`) &&
        rootFolderId.length <= folder.id.length,
    )
    .sort((a, b) => a.id.length - b.id.length)
    .map((folder) => splitEntityId(folder.id).name);

export const PublicationItemsList = memo(
  <T extends Conversation | ShareEntity | PublishRequestDialAIEntityModel>({
    path,
    type,
    entities,
    entity,
    files,
    containerClassNames,
    publishAction,
    onChangeVersion,
  }: Props<T>) => {
    const { t } = useTranslation(Translation.Chat);

    const dispatch = useAppDispatch();

    const promptFolders = useAppSelector(PromptsSelectors.selectFolders);
    const conversationFolders = useAppSelector(
      ConversationsSelectors.selectFolders,
    );

    const memoizedItems = useMemo(
      () => [...promptFolders, ...conversationFolders],
      [conversationFolders, promptFolders],
    );

    const { fullyChosenFolderIds, partialChosenFolderIds } = useAppSelector(
      (state) =>
        PublicationSelectors.selectChosenFolderIds(
          state,
          memoizedItems,
          entities,
        ),
    );
    const chosenItemsIds = useAppSelector(
      PublicationSelectors.selectSelectedItemsToPublish,
    );

    useEffect(() => {
      dispatch(
        PublicationActions.setItemsToPublish({
          ids: [
            ...entities.map((e) => e.id),
            // TODO: remove after figuring out how to check related conversations
            ...(publishAction !== PublishActions.DELETE
              ? files.map((f) => f.id)
              : []),
          ],
        }),
      );
    }, [dispatch, entities, files, publishAction]);

    const handleSelectItems = useCallback(
      (ids: string[]) => {
        dispatch(
          PublicationActions.selectItemsToPublish({
            ids,
          }),
        );
      },
      [dispatch],
    );

    const handleSelectFolder = useCallback(
      (folderId: string) => {
        handleSelectItems(
          entities
            .filter(
              (e) =>
                e.id.startsWith(folderId) &&
                (!partialChosenFolderIds.includes(folderId) ||
                  !chosenItemsIds.includes(e.id)),
            )
            .map((e) => e.id),
        );
      },
      [chosenItemsIds, entities, handleSelectItems, partialChosenFolderIds],
    );

    const additionalItemData = useMemo(
      () => ({
        partialSelectedFolderIds: partialChosenFolderIds,
        selectedFolderIds: fullyChosenFolderIds,
      }),
      [fullyChosenFolderIds, partialChosenFolderIds],
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
                <PublicationItem
                  path={path}
                  type={type}
                  entity={entity}
                  onChangeVersion={onChangeVersion}
                  publishAction={publishAction}
                >
                  <ConversationRow
                    onSelect={handleSelectItems}
                    itemComponentClassNames={classNames(
                      'w-full cursor-pointer truncate',
                      publishAction === PublishActions.DELETE && 'text-error',
                    )}
                    item={entity as ConversationInfo}
                    level={0}
                    isChosen={chosenItemsIds.some((id) => id === entity.id)}
                  />
                </PublicationItem>
              ) : (
                <Folder
                  readonly
                  noCaretIcon
                  level={0}
                  currentFolder={entity as FolderInterface}
                  allFolders={conversationFolders.filter((f) =>
                    entities.some((item) => item.id.startsWith(`${f.id}/`)),
                  )}
                  searchTerm=""
                  openedFoldersIds={conversationFolders.map((f) => f.id)}
                  onSelectFolder={handleSelectFolder}
                  allItems={entities}
                  itemComponent={({ item, ...props }) => (
                    <div className="flex w-full items-center">
                      <PublicationItem
                        parentFolderNames={getParentFolderNames(
                          item.id,
                          entity.id,
                          conversationFolders,
                        )}
                        path={path}
                        type={type}
                        entity={item}
                        onChangeVersion={onChangeVersion}
                        publishAction={publishAction}
                      >
                        <ConversationRow
                          {...props}
                          itemComponentClassNames={classNames(
                            'w-full cursor-pointer truncate',
                            publishAction === PublishActions.DELETE &&
                              'text-error',
                          )}
                          item={item as ConversationInfo}
                          onSelect={handleSelectItems}
                          isChosen={chosenItemsIds.some((id) => id === item.id)}
                        />
                      </PublicationItem>
                    </div>
                  )}
                  featureType={FeatureType.Chat}
                  folderClassName="h-[38px]"
                  additionalItemData={additionalItemData}
                  showTooltip
                  canSelectFolders
                  isSelectAlwaysVisible
                />
              )}
            </CollapsibleSection>

            {publishAction !== PublishActions.DELETE && (
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
                          'w-full cursor-pointer truncate',
                          // @ts-expect-error delete is impossible right now
                          publishAction === PublishActions.DELETE &&
                            'text-error',
                        )}
                        key={f.id}
                        item={f}
                        level={0}
                        onSelect={handleSelectItems}
                        isChosen={chosenItemsIds.some((id) => id === f.id)}
                      />
                      <a
                        download={f.name}
                        href={constructPath('/api', f.id)}
                        data-qa="download"
                      >
                        <IconDownload
                          className="shrink-0 text-secondary hover:text-accent-primary"
                          size={18}
                        />
                      </a>
                    </div>
                  ))
                ) : (
                  <p
                    className="pl-3.5 text-secondary"
                    data-qa="no-publishing-files"
                  >
                    {type === SharingType.Conversation ||
                    (type === SharingType.ConversationFolder &&
                      entities.length === 1)
                      ? t("This conversation doesn't contain any files")
                      : t("These conversations don't contain any files")}
                  </p>
                )}
              </CollapsibleSection>
            )}
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
              <PublicationItem
                path={path}
                type={type}
                entity={entity}
                onChangeVersion={onChangeVersion}
                publishAction={publishAction}
              >
                <PromptsRow
                  onSelect={handleSelectItems}
                  itemComponentClassNames={classNames(
                    'w-full cursor-pointer truncate',
                    publishAction === PublishActions.DELETE && 'text-error',
                  )}
                  item={entity}
                  level={0}
                  isChosen={chosenItemsIds.some((id) => id === entity.id)}
                />
              </PublicationItem>
            ) : (
              <Folder
                readonly
                noCaretIcon
                level={0}
                currentFolder={entity as FolderInterface}
                allFolders={promptFolders.filter((f) =>
                  entities.some((item) => item.id.startsWith(`${f.id}/`)),
                )}
                searchTerm=""
                openedFoldersIds={promptFolders.map((f) => f.id)}
                allItems={entities}
                itemComponent={({ item, ...props }) => (
                  <div className="flex w-full items-center">
                    <PublicationItem
                      parentFolderNames={getParentFolderNames(
                        item.id,
                        entity.id,
                        promptFolders,
                      )}
                      path={path}
                      type={type}
                      entity={item}
                      onChangeVersion={onChangeVersion}
                      publishAction={publishAction}
                    >
                      <PromptsRow
                        {...props}
                        item={item}
                        itemComponentClassNames={classNames(
                          'w-full cursor-pointer truncate',
                          publishAction === PublishActions.DELETE &&
                            'text-error',
                        )}
                        onSelect={handleSelectItems}
                        isChosen={chosenItemsIds.some((id) => id === item.id)}
                      />
                    </PublicationItem>
                  </div>
                )}
                featureType={FeatureType.Prompt}
                folderClassName="h-[38px]"
                additionalItemData={additionalItemData}
                showTooltip
                canSelectFolders
                isSelectAlwaysVisible
                onSelectFolder={handleSelectFolder}
              />
            )}
          </CollapsibleSection>
        )}
        {type === SharingType.Application && (
          <ApplicationPublishItems
            path={path}
            entity={entity as PublishRequestDialAIEntityModel}
            handleSelectItems={handleSelectItems}
            publishAction={publishAction}
            chosenItemsIds={chosenItemsIds}
          />
        )}
      </div>
    );
  },
);
PublicationItemsList.displayName = 'PublicationItemsList';
