import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  extractNameFromEmail,
  formatDate,
  prepareEntityName,
  replaceSpacesFromString,
} from '@/src/utils/app/common';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { getStringValidationErrors } from '@/src/utils/app/forms';
import { EnumMapper } from '@/src/utils/app/mappers';
import {
  getDefaultAllEditEntities,
  getPublicationId,
  regenerateApiKeyNameAndVersionParts,
} from '@/src/utils/app/publications';
import { constructPath } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';

import { FeatureType } from '@/src/types/common';
import { Publication, PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  EDITED_FOLDER_NAME_KEY,
  FolderNode,
} from '@/src/store/publication/publication.types';
import { PublicationSelectors } from '@/src/store/selectors';

import { MAX_ENTITY_LENGTH } from '@/src/constants/default-ui-settings';
import { PUBLIC_URL_PREFIX } from '@/src/constants/publication';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { PublicationInfoSection } from '../PublicationInfoSection';
import { CompareRulesModal } from './CompareRulesModal';
import { PublicationFilters } from './PublicationFilters';
import { PublicationHandlerFooter } from './PublicationHandlerFooter';
import { ReviewApplicationDialog } from './ReviewApplicationDialog/ReviewApplicationDialog';
import {
  ApplicationPublicationResources,
  ConversationPublicationResources,
  FilePublicationResources,
  PromptPublicationResources,
} from './ReviewResources';

import { PublishActions } from '@epam/ai-dial-shared';
import isEqual from 'lodash-es/isEqual';

interface Props {
  publication: Publication;
}

const sections = [
  {
    featureType: FeatureType.Chat,
    sectionName: translate('Conversations'),
    dataQa: 'conversations-to-approve',
    Component: ConversationPublicationResources,
  },
  {
    featureType: FeatureType.Prompt,
    sectionName: translate('Prompts'),
    dataQa: 'prompts-to-approve',
    Component: PromptPublicationResources,
  },
  {
    featureType: FeatureType.Application,
    sectionName: translate('Applications'),
    dataQa: 'applications-to-approve',
    Component: ApplicationPublicationResources,
  },
  {
    featureType: FeatureType.File,
    sectionName: translate('Files'),
    dataQa: 'files-to-approve',
    Component: FilePublicationResources,
  },
];

export function PublicationHandler({ publication }: Props) {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(state, publication.targetFolder),
  );
  const isRulesLoading = useAppSelector(
    PublicationSelectors.selectIsRulesLoading,
  );
  const isApplicationReview = useAppSelector(
    PublicationSelectors.selectIsApplicationReview,
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

  const [isCompareModalOpened, setIsCompareModalOpened] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const [isFormChanged, setIsFormChanged] = useState(false);

  const publicationAuthor = useMemo(() => {
    return extractNameFromEmail(publication.author) ?? t('Unknown');
  }, [publication.author, t]);

  useEffect(() => {
    if (isEditMode) {
      setErrors(() =>
        getStringValidationErrors({
          value: replaceSpacesFromString(publication.displayAuthor),
          label: 'Author',
        }),
      );
    }
  }, [isEditMode, publication.displayAuthor]);

  useEffect(() => {
    if (publication.targetFolder !== PUBLIC_URL_PREFIX) {
      dispatch(
        PublicationActions.uploadRules({
          path: publication.targetFolder.split('/').slice(1).join('/'),
        }),
      );
    }
  }, [dispatch, publication.targetFolder]);

  const filteredRuleEntries = useMemo(() => {
    const rulesEntries = Object.entries(rules);
    return !publication.rules
      ? rulesEntries
      : rulesEntries.filter(([path]) => path !== publication.targetFolder);
  }, [publication.rules, rules, publication.targetFolder]);

  const newRules: PublicationRule[] = useMemo(
    () =>
      publication.rules?.map((rule) => ({
        source: rule.source,
        function: rule.function,
        targets: rule.targets,
      })) ?? [],
    [publication.rules],
  );

  const isPublicationHasOnlyUnpublishEntities = useMemo(
    () =>
      publication.resources.every(
        (resource) => resource.action === PublishActions.DELETE,
      ),
    [publication.resources],
  );

  const handleUpdateRequest = useCallback(() => {
    dispatch(
      PublicationActions.updatePublicationRequest({
        url: publication.url,
        dataToUpdate: {
          targetFolder: publication.targetFolder,
          rules: rulesOnEdit,
          displayAuthor: displayAuthorEditState,
          resources: publication.resources.map(
            ({ sourceUrl, reviewUrl, action }) => {
              const { name, version } = entitiesEditState[reviewUrl];

              // calculate new folderId
              const folderSegments =
                getFolderIdFromEntityId(reviewUrl).split('/');
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
              const newFolderId = newFolderSegments.join('/');

              // get new api key
              const newApiKey = regenerateApiKeyNameAndVersionParts(
                reviewUrl,
                name,
                version.trim(),
              );

              return {
                action,
                sourceUrl: sourceUrl ?? '',
                targetUrl: constructPath(newFolderId, newApiKey),
              };
            },
          ),
        },
      }),
    );
    dispatch(PublicationActions.setIsEditMode(false));
  }, [
    dispatch,
    displayAuthorEditState,
    entitiesEditState,
    foldersEditState,
    publication.resources,
    publication.targetFolder,
    publication.url,
    rulesOnEdit,
  ]);

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

  const publishToUrl = publication.targetFolder
    ? publication.targetFolder.replace(/^[^/]+/, 'Organization')
    : '';
  const publicationName = publication.name || getPublicationId(publication.url);

  const initialState = useMemo(() => {
    const { entities, folders } = getDefaultAllEditEntities(
      publication.resources,
    );
    const initialRules = publication.rules ?? [];
    const initialDisplayAuthor = publication.displayAuthor ?? '';

    return {
      entities,
      folders,
      rules: initialRules,
      displayAuthor: initialDisplayAuthor,
    };
  }, [publication]);

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

      const result =
        entitiesChanged || foldersChanged || rulesChanged || authorChanged;

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
  ]);

  const hasUserChangedRules = useMemo(() => {
    const initialRules = publication.rules ?? [];
    return !isEqual(initialRules, rulesOnEdit);
  }, [publication.rules, rulesOnEdit]);

  return (
    <div className="flex size-full justify-center overflow-y-auto p-3 md:px-5 md:pt-5">
      <div
        className="relative flex size-full flex-col gap-px rounded 2xl:max-w-[1000px]"
        data-qa="publish-approval-modal"
      >
        <div className="flex w-full items-center rounded-t bg-layer-2 px-3 py-4 md:px-5">
          <Tooltip
            tooltip={publicationName}
            contentClassName="max-w-[400px] break-all"
            triggerClassName="truncate"
          >
            <h4
              data-qa="publish-name"
              className="truncate whitespace-pre break-all text-base font-semibold"
            >
              {publicationName}
            </h4>
          </Tooltip>
        </div>
        <div className="flex w-full flex-col gap-px overflow-hidden rounded-b bg-layer-1 [&:first-child]:rounded-t">
          {isPublicationUpdating ? (
            <div className="flex h-[300px] items-center justify-center bg-layer-2 py-10">
              <Spinner size={32} />
            </div>
          ) : (
            <div className="relative size-full gap-px divide-y divide-tertiary overflow-auto md:grid md:grid-cols-2 md:grid-rows-1 md:divide-y-0">
              <div className="flex shrink flex-col divide-y divide-tertiary overflow-auto bg-layer-2 md:py-4">
                <div className="flex flex-col px-3 pb-4 md:px-5">
                  <h2 className="mb-4 font-semibold">{t('General info')}</h2>
                  <PublicationInfoSection
                    labelDataQa="publish-to-label"
                    label={t('Publish to')}
                    valueDataQa="publish-to-path"
                    valueToDisplay={publishToUrl}
                    tooltip={
                      <div className="flex break-words">{publishToUrl}</div>
                    }
                  />

                  <PublicationInfoSection
                    labelDataQa="publication-author-label"
                    label={t('Author: ')}
                    valueDataQa="publication-author"
                    valueToDisplay={publicationAuthor}
                  />

                  {!isPublicationHasOnlyUnpublishEntities && (
                    <PublicationInfoSection
                      labelDataQa="publication-display-author-label"
                      label={t("Author's public name: ")}
                      valueDataQa="publication-display-author"
                      valueToDisplay={publication.displayAuthor ?? ''}
                      infoTooltip={t(
                        `This name will be displayed instead of the author's name for this publication.`,
                      )}
                      editValue={displayAuthorEditState}
                      onChangeValue={handleChangeDisplayAuthor}
                      isEditMode={isEditMode}
                      errors={errors}
                    />
                  )}

                  <PublicationInfoSection
                    labelDataQa="creation-date-label"
                    label={t('Request created: ')}
                    valueDataQa="creation-date"
                    valueToDisplay={formatDate(publication.createdAt)}
                  />
                </div>
                <section className="px-3 py-4 md:px-5">
                  <h2 className="mb-4 flex items-center gap-2 text-sm">
                    <div className="flex w-full justify-between">
                      <p data-qa="allow-access-label">
                        {t('Allow access if all match')}
                      </p>
                      {hasUserChangedRules ? (
                        <span
                          onClick={() => setIsCompareModalOpened(true)}
                          className="cursor-pointer text-accent-primary"
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
                  sections.map(
                    ({ dataQa, sectionName, Component, featureType }) =>
                      publication.resourceTypes.includes(
                        EnumMapper.getBackendResourceTypeByFeatureType(
                          featureType,
                        ),
                      ) && (
                        <CollapsibleSection
                          key={featureType}
                          name={sectionName}
                          openByDefault
                          dataQa={dataQa}
                          togglerClassName="!text-sm !text-primary"
                          sectionTooltip={
                            <>
                              {t('Publish')},
                              <span className="text-error">
                                {' '}
                                {t('Unpublish')}
                              </span>
                            </>
                          }
                        >
                          <Component resources={publication.resources} />
                        </CollapsibleSection>
                      ),
                  )
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
          onUpdateRequest={handleUpdateRequest}
          publication={publication}
          isFormChanged={isFormChanged}
        />
      </div>
      {isCompareModalOpened && publication.targetFolder && (
        <CompareRulesModal
          allRuleEntries={filteredRuleEntries}
          newRulesToCompare={newRules}
          oldRulesToCompare={rules[publication.targetFolder]}
          onClose={() => setIsCompareModalOpened(false)}
          newRulesPath={publication.targetFolder}
        />
      )}
      {isApplicationReview && <ReviewApplicationDialog />}
    </div>
  );
}
