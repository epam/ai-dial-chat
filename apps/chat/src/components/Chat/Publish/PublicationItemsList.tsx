import { IconAlertCircle, IconDownload } from '@tabler/icons-react';
import {
  ChangeEvent,
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { findLatestVersion, isVersionValid } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/folders';
import { getIdWithoutRootPathSegments, getRootId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';

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

import Tooltip from '../../Common/Tooltip';
import Folder from '../../Folder/Folder';
import { PublicVersionSelector } from './PublicVersionSelector';

import {
  ConversationInfo,
  PublishActions,
  ShareEntity,
} from '@epam/ai-dial-shared';

interface PublicationItemProps {
  path: string;
  children: ReactNode;
  entity: ShareEntity;
  type: SharingType;
  publishAction: PublishActions;
  parentFolderNames?: string[];
  onChangeVersion: (id: string, version: string) => void;
}

function PublicationItem({
  path,
  children,
  entity,
  type,
  publishAction,
  parentFolderNames = [],
  onChangeVersion,
}: PublicationItemProps) {
  const { t } = useTranslation(Translation.Chat);

  const [isVersionInvalid, setIsVersionInvalid] = useState(false);
  const [version, setVersion] = useState('');

  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );

  const handleVersionChange = (e: ChangeEvent<HTMLInputElement>) => {
    const versionParts = e.target.value.split('.');

    if (
      versionParts.length < 4 &&
      versionParts.filter(Boolean).every((part) => /^\d+$/.test(part))
    ) {
      setVersion(e.target.value);
      onChangeVersion(entity.id, e.target.value);
    }
  };

  const constructedPublicId = constructPath(
    getRootId({
      featureType: EnumMapper.getFeatureTypeBySharingType(type),
      bucket: PUBLIC_URL_PREFIX,
    }),
    path,
    ...parentFolderNames,
    splitEntityId(entity.id).name,
  );

  const allVersions = useMemo(
    () => publicVersionGroups[constructedPublicId]?.allVersions,
    [constructedPublicId, publicVersionGroups],
  );

  const latestVersion = useMemo(() => {
    if (allVersions) {
      return findLatestVersion(allVersions.map(({ version }) => version));
    }

    return undefined;
  }, [allVersions]);

  useEffect(() => {
    const versionParts = latestVersion?.split('.');

    if (versionParts && isVersionValid(latestVersion)) {
      versionParts[2] = String(+versionParts[2] + 1);
      setVersion(versionParts.join('.'));
      onChangeVersion(entity.id, versionParts.join('.'));
    } else {
      setVersion(DEFAULT_VERSION);
      onChangeVersion(entity.id, DEFAULT_VERSION);
    }
  }, [entity.id, latestVersion, onChangeVersion]);

  const isVersionAllowed =
    !allVersions ||
    !allVersions.some((versionGroup) => version === versionGroup.version);

  const handleBlur = () => {
    if (!isVersionValid(version)) {
      setIsVersionInvalid(true);
    }
  };

  return (
    <div className="flex w-full items-center gap-2">
      {children}
      {publishAction !== PublishActions.DELETE ? (
        <>
          <PublicVersionSelector
            textBeforeSelector={t('Last: ')}
            publicVersionGroupId={constructPath(
              getRootId({
                featureType: EnumMapper.getFeatureTypeBySharingType(type),
                bucket: PUBLIC_URL_PREFIX,
              }),
              path,
              getIdWithoutRootPathSegments(entity.id),
            )}
            readonly
            groupVersions
          />
          <div className="relative">
            {!isVersionAllowed ||
              (isVersionInvalid && (
                <Tooltip
                  tooltip={
                    !isVersionAllowed
                      ? t('This version already exists')
                      : t(
                          'Version format is invalid (example: {{defaultVersion}})',
                          {
                            defaultVersion: DEFAULT_VERSION,
                          },
                        )
                  }
                  contentClassName="text-error text-xs"
                  triggerClassName="pl-0.5 absolute text-error top-1/2 -translate-y-1/2"
                >
                  <IconAlertCircle size={14} />
                </Tooltip>
              ))}
            <input
              onBlur={handleBlur}
              onFocus={() => setIsVersionInvalid(false)}
              value={version}
              onChange={handleVersionChange}
              placeholder={DEFAULT_VERSION}
              className={classNames(
                'm-0 h-[24px] w-[70px] border-b-[1px] bg-transparent p-1 pl-[18px] text-right text-xs outline-none placeholder:text-secondary',
                isVersionAllowed
                  ? 'border-primary focus-visible:border-accent-primary'
                  : 'border-b-error',
                isVersionInvalid && 'border-b-error',
              )}
              data-qa="version"
            />
          </div>
        </>
      ) : (
        <span className="shrink-0 text-xs text-error">
          {entity.publicationInfo?.version ?? NA_VERSION}
        </span>
      )}
    </div>
  );
}

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
          ids: [...entities.map((e) => e.id), ...files.map((f) => f.id)],
        }),
      );
    }, [dispatch, entities, files]);

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
                      href={constructPath('api', f.id)}
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
  },
);
PublicationItemsList.displayName = 'PublicationItemsList';
