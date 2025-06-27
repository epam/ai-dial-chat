import {
  ClipboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getLastPathSegment, isVersionValid } from '@/src/utils/app/common';
import { constructPath } from '@/src/utils/app/file';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import {
  getIdWithoutRootPathSegments,
  getRootId,
  isApplicationId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import {
  createTargetUrl,
  getApplicationPublishResources,
  getPublicationDefaultName,
  isEntityIdPublic,
  mapFilterToRule,
  mapRuleToFilter,
} from '@/src/utils/app/publications';
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

import {
  ApplicationActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ApplicationSelectors,
  AuthSelectors,
  ConversationsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';
import { ORGANIZATION_SECTION_NAME } from '@/src/constants/sections';

import { ChangePathDialog } from '@/src/components/Chat/ChangePathDialog';
import { RulesInput } from '@/src/components/Chat/Publish/RulesInput';
import { Field } from '@/src/components/Common/Forms/Field';
import { Modal } from '@/src/components/Common/Modal';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { PublicationInfoSection } from './PublicationInfoSection';
import { PublicationItemsList } from './PublicationItemsList';
import { RuleListItem } from './RuleListItem';
import { PublicationRequestFormData, validators } from './form';

import { PublishActions, ShareEntity } from '@epam/ai-dial-shared';
import compact from 'lodash-es/compact';
import flatMapDeep from 'lodash-es/flatMapDeep';
import isEqual from 'lodash-es/isEqual';

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

  const [path, setPath] = useState(defaultPath ?? '');
  const [isRuleSetterOpened, setIsRuleSetterOpened] = useState(false);
  const [isSomeVersionInvalid, setIsSomeVersionInvalid] = useState(false);
  const [isChangeFolderModalOpened, setIsChangeFolderModalOpened] =
    useState(false);
  const [otherTargetAudienceFilters, setOtherTargetAudienceFilters] = useState<
    TargetAudienceFilter[]
  >([]);
  const userName = useAppSelector(AuthSelectors.selectUserName);

  const versionsRef = useRef<Record<string, string | undefined>>({});

  const areConversationsWithContentUploading = useAppSelector(
    ConversationsSelectors.selectAreConversationsWithContentUploading,
  );
  const isApplicationLoading = useAppSelector(
    ApplicationSelectors.selectIsApplicationLoading,
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

  const applicationId = isApplicationId(entity?.id) ? entity.id : null;

  const filteredFiles = useMemo(() => {
    if (publishAction === PublishActions.DELETE) {
      return files.filter((file) => isEntityIdPublic(file));
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

  const {
    register,
    handleSubmit: submitWrapper,
    formState: { errors, isValid },
    trigger,
  } = useForm<PublicationRequestFormData>({
    defaultValues: {
      publishRequestName: getPublicationDefaultName(userName),
      publicationAuthor: userName ?? '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (path) {
      dispatch(PublicationActions.uploadRules({ path }));
    }
  }, [dispatch, path]);

  useEffect(() => {
    if (applicationId && isOpen) {
      dispatch(ApplicationActions.get({ applicationId }));
    }
  }, [applicationId, dispatch, isOpen]);

  useEffect(() => {
    if (currentFolderRules) {
      setOtherTargetAudienceFilters(currentFolderRules.map(mapRuleToFilter));
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

  useEffect(() => {
    trigger();
  }, [trigger]);

  const handleFolderChange = useCallback(
    (e: MouseEvent<HTMLButtonElement> | ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsChangeFolderModalOpened(true);
    },
    [],
  );

  const handlePublish = useCallback(
    (data: PublicationRequestFormData) => {
      const folderOldPathPartsRegExp = new RegExp(
        getIdWithoutRootPathSegments(entity.folderId),
      );

      const trimmedPath = path.trim();
      const trimmedPublishRequestName = data.publishRequestName.trim();
      const trimmedPublicationAuthor = data.publicationAuthor.trim();
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
          name: trimmedPublishRequestName,
          displayAuthor: trimmedPublicationAuthor,
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
                    } else {
                      acc.push({
                        action: publishAction,
                        sourceUrl: decodedFileId,
                        targetUrl: ApiUtils.decodeApiUrl(
                          constructPath(
                            file.id.split('/')[0],
                            PUBLIC_URL_PREFIX,
                            trimmedPath,
                            getIdWithoutRootPathSegments(entity.folderId),
                            file.id.split('/').at(-1),
                          ),
                        ),
                      });
                    }

                    return acc;
                  },
                  [],
                )),
            ...(type === SharingType.Application
              ? getApplicationPublishResources({
                  entity: entity as PublishRequestDialAIEntityModel,
                  path: trimmedPath,
                  publishAction,
                })
              : []),
          ],
          rules: preparedFilters.map(mapFilterToRule),
        }),
      );

      onClose();
    },
    [
      entity,
      path,
      otherTargetAudienceFilters,
      currentFolderRules,
      entitiesArray,
      filteredFiles,
      dispatch,
      publishAction,
      type,
      onClose,
      selectedItemsIds,
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
    !isValid ||
    isRuleSetterOpened ||
    isNothingSelectedAndNoRuleChanges ||
    isSomeVersionInvalid ||
    areConversationsWithContentUploading ||
    isApplicationLoading;
  const isSendBtnTooltipHidden =
    isValid &&
    !isRuleSetterOpened &&
    !isNothingSelectedAndNoRuleChanges &&
    !isSomeVersionInvalid;

  const tooltipText = useMemo(() => {
    if (!isValid && !!errors.publishRequestName?.message) {
      return t('Enter a valid name for the publish request');
    }

    if (!isValid && !!errors.publicationAuthor?.message) {
      return t("Enter a valid publication's author name");
    }

    if (isRuleSetterOpened) {
      return t('Accept or reject rule changes');
    }

    if (isSomeVersionInvalid) {
      return t('All versions should be valid');
    }

    return t('Nothing is selected and rules have not changed');
  }, [
    isValid,
    errors.publishRequestName?.message,
    errors.publicationAuthor?.message,
    isRuleSetterOpened,
    isSomeVersionInvalid,
    t,
  ]);

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
      initialFocus={1}
    >
      <form
        onSubmit={submitWrapper(handlePublish)}
        className="flex w-full flex-col divide-y divide-tertiary overflow-y-auto"
      >
        <div className="py-4 pl-3 pr-10 md:pl-4">
          <Field
            className="border-none p-0 text-base font-semibold"
            {...register('publishRequestName', validators.publishRequestName)}
            placeholder={
              publishAction === PublishActions.ADD
                ? t('Type publication request name...')
                : t('Type unpublish request name...')
            }
            id="publishRequestName"
            error={errors.publishRequestName?.message}
            dataQa="request-name"
          />
        </div>
        <div className="flex min-h-0 grow flex-col divide-y divide-tertiary overflow-y-auto md:flex-row md:divide-x md:divide-y-0">
          <div className="flex w-full shrink flex-col divide-y divide-tertiary md:max-w-[550px] md:overflow-y-auto">
            <div className="flex w-full shrink flex-col px-3 py-4 md:px-5">
              <h2 className="mb-4 font-semibold">{t('General info')}</h2>
              {publishAction !== PublishActions.DELETE ? (
                <section className="mb-3">
                  <h3 className="mb-1 flex text-xs text-secondary">
                    {t('Publish to')}
                  </h3>
                  <div
                    className="input-form button mx-0 flex grow cursor-default items-center border-primary px-3 py-2"
                    data-qa="change-path-container"
                  >
                    <div className="flex w-full justify-between truncate whitespace-pre break-all">
                      <Tooltip
                        tooltip={constructPath(ORGANIZATION_SECTION_NAME, path)}
                        contentClassName="sm:max-w-[400px] max-w-[250px] break-all"
                        triggerClassName="truncate whitespace-pre"
                        dataQa="path"
                      >
                        {constructPath(ORGANIZATION_SECTION_NAME, path)}
                      </Tooltip>

                      <button
                        className="h-full cursor-pointer text-accent-primary"
                        data-qa="change-button"
                        onClick={handleFolderChange}
                      >
                        {t('Change')}
                      </button>
                    </div>
                  </div>
                </section>
              ) : (
                <PublicationInfoSection
                  labelDataQa={'unpublish-from-label'}
                  label={t('Unpublish from')}
                  valueDataQa={'unpublish-from-path'}
                  valueToDisplay={constructPath(
                    ORGANIZATION_SECTION_NAME,
                    path,
                  )}
                  tooltip={constructPath(ORGANIZATION_SECTION_NAME, path)}
                />
              )}

              {publishAction !== PublishActions.DELETE && (
                <section>
                  <Field
                    {...register(
                      'publicationAuthor',
                      validators.publicationAuthor,
                    )}
                    placeholder={t(`Type publication's author name...`)}
                    label={t('Author')}
                    id="publicationAuthor"
                    error={errors.publicationAuthor?.message}
                    dataQa="public-author-input"
                  />
                </section>
              )}
            </div>
            <section className="flex h-full flex-col overflow-y-auto px-3 py-4 md:px-5">
              <h2
                className="mb-4 flex gap-2 font-semibold"
                data-qa="allow-access-label"
              >
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
                <div data-qa="rules-container">
                  <div
                    className="mb-1 text-xs text-secondary"
                    data-qa="published-path"
                  >
                    {getLastPathSegment(path)}
                  </div>
                  <RulesInput
                    isOpen={isRuleSetterOpened}
                    filters={otherTargetAudienceFilters}
                    setFilters={setOtherTargetAudienceFilters}
                    onSwitchRulesSetter={setIsRuleSetterOpened}
                  />
                </div>
              )}
              {!path && (
                <p className="text-secondary" data-qa="availability-label">
                  {t(
                    'This publication will be available to all users in the organization',
                  )}
                </p>
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
          <Tooltip hideTooltip={isSendBtnTooltipHidden} tooltip={tooltipText}>
            <button
              className="button button-primary py-2"
              type="submit"
              data-qa="publish"
              disabled={isSendBtnDisabled}
            >
              {t('Send request')}
            </button>
          </Tooltip>
        </div>
      </form>
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
