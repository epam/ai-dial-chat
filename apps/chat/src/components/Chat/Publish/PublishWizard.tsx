import { IconPlus, IconX } from '@tabler/icons-react';
import {
  ClipboardEvent,
  Fragment,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';
import { CLIENT_PUBLIC_FILES_PATH } from 'next/dist/shared/lib/constants';

import classNames from 'classnames';

import { constructPath } from '@/src/utils/app/file';
import { getRootId } from '@/src/utils/app/id';
import { createTargetUrl } from '@/src/utils/app/publications';
import { getAttachments } from '@/src/utils/app/share';
import { ApiUtils } from '@/src/utils/server/api';

import { Conversation } from '@/src/types/chat';
import { FeatureType, ShareEntity } from '@/src/types/common';
import { ModalState } from '@/src/types/modal';
import { PublishActions, TargetAudienceFilter } from '@/src/types/publication';
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

import compact from 'lodash-es/compact';
import flatMapDeep from 'lodash-es/flatMapDeep';
import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';

interface Props {
  entity: ShareEntity;
  entities: ShareEntity[];
  type: SharingType;
  isOpen: boolean;
  onClose: () => void;
  depth?: number;
}

export function PublishModal({
  entity,
  isOpen,
  onClose,
  type,
  depth,
  entities,
}: Props) {
  const { t } = useTranslation(Translation.Chat);

  const dispatch = useAppDispatch();

  const nameInputRef = useRef<HTMLInputElement>(null);

  const [publishRequestName, setPublishRequestName] = useState('');
  const [path, setPath] = useState('');
  const [isRuleSetterOpened, setIsRuleSetterOpened] = useState(false);
  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  const [otherTargetAudienceFilters, setOtherTargetAudienceFilters] = useState<
    TargetAudienceFilter[]
  >([]);

  const areSelectedConversationsLoaded = useAppSelector(
    ConversationsSelectors.selectAreSelectedConversationsLoaded,
  );
  const isRulesLoading = useAppSelector(
    PublicationSelectors.selectIsRulesLoading,
  );
  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(
      state,
      constructPath(CLIENT_PUBLIC_FILES_PATH, path),
    ),
  );
  const files = useAppSelector((state) =>
    getAttachments(type)(state, entity.id),
  );

  const notCurrentFolderRules = Object.entries(rules).filter(
    ([rulePath]) => constructPath(CLIENT_PUBLIC_FILES_PATH, path) !== rulePath,
  );
  const currentFolderRules =
    rules[constructPath(CLIENT_PUBLIC_FILES_PATH, path)];

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
      const folderRegExp = new RegExp(
        entity.folderId.split('/').slice(2).join('/'),
      );

      if (
        type === SharingType.Conversation ||
        type === SharingType.ConversationFolder
      ) {
        const mappedFiles = (entities as Conversation[])
          .filter((c) =>
            (c.playback?.messagesStack || c.messages).some(
              (m) => m.custom_content?.attachments,
            ),
          )
          .flatMap((c) => {
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
                    ...c.id.split('/').slice(0, -1),
                    ...decodedOldUrl.split('/').slice(-1),
                  ).replace(folderRegExp, ''),
                  type,
                ),
              };
            });
          });

        dispatch(
          PublicationActions.publish({
            name: trimmedName,
            targetFolder: constructPath(PUBLIC_URL_PREFIX, trimmedPath),
            resources: [
              ...entities.map((item) => ({
                sourceUrl: item.id,
                targetUrl: createTargetUrl(
                  FeatureType.Chat,
                  trimmedPath,
                  type === SharingType.ConversationFolder
                    ? item.id.replace(folderRegExp, '')
                    : item.id,
                  type,
                ),
              })),
              ...files.reduce<{ sourceUrl: string; targetUrl: string }[]>(
                (acc, file) => {
                  const decodedFileId = ApiUtils.decodeApiUrl(file.id);
                  const item = mappedFiles.find(
                    (f) => f.oldUrl === decodedFileId,
                  );

                  if (item) {
                    acc.push({
                      sourceUrl: decodedFileId,
                      targetUrl: item.newUrl,
                    });
                  }

                  return acc;
                },
                [],
              ),
            ],
            rules: preparedFilters.map((filter) => ({
              function: filter.filterFunction,
              source: filter.id,
              targets: filter.filterParams,
            })),
          }),
        );
      } else {
        dispatch(
          PublicationActions.publish({
            name: trimmedName,
            resources: [
              ...entities.map((item) => ({
                sourceUrl: item.id,
                targetUrl: createTargetUrl(
                  FeatureType.Prompt,
                  trimmedPath,
                  type === SharingType.PromptFolder
                    ? item.id.replace(folderRegExp, '')
                    : item.id,
                  type,
                ),
              })),
            ],
            targetFolder: constructPath(PUBLIC_URL_PREFIX, trimmedPath),
            rules: preparedFilters.map((filter) => ({
              function: filter.filterFunction,
              source: filter.id,
              targets: filter.filterParams,
            })),
          }),
        );
      }

      onClose();
    },
    [
      currentFolderRules,
      dispatch,
      entities,
      entity.folderId,
      files,
      onClose,
      otherTargetAudienceFilters,
      path,
      publishRequestName,
      type,
    ],
  );

  useEffect(() => {
    if (areSelectedConversationsLoaded && entities.length === 0) {
      dispatch(
        UIActions.showErrorToast(
          t('chat.publish.no_valid_items_to_publish.text'),
        ),
      );
      onClose();
    }
  }, [areSelectedConversationsLoaded, dispatch, entities.length, onClose, t]);

  return (
    <Modal
      portalId="theme-main"
      containerClassName={classNames(
        'publish-wizard-modal group/modal flex min-w-full max-w-[1100px] md:h-[747px] md:min-w-[550px] lg:min-w-[1000px] xl:w-[1100px]',
        { 'w-full': files.length },
      )}
      dataQa="publish-modal"
      state={isOpen ? ModalState.OPENED : ModalState.CLOSED}
      onClose={onClose}
      initialFocus={nameInputRef}
    >
      <div className="flex w-full flex-col divide-y divide-secondary overflow-y-auto">
        <div className="px-3 py-4 md:pl-4 md:pr-10">
          <input
            autoFocus
            onChange={(e) => setPublishRequestName(e.target.value)}
            value={publishRequestName}
            placeholder={t('chat.publish.publication_request_name.text') ?? ''}
            className="w-full bg-transparent text-base font-semibold outline-none"
          />
        </div>
        <div className="flex min-h-0 grow flex-col divide-y divide-secondary overflow-y-auto md:flex-row md:divide-x md:divide-y-0">
          <div className="flex w-full shrink flex-col divide-y divide-secondary md:max-w-[550px] md:overflow-y-auto">
            <section className="flex flex-col gap-3 px-3 py-4 md:px-5">
              <div>
                <label
                  className="mb-4 flex text-sm font-medium"
                  htmlFor="requestPath"
                >
                  {t('chat.publish.publish_to.label')}
                </label>
                <button className="input-form mx-0 flex grow cursor-default items-center justify-between rounded-primary border border-secondary bg-layer-2 px-3 py-2 shadow-primary placeholder:text-tertiary-bg-light focus-within:border-accent-quaternary hover:border-accent-quaternary">
                  <div className="flex w-full justify-between truncate whitespace-pre break-all">
                    <Tooltip
                      tooltip={constructPath(t(PUBLISHING_FOLDER_NAME), path)}
                      contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
                      triggerClassName="truncate whitespace-pre"
                    >
                      {constructPath(t(PUBLISHING_FOLDER_NAME), path)}
                    </Tooltip>
                    <span
                      className="cursor-pointer text-tertiary-bg-light"
                      onClick={handleFolderChange}
                    >
                      {t('chat.publish.button.change.label')}
                    </span>
                  </div>
                </button>
              </div>
            </section>

            <section className="flex h-full flex-col overflow-y-auto px-3 py-4 md:px-5">
              <h2 className="mb-4 flex gap-2 font-medium">
                {t('chat.publish.allow_access_if_all_match.label')}
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
                  <div className="mb-1 text-xs text-secondary-bg-light">
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
                                  <span className="italic">
                                    {t('chat.publish.or.label')}
                                  </span>
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
                            className="mr-3 shrink-0 cursor-pointer text-secondary-bg-light"
                          />
                        </div>
                        <span className="text-xs italic text-secondary-bg-light">
                          {t('chat.publish.or.label')}
                        </span>
                      </div>
                    ))}
                    {!isRuleSetterOpened && (
                      <button
                        onClick={() => setIsRuleSetterOpened(true)}
                        className="flex h-[31px] w-9 items-center justify-center rounded bg-accent-primary-alpha text-3xl font-thin text-secondary-bg-light outline-none"
                      >
                        <IconPlus stroke="1" size={18} />
                      </button>
                    )}
                    {!!otherTargetAudienceFilters.length && (
                      <IconX
                        size={18}
                        stroke="2"
                        onClick={() => setOtherTargetAudienceFilters([])}
                        className="absolute right-3 top-[10.5px] cursor-pointer text-secondary-bg-light"
                      />
                    )}
                  </div>
                </div>
              )}
              {!path && (
                <p>
                  {t(
                    'chat.publish.the_publication_will_be_available_to_all_users.text',
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
          {areSelectedConversationsLoaded ? (
            <PublicationItemsList
              type={type}
              entity={entity}
              entities={entities}
              path={path}
              files={files}
              containerClassNames="px-3 py-4 md:px-5 md:overflow-y-auto"
              publishAction={PublishActions.ADD}
            />
          ) : (
            <div className="flex w-full items-center justify-center">
              <Spinner size={48} dataQa="publication-items-spinner" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-3 py-4 md:px-6">
          <Tooltip
            hideTooltip={!!publishRequestName.trim().length}
            tooltip={t('chat.publish.name_for_publish_request.text')}
          >
            <button
              className="button button-primary button-medium py-2"
              onClick={handlePublish}
              data-qa="publish"
              disabled={!publishRequestName.trim().length || isRuleSetterOpened}
            >
              {t('chat.publish.button.send_request.label')}
            </button>
          </Tooltip>
        </div>
      </div>
      <ChangePathDialog
        initiallySelectedFolderId={entity.id}
        isOpen={isChangeFolderModalOpened}
        onClose={(folderId) => {
          if (typeof folderId === 'string') {
            setPath(folderId);
          }

          setIsChangeFolderModalOpened(false);
        }}
        type={type}
        depth={depth}
        rootFolderId={getRootId({
          featureType:
            type === SharingType.Conversation ||
            type === SharingType.ConversationFolder
              ? FeatureType.Chat
              : FeatureType.Prompt,
          bucket: PUBLIC_URL_PREFIX,
        })}
      />
    </Modal>
  );
}
