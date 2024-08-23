import { IconDownload } from '@tabler/icons-react';
import {
  ChangeEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import { getRootId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { findLatestVersion } from '@/src/utils/app/publications';
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

import {
  DEFAULT_VERSION,
  NA_VERSION,
  PUBLIC_URL_PREFIX,
} from '@/src/constants/public';

import CollapsibleSection from '@/src/components/Common/CollapsibleSection';
import {
  ApplicationRow,
  ConversationRow,
  FilesRow,
  PromptsRow,
} from '@/src/components/Common/ReplaceConfirmationModal/Components';

import { Menu, MenuItem } from '../../Common/DropdownMenu';
import Tooltip from '../../Common/Tooltip';
import Folder from '../../Folder/Folder';

import ChevronDownIcon from '@/public/images/icons/chevron-down.svg';
import groupBy from 'lodash-es/groupBy';
import orderBy from 'lodash-es/orderBy';

interface PublicationItemProps {
  path: string;
  children: ReactNode;
  entityId: string;
  type: SharingType;
  publishAction: PublishActions;
  parentFolderNames?: string[];
  onChangeVersion: (id: string, version: string) => void;
}

function PublicationItem({
  path,
  children,
  entityId,
  type,
  publishAction,
  parentFolderNames = [],
  onChangeVersion,
}: PublicationItemProps) {
  const { t } = useTranslation(Translation.Chat);

  const [isVersionsOpen, setIsVersionsOpen] = useState(false);

  const selector =
    type === SharingType.Conversation || type === SharingType.ConversationFolder
      ? ConversationsSelectors
      : PromptsSelectors;

  const publicVersionGroups = useAppSelector(
    selector.selectPublicVersionGroups,
  );

  const [version, setVersion] = useState('');

  const handleVersionChange = (e: ChangeEvent<HTMLInputElement>) => {
    const versionParts = e.target.value.split('.');

    if (
      versionParts.length < 4 &&
      versionParts.filter(Boolean).every((part) => /^\d+$/.test(part))
    ) {
      setVersion(e.target.value);
      onChangeVersion(entityId, e.target.value);
    }
  };

  const allVersions = useMemo(
    () =>
      publicVersionGroups[
        constructPath(
          getRootId({
            featureType: EnumMapper.getFeatureTypeBySharingType(type),
            bucket: PUBLIC_URL_PREFIX,
          }),
          path,
          ...parentFolderNames,
          splitEntityId(entityId).name,
        )
      ]?.allVersions,
    [entityId, parentFolderNames, path, publicVersionGroups, type],
  );

  const latestVersion = useMemo(() => {
    if (allVersions) {
      return findLatestVersion(allVersions.map(({ version }) => version));
    }

    return undefined;
  }, [allVersions]);

  const latestSortedVersions = useMemo(() => {
    if (!allVersions) {
      return [];
    }

    const latestVersions = Object.values(
      groupBy(
        allVersions.map((a) => a.version),
        (version) => version.match(/^\d+\.\d+/),
      ),
    ).flatMap((group) => {
      const latestVersion = findLatestVersion(group);

      return latestVersion ? [latestVersion] : [];
    });

    return orderBy(
      latestVersions.filter((version) => version !== NA_VERSION),
      [(version) => version.split('.').map(Number)],
      ['desc'],
    );
  }, [allVersions]);

  useEffect(() => {
    const versionParts = latestVersion?.split('.');

    if (
      versionParts &&
      versionParts.length === 3 &&
      versionParts.filter(Boolean).every((part) => /^\d+$/.test(part))
    ) {
      versionParts[2] = String(+versionParts[2] + 1);
      setVersion(versionParts.join('.'));
      onChangeVersion(entityId, versionParts.join('.'));
    } else {
      setVersion(DEFAULT_VERSION);
      onChangeVersion(entityId, DEFAULT_VERSION);
    }
  }, [entityId, latestVersion, onChangeVersion]);

  const isVersionAllowed =
    !allVersions ||
    !allVersions.some((versionGroup) => version === versionGroup.version);

  return (
    <div className="flex w-full items-center gap-2">
      {children}
      {publishAction === PublishActions.ADD ? (
        <>
          {latestVersion &&
            (latestSortedVersions.length > 1 ? (
              <Menu
                type="contextMenu"
                placement="bottom-end"
                onOpenChange={setIsVersionsOpen}
                className="flex shrink-0 items-center"
                data-qa="model-version-select"
                trigger={
                  <div className="flex items-center text-secondary">
                    <span className="text-xs">
                      {t('Last: ')}
                      {latestVersion}
                    </span>
                    <ChevronDownIcon
                      className={classNames(
                        'shrink-0 text-primary transition-all',
                        isVersionsOpen && 'rotate-180',
                      )}
                      width={18}
                      height={18}
                    />
                  </div>
                }
              >
                {latestSortedVersions.map((version) => {
                  if (latestVersion === version || version === NA_VERSION) {
                    return null;
                  }

                  return (
                    <MenuItem
                      disabled
                      className="!cursor-default hover:bg-accent-primary-alpha"
                      item={<span>{version}</span>}
                      key={version}
                    />
                  );
                })}
              </Menu>
            ) : (
              <span className="shrink-0 text-xs">
                {t('Last: ')}
                {latestVersion}
              </span>
            ))}
          <Tooltip
            tooltip={t('This version already exists')}
            contentClassName="text-error text-xs"
            hideTooltip={isVersionAllowed}
          >
            <input
              value={version}
              onChange={handleVersionChange}
              placeholder={DEFAULT_VERSION}
              className={classNames(
                'm-0 h-[24px] w-[70px] border-b-[1px] bg-transparent p-1 text-right text-xs outline-none placeholder:text-secondary',
                isVersionAllowed
                  ? 'border-primary focus-visible:border-accent-primary'
                  : 'border-b-error',
              )}
            />
          </Tooltip>
        </>
      ) : (
        <span className="shrink-0 text-xs text-error">
          {allVersions?.find((version) => version.id === entityId)?.version ??
            NA_VERSION}
        </span>
      )}
    </div>
  );
}

interface Props {
  path: string;
  type: SharingType;
  entity: Entity;
  entities: Entity[];
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

export function PublicationItemsList({
  path,
  type,
  entities,
  entity,
  files,
  containerClassNames,
  publishAction,
  onChangeVersion,
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

  const additionalItemData = {
    partialSelectedFolderIds: partialChosenFolderIds,
    selectedFolderIds: fullyChosenFolderIds,
  };

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
              <div className="flex w-full items-center gap-2">
                <PublicationItem
                  path={path}
                  type={type}
                  entityId={entity.id}
                  onChangeVersion={onChangeVersion}
                  publishAction={publishAction}
                >
                  <ConversationRow
                    onSelect={handleSelectItems}
                    itemComponentClassNames={classNames(
                      'w-full cursor-pointer',
                    )}
                    item={entity as ConversationInfo}
                    level={0}
                    isChosen={chosenItemsIds.some((id) => id === entity.id)}
                  />
                </PublicationItem>
              </div>
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
                  <div className="flex w-full items-center gap-2">
                    <PublicationItem
                      parentFolderNames={getParentFolderNames(
                        item.id,
                        entity.id,
                        conversationFolders,
                      )}
                      path={path}
                      type={type}
                      entityId={item.id}
                      onChangeVersion={onChangeVersion}
                      publishAction={publishAction}
                    >
                      <ConversationRow
                        {...props}
                        itemComponentClassNames={classNames(
                          'w-full cursor-pointer',
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
                      publishAction === PublishActions.DELETE && 'text-error',
                    )}
                    key={f.id}
                    item={f}
                    level={0}
                    onSelect={handleSelectItems}
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
                {type === SharingType.Conversation ||
                (type === SharingType.ConversationFolder &&
                  entities.length === 1)
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
            <PublicationItem
              path={path}
              type={type}
              entityId={entity.id}
              onChangeVersion={onChangeVersion}
              publishAction={publishAction}
            >
              <PromptsRow
                onSelect={handleSelectItems}
                itemComponentClassNames={classNames(
                  'w-full cursor-pointer',
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
                <div className="flex w-full items-center gap-2">
                  <PublicationItem
                    parentFolderNames={getParentFolderNames(
                      item.id,
                      entity.id,
                      conversationFolders,
                    )}
                    path={path}
                    type={type}
                    entityId={item.id}
                    onChangeVersion={onChangeVersion}
                    publishAction={publishAction}
                  >
                    <PromptsRow
                      {...props}
                      item={item}
                      itemComponentClassNames={classNames(
                        'w-full cursor-pointer',
                        publishAction === PublishActions.DELETE && 'text-error',
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
      )}
    </div>
  );
}
