import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  extractNameFromEmail,
  formatDate,
  prepareEntityName,
} from '@/src/utils/app/common';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { isConversationId, isFileId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import {
  getPublicationDefaultName,
  getPublicationId,
} from '@/src/utils/app/publications';
import { constructPath, splitEntityId } from '@/src/utils/app/shared-utils';
import { translate } from '@/src/utils/app/translation';
import {
  parseConversationApiKey,
  pathKeySeparator,
} from '@/src/utils/server/api';

import { FeatureType } from '@/src/types/common';
import { Publication, PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { PublicationActions } from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors } from '@/src/store/selectors';

import {
  PUBLICATION_REVIEW_UPDATING_DELAY,
  PUBLIC_URL_PREFIX,
} from '@/src/constants/publication';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { PublicationInfoSection } from '../PublishWizardComponents';
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

import { debounce } from 'lodash-es';
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

  const [isCompareModalOpened, setIsCompareModalOpened] = useState(false);

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
  const editState = useAppSelector(PublicationSelectors.selectEditState);
  const rulesOnEdit = useAppSelector(PublicationSelectors.selectRulesOnEdit);

  const publicationAuthor = useMemo(() => {
    return extractNameFromEmail(publication.author) ?? t('Unknown');
  }, [publication.author, t]);

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

  const handleUpdateRequest = useCallback(() => {
    debounce(() => {
      dispatch(
        PublicationActions.updatePublicationRequest({
          url: publication.url,
          dataToUpdate: {
            name:
              publication.name ??
              getPublicationDefaultName(publication.author ?? 'Unknown Author'),
            targetFolder: publication.targetFolder,
            rules: rulesOnEdit,
            resources: publication.resources.map((resource) => {
              const { name, version } = editState[resource.reviewUrl];

              const preparedName = prepareEntityName(name);
              const modelName = splitEntityId(resource.reviewUrl).name;
              const parsedModelReference =
                parseConversationApiKey(modelName).model.id;
              const newApiKey = isConversationId(resource.reviewUrl)
                ? [parsedModelReference, preparedName, version].join(
                    pathKeySeparator,
                  )
                : isFileId(resource.reviewUrl)
                  ? [preparedName].join(pathKeySeparator)
                  : [preparedName, version].join(pathKeySeparator);

              return {
                action: resource.action,
                sourceUrl: resource.sourceUrl ?? '',
                targetUrl: constructPath(
                  getFolderIdFromEntityId(resource.targetUrl),
                  newApiKey,
                ),
              };
            }),
          },
        }),
      );
    }, PUBLICATION_REVIEW_UPDATING_DELAY)();
    dispatch(PublicationActions.setIsPublicationUpdating(true));
    dispatch(PublicationActions.setIsEditMode(false));
  }, [
    dispatch,
    editState,
    publication.author,
    publication.name,
    publication.resources,
    publication.targetFolder,
    publication.url,
    rulesOnEdit,
  ]);

  const publishToUrl = publication.targetFolder
    ? publication.targetFolder.replace(/^[^/]+/, 'Organization')
    : '';
  const publicationName = publication.name || getPublicationId(publication.url);
  const areRulesChanged =
    !isRulesLoading &&
    publication.rules &&
    !isEqual(publication.rules, rules[publication.targetFolder] || []);

  return (
    <div className="size-full justify-center overflow-y-auto p-0 md:px-5 md:pt-5">
      <div
        className="relative flex size-full flex-col justify-center gap-px rounded 2xl:max-w-[1000px]"
        data-qa="publish-approval-modal"
      >
        {isPublicationUpdating && (
          <div className="absolute inset-0 z-30 flex size-full items-center justify-center bg-layer-1 opacity-50">
            <Spinner size={32} />
          </div>
        )}
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

                <PublicationInfoSection
                  labelDataQa="publication-display-author-label"
                  label={t("Author's public name: ")}
                  valueDataQa="publication-display-author"
                  valueToDisplay={publication.displayAuthor}
                  infoTooltip={t(
                    'The name will be displayed instead of the author name for this publication.',
                  )}
                />

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
                    {areRulesChanged ? (
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
                <p className="my-3">{t('This publication has no resources')}</p>
              )}
            </div>
          </div>
        </div>
        <PublicationHandlerFooter
          onUpdateRequest={handleUpdateRequest}
          publication={publication}
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
