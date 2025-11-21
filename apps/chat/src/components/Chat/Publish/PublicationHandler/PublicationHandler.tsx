import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  extractNameFromEmail,
  formatDate,
  replaceSpacesFromString,
} from '@/src/utils/app/common';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import {
  getIdWithoutFeatureType,
  isApplicationId,
  isConversationId,
  isFileId,
  isToolsetId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import {
  getDefaultAllEditEntities,
  getPublicationDefaultName,
  getPublicationId,
  isEntityIdPublic,
} from '@/src/utils/app/publications';
import { isMyEntity, splitEntityId } from '@/src/utils/app/shared-utils';

import { BackendResourceType, FeatureType } from '@/src/types/common';
import {
  Publication,
  PublicationResource,
  PublicationRule,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  AuthSelectors,
  ConversationsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

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

const AUTHOR_PUBLIC_NAME_TOOLTIP =
  "This name will be displayed instead of the author's name for this publication.";

interface Props {
  publication: Publication;
  onSubmit: (
    resources: PublicationResource[],
    formData?: PublicationRequestFormData,
  ) => void;
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
    featureType: FeatureType.Toolset,
    sectionName: 'Toolsets',
    dataQa: 'toolsets-tree',
    ItemComponent: PublicationToolsetRow,
  },
  {
    featureType: FeatureType.File,
    sectionName: 'Files',
    dataQa: 'files-tree',
    ItemComponent: PublicationFileRow,
  },
];

export function PublicationHandler({ publication, onSubmit }: Props) {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const publicationModel = useAppSelector(
    PublicationSelectors.selectPublishModel,
  );
  const isReview = !publicationModel;
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
  const isEditMode = useAppSelector(PublicationSelectors.selectIsEditMode);
  const userName = useAppSelector(AuthSelectors.selectUserName);
  const publicVersionGroups = useAppSelector(
    PublicationSelectors.selectPublicVersionGroups,
  );
  const areConversationsWithContentUploading = useAppSelector(
    ConversationsSelectors.selectAreConversationsWithContentUploading,
  );

  const [isCompareModalOpened, setIsCompareModalOpened] = useState(false);
  const [isFormChanged, setIsFormChanged] = useState(false);

  const publicationAuthor = useMemo(() => {
    return extractNameFromEmail(publication.author) ?? t('Unknown');
  }, [publication.author, t]);
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

  const getDefaultValues = useCallback(
    () => ({
      publishRequestName: getPublicationDefaultName(
        replaceSpacesFromString(userName),
      ),
      rules: initialState.rules,
      publicationAuthor: initialState.displayAuthor,
      publishToUrl: initialState.publishToUrl,
    }),
    [initialState, userName],
  );

  const formMethods = useForm<PublicationRequestFormData>({
    defaultValues: getDefaultValues(),
    mode: 'onChange',
  });

  useEffect(() => {
    formMethods.reset(getDefaultValues());
  }, [getDefaultValues, formMethods]);

  const rulesOnEdit = formMethods.watch(PublishRequestFieldsNames.RULES);
  const displayAuthorEditState = formMethods.watch(
    PublishRequestFieldsNames.PUBLICATION_AUTHOR,
  );
  const editedPublishToUrl = formMethods.watch(
    PublishRequestFieldsNames.PUBLISH_TO_URL,
  );

  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(
      state,
      !isReview ? editedPublishToUrl : publication.targetFolder,
    ),
  );

  useEffect(() => {
    if (!isEditMode) {
      formMethods.reset();
    }
  }, [formMethods, isEditMode]);

  useEffect(() => {
    if (editedPublishToUrl !== PUBLIC_URL_PREFIX) {
      dispatch(
        PublicationActions.uploadRules({
          path: getIdWithoutFeatureType(editedPublishToUrl),
        }),
      );
    }
  }, [dispatch, editedPublishToUrl]);

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
  const doesIncludeConversation = publication.resourceTypes.includes(
    BackendResourceType.CONVERSATION,
  );
  const doesIncludeMarketplaceEntity =
    publication.resourceTypes.includes(BackendResourceType.APPLICATION) ||
    publication.resourceTypes.includes(BackendResourceType.TOOLSET);

  const handleSendRequest = useCallback(
    (data: PublicationRequestFormData) => {
      onSubmit(publication.resources, data);
    },
    [publication.resources, onSubmit],
  );

  const handleCloseCompareModal = useCallback(() => {
    setIsCompareModalOpened(false);
  }, []);

  const displayPublishToUrl = editedPublishToUrl
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

  const errorMessageEntityType = useMemo(() => {
    if (!publicationModel) return '';
    if (isApplicationId(publicationModel.entity.id)) {
      return FeatureType.Application;
    }

    if (isToolsetId(publicationModel.entity.id)) {
      return FeatureType.Toolset;
    }
    return '';
  }, [publicationModel]);

  const isSomeResourceIsUnpublish = publication.resources.some(
    (resource) => resource.action === PublishActions.DELETE,
  );
  const doesPublicationContainFiles = publication.resources.some(
    ({ reviewUrl }) => isFileId(reviewUrl),
  );
  const showPublicDisplayAuthor =
    !isPublicationHasOnlyUnpublishEntities ||
    (publicationModel && publicationModel.action !== PublishActions.DELETE);
  const doesInvalidPublishApplicationIconExist =
    !isReview &&
    doesIncludeMarketplaceEntity &&
    isFileId(publicationModel.entity.iconUrl) &&
    !isMyEntity({ id: publicationModel.entity.iconUrl ?? '' });

  return (
    <FormProvider {...formMethods}>
      <form
        onSubmit={formMethods.handleSubmit(handleSendRequest)}
        className={classNames(
          'flex w-full justify-center overflow-y-auto',
          isReview ? 'p-3 md:px-5 md:pt-5' : 'h-full',
        )}
      >
        <div
          className="relative flex size-full flex-col divide-y divide-tertiary rounded 2xl:max-w-[1000px]"
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
                {...formMethods.register(
                  PublishRequestFieldsNames.PUBLISH_REQUEST_NAME,
                  validators.publishRequestName,
                )}
                placeholder={t(
                  `Type ${publicationModel.action === PublishActions.ADD ? 'publication' : 'unpublish'} request name...`,
                )}
                id={PublishRequestFieldsNames.PUBLISH_REQUEST_NAME}
                error={formMethods.formState.errors.publishRequestName?.message}
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
                        displayPublishToUrl={displayPublishToUrl}
                        maxDepth={maxPublishToDepth}
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
                        valueToDisplay={displayPublishToUrl}
                        tooltip={
                          <div className="flex break-words">
                            {displayPublishToUrl}
                          </div>
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

                    {showPublicDisplayAuthor &&
                      (isEditMode || !isReview ? (
                        <Field
                          info={
                            isReview ? t(AUTHOR_PUBLIC_NAME_TOOLTIP) : undefined
                          }
                          label={t(
                            isReview ? "Author's public name" : 'Author',
                          )}
                          {...formMethods.register(
                            PublishRequestFieldsNames.PUBLICATION_AUTHOR,
                            validators.publicationAuthor,
                          )}
                          id={PublishRequestFieldsNames.PUBLICATION_AUTHOR}
                          error={
                            formMethods.formState.errors.publicationAuthor
                              ?.message
                          }
                          className="h-6 w-full rounded-none border-0 border-b border-primary bg-layer-2 px-1 py-[2px] text-sm text-primary placeholder:text-secondary focus:border-accent-primary focus:outline-none"
                        />
                      ) : (
                        <PublicationInfoSection
                          labelDataQa="publication-display-author-label"
                          label={t("Author's public name")}
                          valueDataQa="publication-display-author"
                          valueToDisplay={publication.displayAuthor ?? ''}
                          infoTooltip={t(AUTHOR_PUBLIC_NAME_TOOLTIP)}
                        />
                      ))}

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
                      editedPublishToUrl={editedPublishToUrl}
                    />
                  </section>
                </div>
                <div className="overflow-y-auto bg-layer-2 px-3 pb-4 pt-1 md:px-5">
                  {publication.resources.length ? (
                    <>
                      {sections.map(
                        ({
                          dataQa,
                          sectionName,
                          ItemComponent,
                          featureType,
                        }) => {
                          const filteredResources =
                            publication.resources.filter(({ reviewUrl }) => {
                              const { apiKey } = splitEntityId(reviewUrl);
                              const itemFeatureType =
                                EnumMapper.getFeatureTypeByApiKey(apiKey);
                              return itemFeatureType === featureType;
                            });
                          const isConversationSectionAndNoFiles =
                            !isReview &&
                            featureType === FeatureType.File &&
                            doesIncludeConversation &&
                            !doesPublicationContainFiles;
                          const shouldRenderSection =
                            publication.resourceTypes.includes(
                              EnumMapper.getBackendResourceTypeByFeatureType(
                                featureType,
                              ),
                            ) ||
                            (doesInvalidPublishApplicationIconExist &&
                              featureType === FeatureType.File);

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
                              {!!filteredResources.length && (
                                <BasePublicationResources
                                  publicationUrl={publication.url}
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
                                      `The icon used for this ${errorMessageEntityType} is in the "${isEntityIdPublic({ id: publicationModel.entity.iconUrl ?? '' }) ? 'Organization' : 'Shared with me'}" section and cannot be published. Please replace the icon, otherwise the ${errorMessageEntityType} will be published with the default one.`,
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
            displayAuthorEditState={displayAuthorEditState}
            publication={publication}
            isFormChanged={isFormChanged}
            areRulesChanged={hasUserChangedRules}
            initialState={initialState}
            isFormErrors={
              Object.values(formMethods.formState.errors).length > 0
            }
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
    </FormProvider>
  );
}
