import { IconPlus, IconX } from '@tabler/icons-react';
import {
  ClipboardEvent,
  Fragment,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

import { isVersionValid } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import {
  getIdWithoutRootPathSegments,
  getRootId,
  isEntityIdExternal,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { createTargetUrl, isEntityPublic } from '@/src/utils/app/publications';
import { NotReplayFilter } from '@/src/utils/app/search';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { FeatureType } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { PublishRequestDialAIEntityModel } from '@/src/types/models';
import {
  PublicationRequestModel,
  TargetAudienceFilter,
} from '@/src/types/publication';
import { SharingType } from '@/src/types/share';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { PUBLISHING_FOLDER_NAME } from '@/src/constants/folders';
import { PUBLIC_URL_PREFIX } from '@/src/constants/public';

import { ChangePathDialog } from '@/src/components/Chat/ChangePathDialog';
import Modal from '@/src/components/Common/Modal';
import Tooltip from '@/src/components/Common/Tooltip';

import { Spinner } from '../../Common/Spinner';
import { PublicationItemsList } from './PublicationItemsList';
import { RuleListItem } from './RuleListItem';
import { TargetAudienceFilterComponent } from './TargetAudienceFilterComponent';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';
import compact from 'lodash-es/compact';
import flatMapDeep from 'lodash-es/flatMapDeep';
import isEqual from 'lodash-es/isEqual';
import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';

interface Props<
  T extends Conversation | ShareEntity | PublishRequestDialAIEntityModel,
> {
  entity: T;
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
  publishAction: PublishActions;
  entities?: T[];
  depth?: number;
  defaultPath?: string;
}

export function PublishModal<
  T extends Conversation | ShareEntity | PublishRequestDialAIEntityModel,
>({
  entity,
  isOpen,
  onClose,
  type,
  depth,
  entities,
  publishAction,
  defaultPath,
}: Props<T>) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const nameInputRef = useRef<HTMLInputElement>(null);

  const [publishRequestName, setPublishRequestName] = useState('');
  const [path, setPath] = useState(defaultPath ?? '');
  const [isRuleSetterOpened, setIsRuleSetterOpened] = useState(false);
  const [isSomeVersionInvalid, setIsSomeVersionInvalid] = useState(false);
  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  const [otherTargetAudienceFilters, setOtherTargetAudienceFilters] = useState<
    TargetAudienceFilter[]
  >([]);

  const versionsRef = useRef<Record<string, string | undefined>>({});

  const areConversationsWithContentUploading = useAppSelector(
    ConversationsSelectors.selectAreConversationsWithContentUploading,
  );
  const isRulesLoading = useAppSelector(
    PublicationSelectors.selectIsRulesLoading,
  );
  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(
      state,
      constructPath(PUBLIC_URL_PREFIX, path),
    ),
  );
  const files = useAppSelector((state) =>
    ConversationsSelectors.getAttachments(state, entity.id, NotReplayFilter),
  );
  const selectedItemsIds = useAppSelector(
    PublicationSelectors.selectSelectedItemsToPublish,
  );

  const filteredFiles = useMemo(() => {
    if (publishAction === PublishActions.DELETE) {
      return files.filter((file) => isEntityPublic(file));
    }

    return files;
  }, [files, publishAction]);

  const notCurrentFolderRules = useMemo(
    () =>
      Object.entries(rules).filter(
        ([rulePath]) => constructPath(PUBLIC_URL_PREFIX, path) !== rulePath,
      ),
    [path, rules],
  );
  const currentFolderRules = useMemo(
    () => rules[constructPath(PUBLIC_URL_PREFIX, path)],
    [path, rules],
  );
  const entitiesArray = useMemo(
    () => (entities ? entities : [entity]),
    [entities, entity],
  );
  const publicRootIdSegment = useMemo(
    () =>
      getRootId({
        featureType: EnumMapper.getFeatureTypeBySharingType(type),
        bucket: PUBLIC_URL_PREFIX,
      }),
    [type],
  );

  useEffect(() => {
    if (path) {
      dispatch(PublicationActions.uploadRules({ path }));
    }
  }, [dispatch, path]);

  useEffect(() => {
    if (currentFolderRules) {
      setOtherTargetAudienceFilters(
        currentFolderRules.map((rule) => ({
          id: rule.source,
          filterFunction: rule.function,
          filterParams: rule.targets,
        })),
      );
    }
  }, [currentFolderRules]);

  useEffect(() => {
    if (!areConversationsWithContentUploading && entitiesArray.length === 0) {
      dispatch(
        UIActions.showErrorToast(t('There are no valid items to publish')),
      );

      onClose();
    }
  }, [
    publishAction,
    areConversationsWithContentUploading,
    dispatch,
    entitiesArray.length,
    onClose,
    t,
  ]);

  const handleFolderChange = useCallback(() => {
    setIsChangeFolderModalOpened(true);
  }, []);

  const handleOnSaveFilter = useCallback(
    (targetFilter: TargetAudienceFilter) => {
      setOtherTargetAudienceFilters((prev) =>
        prev.filter(({ id }) => id !== targetFilter.id).concat(targetFilter),
      );
      setIsRuleSetterOpened(false);
    },
    [],
  );

  const handlePublish = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const folderOldPathPartsRegExp = new RegExp(
        getIdWithoutRootPathSegments(entity.folderId),
      );

      const trimmedPath = path.trim();
      const trimmedName = publishRequestName.trim();
      const notEmptyFilters = otherTargetAudienceFilters.filter(
        (filter) =>
          // TODO: uncomment when it will be supported on core
          // filter.filterFunction === PublicationFunctions.False ||
          // filter.filterFunction === PublicationFunctions.True ||
          filter.filterParams.filter((param) => Boolean(param.trim())).length,
      );
      const preparedFilters = currentFolderRules
        ? otherTargetAudienceFilters.map((rule) => ({
            filterFunction: rule.filterFunction,
            filterParams: rule.filterParams,
            id: rule.id,
          }))
        : notEmptyFilters;
      const conversationEntities = entitiesArray.filter(
        (conv) =>
          'messages' in conv &&
          (conv.playback?.messagesStack || conv.messages).some(
            (m) => m.custom_content?.attachments,
          ),
      ) as Conversation[];
      const mappedFiles = conversationEntities.flatMap((c) => {
        const urls = compact(
          flatMapDeep(c.playback?.messagesStack || c.messages, (m) =>
            m.custom_content?.attachments?.map((a) => a.url),
          ),
        );

        return urls.map((oldUrl) => {
          const decodedOldUrl = ApiUtils.decodeApiUrl(oldUrl);

          return {
            oldUrl: decodedOldUrl,
            newUrl: createTargetUrl(
              FeatureType.File,
              trimmedPath,
              constructPath(
                getFolderIdFromEntityId(c.id),
                ...decodedOldUrl.split('/').slice(-1),
              ).replace(folderOldPathPartsRegExp, ''),
              type,
            ),
          };
        });
      });

      const selectedEntities = entitiesArray.filter((e) =>
        selectedItemsIds.includes(e.id),
      );
      const selectedFiles = filteredFiles.filter((f) =>
        selectedItemsIds.includes(f.id),
      );

      dispatch(
        PublicationActions.publish({
          name: trimmedName,
          targetFolder: constructPath(PUBLIC_URL_PREFIX, trimmedPath),
          resources: [
            ...(publishAction === PublishActions.DELETE
              ? selectedEntities.map((entity) => ({
                  targetUrl: entity.id,
                  action: publishAction,
                }))
              : selectedEntities.map((item) => ({
                  action: publishAction,
                  sourceUrl: item.id,
                  targetUrl: createTargetUrl(
                    type === SharingType.ConversationFolder ||
                      type === SharingType.Conversation
                      ? FeatureType.Chat
                      : type === SharingType.Application
                        ? FeatureType.Application
                        : FeatureType.Prompt,
                    trimmedPath,
                    type === SharingType.ConversationFolder ||
                      type === SharingType.PromptFolder
                      ? item.id.replace(folderOldPathPartsRegExp, '')
                      : item.id,
                    type,
                    versionsRef.current[item.id],
                  ),
                }))),
            ...(publishAction === PublishActions.DELETE
              ? selectedFiles.map((f) => ({
                  action: publishAction,
                  targetUrl: ApiUtils.decodeApiUrl(f.id),
                }))
              : selectedFiles.reduce<PublicationRequestModel['resources']>(
                  (acc, file) => {
                    const decodedFileId = ApiUtils.decodeApiUrl(file.id);
                    const item = mappedFiles.find(
                      (f) => f.oldUrl === decodedFileId,
                    );

                    if (item) {
                      acc.push({
                        action: publishAction,
                        sourceUrl: decodedFileId,
                        targetUrl: item.newUrl,
                      });
                    }

                    return acc;
                  },
                  [],
                )),
            ...(type === SharingType.Application &&
            'iconUrl' in entity &&
            entity.iconUrl &&
            !isEntityIdExternal({ id: entity.iconUrl })
              ? [
                  {
                    action: publishAction,
                    targetUrl: ApiUtils.decodeApiUrl(
                      constructPath(
                        entity.iconUrl.split('/')[0],
                        PUBLIC_URL_PREFIX,
                        trimmedPath,
                        getIdWithoutRootPathSegments(entity.folderId),
                        entity.iconUrl.split('/').at(-1),
                      ),
                    ),
                    sourceUrl:
                      publishAction === PublishActions.DELETE
                        ? undefined
                        : ApiUtils.decodeApiUrl(entity.iconUrl),
                  },
                ]
              : []),
          ],
          rules: preparedFilters.map((filter) => ({
            function: filter.filterFunction,
            source: filter.id,
            targets: filter.filterParams,
          })),
        }),
      );

      onClose();
    },
    [
      currentFolderRules,
      dispatch,
      entitiesArray,
      entity,
      filteredFiles,
      onClose,
      otherTargetAudienceFilters,
      path,
      publishAction,
      publishRequestName,
      selectedItemsIds,
      type,
    ],
  );

  const handleChangeVersion = useCallback((id: string, version: string) => {
    versionsRef.current = { ...versionsRef.current, [id]: version };

    const isInvalid = Object.values(versionsRef.current).some((version) => {
      if (isVersionValid(version)) {
        return false;
      }

      return true;
    });

    setIsSomeVersionInvalid(isInvalid);
  }, []);

  const handleClose = useCallback((folderId?: string) => {
    if (typeof folderId === 'string') {
      setPath(folderId);
    }

    setIsChangeFolderModalOpened(false);
  }, []);

  const isNothingSelectedAndNoRuleChanges =
    !selectedItemsIds.length &&
    (isEqual(
      otherTargetAudienceFilters.map((filter) => ({
        function: filter.filterFunction,
        source: filter.id,
        targets: filter.filterParams,
      })),
      currentFolderRules,
    ) ||
      !path ||
      (!otherTargetAudienceFilters.length && !currentFolderRules));
  const isSendBtnDisabled =
    !publishRequestName.trim().length ||
    isRuleSetterOpened ||
    isNothingSelectedAndNoRuleChanges ||
    isSomeVersionInvalid ||
    areConversationsWithContentUploading;
  const isSendBtnTooltipHidden =
    !!publishRequestName.trim().length &&
    !isRuleSetterOpened &&
    !isNothingSelectedAndNoRuleChanges &&
    !isSomeVersionInvalid;

  const getTooltipText = () => {
    if (!publishRequestName.trim().length) {
      return t('Enter a name for the publish request');
    }

    if (isRuleSetterOpened) {
      return t('Accept or reject rule changes');
    }

    if (isSomeVersionInvalid) {
      return t('All versions should be valid');
    }

    return t('Nothing is selected and rules have not changed');
  };

  return (
    <Modal
      portalId="theme-main"
      containerClassName={classNames(
        'group/modal flex min-w-full max-w-[1100px] !bg-layer-2 md:h-[747px] md:min-w-[550px] lg:min-w-[1000px] xl:w-[1100px]',
        filteredFiles.length && 'w-full',
      )}
      dataQa="publish-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      initialFocus={nameInputRef}
    >
      <div className="flex w-full flex-col divide-y divide-tertiary overflow-y-auto">
        <div className="px-3 py-4 md:pl-4 md:pr-10">
          <input
            autoFocus
            onChange={(e) => setPublishRequestName(e.target.value)}
            value={publishRequestName}
            placeholder={
              publishAction === PublishActions.ADD
                ? t('Type publication request name...') ?? ''
                : t('Type unpublish request name...') ?? ''
            }
            className="w-full bg-transparent text-base font-semibold outline-none"
            data-qa="request-name"
          />
        </div>
        <div className="flex min-h-0 grow flex-col divide-y divide-tertiary overflow-y-auto md:flex-row md:divide-x md:divide-y-0">
          <div className="flex w-full shrink flex-col divide-y divide-tertiary md:max-w-[550px] md:overflow-y-auto">
            <section className="px-3 py-4 md:px-5">
              <h3 className="mb-4 flex text-sm">
                {publishAction === PublishActions.DELETE
                  ? t('Unpublish from')
                  : t('Publish to')}
              </h3>
              <button
                className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2"
                data-qa="change-path-container"
              >
                <div className="flex w-full justify-between truncate whitespace-pre break-all">
                  <Tooltip
                    tooltip={constructPath(PUBLISHING_FOLDER_NAME, path)}
                    contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
                    triggerClassName="truncate whitespace-pre"
                    dataQa="path"
                  >
                    {constructPath(PUBLISHING_FOLDER_NAME, path)}
                  </Tooltip>
                  {publishAction !== PublishActions.DELETE && (
                    <span
                      className="h-full cursor-pointer text-accent-primary"
                      data-qa="change-button"
                      onClick={handleFolderChange}
                    >
                      {t('Change')}
                    </span>
                  )}
                </div>
              </button>
            </section>

            <section className="flex h-full flex-col overflow-y-auto px-3 py-4 md:px-5">
              <h2 className="mb-4 flex gap-2">
                {t('Allow access if all match')}
              </h2>
              {isRulesLoading ? (
                <div className="flex size-full items-center justify-center">
                  <Spinner size={48} dataQa="publication-items-spinner" />
                </div>
              ) : (
                notCurrentFolderRules.map(([path, rules]) => (
                  <RuleListItem key={path} path={path} rules={rules} />
                ))
              )}
              {!isRulesLoading && path && (
                <div>
                  <div className="mb-1 text-xs text-secondary">
                    {path.split('/').pop()}
                  </div>
                  <div className="relative mb-2 flex h-auto min-h-[39px] w-full flex-wrap items-center gap-1 rounded border-[1px] border-primary px-1 py-[3px] pr-10">
                    {otherTargetAudienceFilters.map((item) => (
                      <div className="flex items-center gap-1" key={item.id}>
                        <div className="flex min-h-[31px] items-center justify-center break-all rounded bg-accent-primary-alpha text-xs">
                          <div className="flex flex-wrap gap-1 px-3 py-2 leading-3">
                            <span className="font-semibold">
                              {startCase(toLower(item.id))}
                            </span>
                            <span className="italic">
                              {toLower(item.filterFunction)}
                            </span>
                            {item.filterParams.map((param, index) => (
                              <Fragment key={index}>
                                {index > 0 && (
                                  <span className="italic">{t('or')}</span>
                                )}
                                <span className="font-semibold">{param}</span>
                              </Fragment>
                            ))}
                          </div>
                          <IconX
                            size={18}
                            stroke="1"
                            onClick={() =>
                              setOtherTargetAudienceFilters((prev) =>
                                prev.filter(({ id }) => id !== item.id),
                              )
                            }
                            className="mr-3 shrink-0 cursor-pointer text-secondary"
                          />
                        </div>
                        <span className="text-xs italic text-secondary">
                          {t('or')}
                        </span>
                      </div>
                    ))}
                    {!isRuleSetterOpened && (
                      <button
                        onClick={() => setIsRuleSetterOpened(true)}
                        className="flex h-[31px] w-9 items-center justify-center rounded bg-accent-primary-alpha text-3xl font-thin text-secondary outline-none"
                      >
                        <IconPlus stroke="1" size={18} />
                      </button>
                    )}
                    {!!otherTargetAudienceFilters.length && (
                      <IconX
                        size={18}
                        stroke="2"
                        onClick={() => setOtherTargetAudienceFilters([])}
                        className="absolute right-3 top-[10.5px] cursor-pointer text-secondary"
                      />
                    )}
                  </div>
                </div>
              )}
              {!path && (
                <p className="text-secondary">
                  {t(
                    'This publication will be available to all users in the organization',
                  )}
                </p>
              )}

              {isRuleSetterOpened && path && (
                <TargetAudienceFilterComponent
                  onCloseFilter={() => setIsRuleSetterOpened(false)}
                  onSaveFilter={handleOnSaveFilter}
                />
              )}
            </section>
          </div>
          {!areConversationsWithContentUploading ? (
            <PublicationItemsList
              type={type}
              path={path}
              entity={entity}
              entities={entitiesArray}
              files={filteredFiles}
              containerClassNames="px-3 py-4 md:px-5 md:overflow-y-auto"
              publishAction={publishAction}
              onChangeVersion={handleChangeVersion}
            />
          ) : (
            <div className="flex w-full items-center justify-center">
              <Spinner size={48} dataQa="publication-items-spinner" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-3 py-4 md:px-6">
          <Tooltip
            hideTooltip={isSendBtnTooltipHidden}
            tooltip={getTooltipText()}
          >
            <button
              className="button button-primary py-2"
              onClick={handlePublish}
              data-qa="publish"
              disabled={isSendBtnDisabled}
            >
              {t('Send request')}
            </button>
          </Tooltip>
        </div>
      </div>
      <ChangePathDialog
        initiallySelectedFolderId={entity.id}
        isOpen={isChangeFolderModalOpened}
        onClose={handleClose}
        type={type}
        depth={depth}
        rootFolderId={publicRootIdSegment}
      />
    </Modal>
  );
}
