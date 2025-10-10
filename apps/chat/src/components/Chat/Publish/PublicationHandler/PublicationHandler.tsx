import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  extractNameFromEmail,
  formatDate,
  prepareEntityName,
  replaceSpacesFromString,
} from '@/src/utils/app/common';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getStringValidationErrors } from '@/src/utils/app/forms';
import {
  getIdWithoutFeatureType,
  isConversationId,
  isFileId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import {
  getDefaultAllEditEntities,
  getPublicationDefaultName,
  getPublicationId,
  isEntityIdPublic,
  regenerateApiKeyNameAndVersionParts,
} from '@/src/utils/app/publications';
import {
  constructPath,
  isMyEntity,
  splitEntityId,
} from '@/src/utils/app/shared-utils';

import { ApiKeys, BackendResourceType, FeatureType } from '@/src/types/common';
import { Publication, PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  EDITED_FOLDER_NAME_KEY,
  FolderNode,
} from '@/src/store/publication/publication.types';
import {
  AuthSelectors,
  ConversationsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { MAX_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { ErrorMessage } from '@/src/components/Common/ErrorMessage';
import { Field } from '@/src/components/Common/Forms/Field';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { PublicationInfoSection } from '../PublicationInfoSection';
import { PublishToSection } from '../PublishToSection';
import {
  PublicationRequestFormData,
  PublishRequestFieldsNames,
  validators,
} from '../form';
import { BasePublicationResources } from './BasePublicationResources';
import { CompareRulesModal } from './CompareRulesModal';
import { PublicationFilters } from './PublicationFilters';
import { PublicationHandlerFooter } from './PublicationHandlerFooter';
import { ReviewApplicationDialog } from './ReviewApplicationDialog/ReviewApplicationDialog';
import { PublicationApplicationRow } from './ReviewRowItems/PublicationApplicationRow';
import { PublicationConversationRow } from './ReviewRowItems/PublicationConversationRow';
import { PublicationFileRow } from './ReviewRowItems/PublicationFileRow';
import { PublicationPromptRow } from './ReviewRowItems/PublicationPromptRow';
import { PublicationToolsetRow } from './ReviewRowItems/PublicationToolsetRow';
import { ReviewToolsetDialog } from './ReviewToolsetDialog/ReviewToolsetDialog';

import { PublishActions } from '@epam/ai-dial-shared';
import isEqual from 'lodash-es/isEqual';

interface Props {
  publication: Publication;
}

const LEADING_SLASH_REGEX = /^\/+/;

const sections = [
  {
    featureType: FeatureType.Chat,
    sectionName: 'Conversations',
    dataQa: 'conversations-tree',
    ItemComponent: PublicationConversationRow,
  },
  {
    featureType: FeatureType.Prompt,
    sectionName: 'Prompts',
    dataQa: 'prompts-tree',
    ItemComponent: PublicationPromptRow,
  },
  {
    featureType: FeatureType.Application,
    sectionName: 'Applications',
    dataQa: 'applications-tree',
    ItemComponent: PublicationApplicationRow,
  },
  {
    featureType: FeatureType.File,
    sectionName: 'Files',
    dataQa: 'files-tree',
    ItemComponent: PublicationFileRow,
  },
  {
    featureType: FeatureType.Toolset,
    sectionName: 'Toolsets',
    dataQa: 'toolsets-tree',
    ItemComponent: PublicationToolsetRow,
  },
];

export function PublicationHandler({ publication }: Props) {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const publicationModel = useAppSelector(
    PublicationSelectors.selectPublishModel,
  );
  const isReview = !publicationModel;
  const editedPublishToUrl = useAppSelector(
    PublicationSelectors.selectPublishToUrl,
  );
  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(
      state,
      !isReview ? editedPublishToUrl : publication.targetFolder,
    ),
  );
  const isRulesLoading = useAppSelector(
    PublicationSelectors.selectIsRulesLoading,
  );
  const isApplicationReview = useAppSelector(
    PublicationSelectors.selectIsApplicationReview,
  );
  const isToolsetReview = useAppSelector(
    PublicationSelectors.selectIsToolsetReview,
  );
  const isPublicationUpdating = useAppSelector(
    PublicationSelectors.selectIsPublicationUpdating,
  );
  const entitiesEditState = useAppSelector(
    PublicationSelectors.selectEntitiesEditState,
  );
  const foldersEditState = useAppSelector(
    PublicationSelectors.selectFoldersEditState,
  );
  const rulesOnEdit = useAppSelector(PublicationSelectors.selectRulesOnEdit);
  const displayAuthorEditState = useAppSelector(
    PublicationSelectors.selectDisplayAuthorEditState,
  );
  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const userName = useAppSelector(AuthSelectors.selectUserName);
  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );
  const selectedPublicationItems = useAppSelector(
    PublicationSelectors.selectSelectedPublicationItems,
  );
  const areConversationsWithContentUploading = useAppSelector(
    ConversationsSelectors.selectAreConversationsWithContentUploading,
  );

  const [isCompareModalOpened, setIsCompareModalOpened] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isFormChanged, setIsFormChanged] = useState(false);

  const {
    register,
    formState: { errors: formErrors },
    trigger,
    handleSubmit: submitWrapper,
  } = useForm<PublicationRequestFormData>({
    defaultValues: {
      publishRequestName: getPublicationDefaultName(
        replaceSpacesFromString(userName),
      ),
    },
    mode: 'onChange',
  });

  const publicationAuthor = useMemo(() => {
    return extractNameFromEmail(publication.author) ?? t('Unknown');
  }, [publication.author, t]);

  useEffect(() => {
    trigger();
  }, [trigger]);

  useEffect(() => {
    if (isEditMode || isReview) {
      setErrors(() =>
        getStringValidationErrors({
          value: replaceSpacesFromString(publication.displayAuthor),
          label: 'Author',
        }),
      );
    }
  }, [isEditMode, isReview, publication.displayAuthor]);

  useEffect(() => {
    if (publication.targetFolder !== PUBLIC_URL_PREFIX && isReview) {
      dispatch(
        PublicationActions.uploadRules({
          path: getIdWithoutFeatureType(publication.targetFolder),
        }),
      );
    }
  }, [dispatch, isReview, publication.targetFolder]);

  useEffect(() => {
    if (
      editedPublishToUrl &&
      editedPublishToUrl !== PUBLIC_URL_PREFIX &&
      !isReview
    ) {
      dispatch(
        PublicationActions.uploadRules({
          path: getIdWithoutFeatureType(editedPublishToUrl),
        }),
      );
    }
  }, [dispatch, editedPublishToUrl, isReview]);

  useEffect(() => {
    if (!isReview) {
      dispatch(
        PublicationActions.setRulesOnEdit(rules[editedPublishToUrl] ?? []),
      );
    }
  }, [rules, isReview, dispatch, publication.rules, editedPublishToUrl]);

  const filteredRuleEntries = useMemo(() => {
    const rulesEntries = Object.entries(rules);
    return !publication.rules && isReview
      ? rulesEntries
      : rulesEntries.filter(([path]) =>
          isReview
            ? path !== publication.targetFolder
            : path !== editedPublishToUrl,
        );
  }, [
    rules,
    publication.rules,
    publication.targetFolder,
    isReview,
    editedPublishToUrl,
  ]);

  const newRules: PublicationRule[] = useMemo(
    () =>
      (!isReview
        ? rulesOnEdit
        : publication.rules?.map((rule) => ({
            source: rule.source,
            function: rule.function,
            targets: rule.targets,
          }))) ?? [],
    [isReview, publication.rules, rulesOnEdit],
  );

  const isPublicationHasOnlyUnpublishEntities = useMemo(
    () =>
      publication.resources.every(
        (resource) => resource.action === PublishActions.DELETE,
      ),
    [publication.resources],
  );

  const initialState = useMemo(() => {
    const { entities, folders } = getDefaultAllEditEntities(
      publication.resources,
      publicVersionGroups,
      { isReview },
    );
    const initialRules = publication.rules ?? [];
    const initialDisplayAuthor = isReview
      ? (publication.displayAuthor ?? '')
      : userName;

    return {
      entities,
      folders,
      rules: initialRules,
      displayAuthor: initialDisplayAuthor,
      publishToUrl: publication.targetFolder,
    };
  }, [
    isReview,
    publicVersionGroups,
    publication.displayAuthor,
    publication.resources,
    publication.rules,
    publication.targetFolder,
    userName,
  ]);

  const handleUpdateRequest = useCallback(
    (data: PublicationRequestFormData) => {
      const mappedResources = publication.resources.map(
        ({ sourceUrl, reviewUrl, action, targetUrl }) => {
          const { name, version } = entitiesEditState[reviewUrl];

          // calculate new folderId
          const folderSegments = getFolderIdFromEntityId(reviewUrl).split('/');
          const newFolderSegments: string[] = [];
          let currentFolder = foldersEditState as FolderNode;
          folderSegments.forEach((segment, i) => {
            currentFolder = currentFolder[segment] as FolderNode;
            newFolderSegments.push(
              // prepare name if it's not root path segments
              i > 1
                ? prepareEntityName(currentFolder[EDITED_FOLDER_NAME_KEY])
                : currentFolder[EDITED_FOLDER_NAME_KEY],
            );
          });

          if (action !== PublishActions.DELETE) {
            newFolderSegments[1] = publication.targetFolder;
          }

          let newFolderId = newFolderSegments.join('/');
          newFolderId = newFolderId.replace(
            publication.targetFolder,
            editedPublishToUrl,
          );

          // get new api key
          const newApiKey = regenerateApiKeyNameAndVersionParts(
            reviewUrl,
            name,
            version.trim(),
          );

          let newTargetUrl = '';

          if (!isReview && publicationModel.action === PublishActions.DELETE) {
            newTargetUrl = targetUrl;
          } else if (!isReview && isFileId(reviewUrl)) {
            // files is a flat list in publication request, strictly dependent on entity it bounds to.
            // We need to construct the targetUrl using the original targetUrl, which depends on the entity and add new publishFolder.
            newTargetUrl = constructPath(
              ApiKeys.Files,
              editedPublishToUrl,
              ...targetUrl.split('/').slice(2),
            );
          } else {
            newTargetUrl = constructPath(newFolderId, newApiKey);
          }

          return {
            action,
            sourceUrl: sourceUrl ?? '',
            targetUrl: newTargetUrl,
            reviewUrl,
          };
        },
      );

      if (!isReview) {
        dispatch(
          PublicationActions.publish({
            name: data.publishRequestName.trim(),
            resources: mappedResources.filter((resource) =>
              selectedPublicationItems.includes(resource.reviewUrl),
            ),
            targetFolder: editedPublishToUrl,
            displayAuthor: displayAuthorEditState.trim(),
            rules: rulesOnEdit,
          }),
        );
        dispatch(PublicationActions.setPublishModel());
      } else {
        dispatch(
          PublicationActions.updatePublicationRequest({
            url: publication.url,
            dataToUpdate: {
              targetFolder: editedPublishToUrl,
              rules: rulesOnEdit,
              displayAuthor: displayAuthorEditState.trim(),
              resources: mappedResources,
            },
          }),
        );
        dispatch(PublicationActions.setIsEditMode(false));
      }
    },
    [
      publication.resources,
      publication.targetFolder,
      publication.url,
      isReview,
      entitiesEditState,
      foldersEditState,
      editedPublishToUrl,
      publicationModel?.action,
      dispatch,
      displayAuthorEditState,
      rulesOnEdit,
      selectedPublicationItems,
    ],
  );

  const handleSelectPublishToFolder = useCallback(
    (folderId?: string) => {
      if (typeof folderId === 'string') {
        dispatch(
          PublicationActions.setPublishToUrl(
            constructPath(PUBLIC_URL_PREFIX, folderId),
          ),
        );
      }
    },
    [dispatch],
  );

  const handleChangeDisplayAuthor = useCallback(
    (value: string) => {
      const cleanedValue = replaceSpacesFromString(value);
      setErrors(() =>
        getStringValidationErrors({
          value: cleanedValue,
          label: 'Author',
        }),
      );
      if (
        value.length <= MAX_ENTITY_LENGTH ||
        value.length < displayAuthorEditState.length
      ) {
        dispatch(PublicationActions.setDisplayAuthorEditState(cleanedValue));
      }
    },
    [dispatch, displayAuthorEditState.length],
  );

  const handleCloseCompareModal = useCallback(() => {
    setIsCompareModalOpened(false);
  }, []);

  const publishToUrl = editedPublishToUrl
    ? editedPublishToUrl.replace(/^[^/]+/, 'Organization')
    : '';
  const publicationName = publication.name || getPublicationId(publication.url);

  useEffect(() => {
    const handler = setTimeout(() => {
      const entitiesChanged = !isEqual(
        initialState.entities,
        entitiesEditState,
      );
      const foldersChanged = !isEqual(initialState.folders, foldersEditState);
      const rulesChanged = !isEqual(initialState.rules, rulesOnEdit);
      const authorChanged =
        initialState.displayAuthor !== displayAuthorEditState;
      const publishToUrlChanged =
        initialState.publishToUrl !== editedPublishToUrl;

      const result =
        entitiesChanged ||
        foldersChanged ||
        rulesChanged ||
        authorChanged ||
        publishToUrlChanged;

      setIsFormChanged(result);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [
    initialState,
    entitiesEditState,
    foldersEditState,
    rulesOnEdit,
    displayAuthorEditState,
    editedPublishToUrl,
  ]);

  const hasUserChangedRules = useMemo(() => {
    return !isEqual(
      rules[isReview ? publication.targetFolder : editedPublishToUrl] ?? [],
      (isReview ? newRules : rulesOnEdit) ?? [],
    );
  }, [
    editedPublishToUrl,
    isReview,
    newRules,
    publication.targetFolder,
    rules,
    rulesOnEdit,
  ]);

  const maxPublishToDepth = useMemo(() => {
    return publication.resources.reduce((max, resource) => {
      const targetUrl = getFolderIdFromEntityId(
        getIdWithoutFeatureType(resource.targetUrl),
      );
      const cleanTargetUrlPath = targetUrl
        .replace(publication.targetFolder, '')
        .replace(LEADING_SLASH_REGEX, '');
      const cleanTargetUrlPathLength = cleanTargetUrlPath
        ? cleanTargetUrlPath.split('/').length
        : 0;

      return Math.max(max, cleanTargetUrlPathLength);
    }, 0);
  }, [publication.resources, publication.targetFolder]);

  const isSomeResourceIsUnpublish = publication.resources.some(
    (resource) => resource.action === PublishActions.DELETE,
  );
  const firstNotMyFileEntity = publication.resources.find(
    ({ reviewUrl }) => !isMyEntity({ id: reviewUrl }) && isFileId(reviewUrl),
  );
  const doesPublicationContainFiles = publication.resources.some(
    ({ reviewUrl }) => isFileId(reviewUrl),
  );

  return (
    <form
      onSubmit={submitWrapper(handleUpdateRequest)}
      className={classNames(
        'flex w-full justify-center overflow-y-auto',
        isReview ? 'p-3 md:px-5 md:pt-5' : 'h-full',
      )}
    >
      <div
        className="relative flex size-full flex-col gap-px rounded 2xl:max-w-[1000px]"
        data-qa="publish-approval-modal"
      >
        <div className="flex w-full flex-col justify-center rounded-t bg-layer-2 px-3 py-4 md:px-5">
          {isReview ? (
            <Tooltip
              tooltip={publicationName}
              contentClassName="break-all"
              triggerClassName="truncate"
            >
              <h4
                data-qa="publish-name"
                className="truncate whitespace-pre break-all text-base font-semibold"
              >
                {publicationName}
              </h4>
            </Tooltip>
          ) : (
            <Field
              className="border-none p-0 text-base font-semibold"
              {...register(
                PublishRequestFieldsNames.PUBLISH_REQUEST_NAME,
                validators.publishRequestName,
              )}
              placeholder={t(
                t(
                  `Type ${publicationModel.action === PublishActions.ADD ? 'publication' : 'unpublish'} request name...`,
                ),
              )}
              id={PublishRequestFieldsNames.PUBLISH_REQUEST_NAME}
              error={formErrors.publishRequestName?.message}
              dataQa="request-name"
            />
          )}
        </div>
        <div className="flex size-full flex-col gap-px overflow-hidden rounded-b bg-layer-1 [&:first-child]:rounded-t">
          {isPublicationUpdating || areConversationsWithContentUploading ? (
            <div
              className={classNames(
                'flex w-full items-center justify-center bg-layer-2 py-10',
                isReview ? 'h-[300px]' : 'h-full',
              )}
            >
              <Spinner size={32} />
            </div>
          ) : (
            <div className="relative size-full gap-px divide-y divide-tertiary overflow-auto md:grid md:grid-cols-2 md:grid-rows-1 md:divide-y-0">
              <div className="flex shrink flex-col divide-y divide-tertiary overflow-auto bg-layer-2 md:py-4">
                <div className="flex flex-col px-3 pb-4 md:px-5">
                  <h2 className="mb-4 font-semibold">{t('General info')}</h2>
                  {(publicationModel &&
                    publicationModel.action !== PublishActions.DELETE) ||
                  (isEditMode && !isSomeResourceIsUnpublish) ? (
                    <PublishToSection
                      path={publishToUrl}
                      maxDepth={maxPublishToDepth}
                      onSelect={handleSelectPublishToFolder}
                    />
                  ) : (
                    <PublicationInfoSection
                      labelDataQa="publish-label"
                      label={t(
                        publicationModel &&
                          publicationModel.action === PublishActions.DELETE
                          ? 'Unpublish from'
                          : 'Publish to',
                      )}
                      valueDataQa="publish-path"
                      valueToDisplay={publishToUrl}
                      tooltip={
                        <div className="flex break-words">{publishToUrl}</div>
                      }
                    />
                  )}

                  {isReview && (
                    <PublicationInfoSection
                      labelDataQa="publication-author-label"
                      label={t('Author')}
                      valueDataQa="publication-author"
                      valueToDisplay={publicationAuthor}
                    />
                  )}

                  {(!isPublicationHasOnlyUnpublishEntities ||
                    (publicationModel &&
                      publicationModel.action !== PublishActions.DELETE)) && (
                    <PublicationInfoSection
                      labelDataQa="publication-display-author-label"
                      label={t("Author's public name")}
                      valueDataQa="publication-display-author"
                      valueToDisplay={publication.displayAuthor ?? ''}
                      infoTooltip={
                        isReview
                          ? t(
                              "This name will be displayed instead of the author's name for this publication.",
                            )
                          : undefined
                      }
                      editValue={displayAuthorEditState}
                      onChangeValue={handleChangeDisplayAuthor}
                      isEditMode={isEditMode || !isReview}
                      errors={errors}
                    />
                  )}

                  {isReview && (
                    <PublicationInfoSection
                      labelDataQa="creation-date-label"
                      label={t('Request created')}
                      valueDataQa="creation-date"
                      valueToDisplay={formatDate(publication.createdAt)}
                    />
                  )}
                </div>
                <section
                  className="px-3 py-4 md:px-5"
                  data-qa="rules-container"
                >
                  <h2 className="mb-4 flex items-center gap-2 text-sm">
                    <div className="flex w-full justify-between">
                      <p data-qa="allow-access-label">
                        {t('Allow access if all match')}
                      </p>
                      {isReview && (
                        <>
                          {hasUserChangedRules ? (
                            <span
                              onClick={() => setIsCompareModalOpened(true)}
                              className="cursor-pointer text-accent-primary"
                              data-qa="see-changes"
                            >
                              {t('See changes')}
                            </span>
                          ) : (
                            <span
                              className="text-secondary"
                              data-qa="no-changes-label"
                            >
                              {t('No changes')}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </h2>
                  <PublicationFilters
                    isRulesLoading={isRulesLoading}
                    filteredRuleEntries={filteredRuleEntries}
                    newRules={newRules}
                    publication={publication}
                  />
                </section>
              </div>
              <div className="overflow-y-auto bg-layer-2 px-3 pb-4 pt-1 md:px-5">
                {publication.resources.length ? (
                  <>
                    {sections.map(
                      ({ dataQa, sectionName, ItemComponent, featureType }) => {
                        const filteredResources = publication.resources.filter(
                          ({ reviewUrl }) => {
                            const { apiKey } = splitEntityId(reviewUrl);
                            const itemFeatureType =
                              EnumMapper.getFeatureTypeByApiKey(apiKey);
                            return itemFeatureType === featureType;
                          },
                        );

                        const isConversationSectionAndNoFiles =
                          !isReview &&
                          featureType === FeatureType.File &&
                          publication.resourceTypes.includes(
                            BackendResourceType.CONVERSATION,
                          ) &&
                          !doesPublicationContainFiles;
                        const doesInvalidPublishApplicationIconExist =
                          !isReview &&
                          firstNotMyFileEntity &&
                          (publication.resourceTypes.includes(
                            BackendResourceType.APPLICATION,
                          ) ||
                            publication.resourceTypes.includes(
                              BackendResourceType.TOOLSET,
                            )) &&
                          featureType === FeatureType.File;
                        const shouldRenderSection =
                          publication.resourceTypes.includes(
                            EnumMapper.getBackendResourceTypeByFeatureType(
                              featureType,
                            ),
                          ) || doesInvalidPublishApplicationIconExist;

                        if (!shouldRenderSection) {
                          return null;
                        }

                        return (
                          <CollapsibleSection
                            key={featureType}
                            name={t(sectionName)}
                            openByDefault
                            dataQa={dataQa}
                            togglerClassName="!text-sm !text-primary"
                            sectionTooltip={
                              isReview && (
                                <>
                                  {t('Publish')},
                                  <span className="text-error">
                                    {' '}
                                    {t('Unpublish')}
                                  </span>
                                </>
                              )
                            }
                          >
                            {!!filteredResources.length &&
                              !doesInvalidPublishApplicationIconExist && (
                                <BasePublicationResources
                                  resources={filteredResources}
                                  ItemComponent={ItemComponent}
                                />
                              )}
                            {isConversationSectionAndNoFiles && (
                              <p
                                className="pl-3.5 text-secondary"
                                data-qa="no-publishing-files"
                              >
                                {t(
                                  publication.resources.filter(
                                    ({ reviewUrl }) =>
                                      isConversationId(reviewUrl),
                                  ).length < 2
                                    ? "This conversation doesn't contain any files"
                                    : "These conversations don't contain any files",
                                )}
                              </p>
                            )}
                            {doesInvalidPublishApplicationIconExist &&
                              featureType === FeatureType.File && (
                                <ErrorMessage
                                  type="warning"
                                  error={t(
                                    `The icon used for this ${featureType} is in the "${isEntityIdPublic({ id: firstNotMyFileEntity.reviewUrl }) ? 'Organization' : 'Shared with me'}" section and cannot be published. Please replace the icon, otherwise the application will be published with the default one.`,
                                  )}
                                />
                              )}
                          </CollapsibleSection>
                        );
                      },
                    )}
                  </>
                ) : (
                  <p className="my-3">
                    {t('This publication has no resources')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
        <PublicationHandlerFooter
          publication={publication}
          isFormChanged={isFormChanged}
          areRulesChanged={hasUserChangedRules}
          initialState={initialState}
          isFormErrors={Object.values(formErrors).length > 0}
        />
      </div>
      {isCompareModalOpened && publication.targetFolder && (
        <CompareRulesModal
          allRuleEntries={filteredRuleEntries}
          newRulesToCompare={newRules}
          oldRulesToCompare={rules[publication.targetFolder]}
          onClose={handleCloseCompareModal}
          newRulesPath={publication.targetFolder}
        />
      )}
      {isApplicationReview && <ReviewApplicationDialog />}
      {isToolsetReview && <ReviewToolsetDialog />}
    </form>
  );
}
