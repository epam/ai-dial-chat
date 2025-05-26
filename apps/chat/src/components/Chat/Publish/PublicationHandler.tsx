import { IconExclamationCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import classNames from 'classnames';

import { useTranslation } from '@/src/hooks/useTranslation';

import { extractNameFromEmail, formatDate } from '@/src/utils/app/common';
import {
  getFolderIdFromEntityId,
  getParentFolderIdsFromEntityId,
} from '@/src/utils/app/folders';
import {
  isApplicationId,
  isConversationId,
  isFileId,
  isPromptId,
} from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { getPublicationId } from '@/src/utils/app/publications';
import { translate } from '@/src/utils/app/translation';

import { FeatureType } from '@/src/types/common';
import {
  Publication,
  PublicationRule,
  ResourceToReview,
} from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import {
  ApplicationActions,
  ConversationsActions,
  PromptsActions,
  PublicationActions,
  UIActions,
} from '@/src/store/actions';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  ConversationsSelectors,
  FilesSelectors,
  ModelsSelectors,
  PromptsSelectors,
  PublicationSelectors,
} from '@/src/store/selectors';

import { PUBLIC_URL_PREFIX } from '@/src/constants/public';

import { CollapsibleSection } from '@/src/components/Common/CollapsibleSection';
import { Spinner } from '@/src/components/Common/Spinner';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { CompareRulesModal } from './CompareRulesModal';
import { PublicationInfoSection } from './PublishWizardComponents';
import { ReviewApplicationDialog } from './ReviewApplicationDialog/ReviewApplicationDialog';
import {
  ApplicationPublicationResources,
  ConversationPublicationResources,
  FilePublicationResources,
  PromptPublicationResources,
} from './ReviewResources';
import { RuleListItem } from './RuleListItem';

import isEqual from 'lodash-es/isEqual';
import uniq from 'lodash-es/uniq';

interface FilterComponentProps {
  filteredRuleEntries: [string, PublicationRule[]][];
  newRules: PublicationRule[];
  publication: Publication;
  isRulesLoading: boolean;
}

function FiltersComponent({
  filteredRuleEntries,
  newRules,
  publication,
  isRulesLoading,
}: FilterComponentProps) {
  const { t } = useTranslation(Translation.Chat);

  if (isRulesLoading) {
    return (
      <div className="flex size-full items-center justify-center">
        <Spinner size={48} />
      </div>
    );
  }

  const isNoRulesToDisplay =
    (!filteredRuleEntries.length ||
      filteredRuleEntries.every(([_, rules]) => !rules.length)) &&
    !publication.rules?.length;
  const oldRules = filteredRuleEntries.filter(([_, rules]) => rules.length);
  const isNewRules = !!publication.rules?.length && !!publication.targetFolder;

  return (
    <>
      {isNoRulesToDisplay && (
        <p className="text-sm text-secondary" data-qa="availability-label">
          {t(
            'This publication will be available to all users in the organization',
          )}
        </p>
      )}
      {oldRules.map(([path, rules]) => (
        <RuleListItem key={path} path={path} rules={rules} />
      ))}
      {isNewRules && (
        <RuleListItem path={publication.targetFolder} rules={newRules} />
      )}
    </>
  );
}

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

const getFirstReviewUrl = (
  resourcesToReview: ResourceToReview[],
  reviewedResources: ResourceToReview[],
) => {
  return resourcesToReview.length
    ? resourcesToReview[0].reviewUrl
    : reviewedResources[0].reviewUrl;
};

const getReviewItems = (
  publication: Publication,
  resourcesToReview: ResourceToReview[],
  isItemId: (id: string) => boolean,
) => {
  const toReview = resourcesToReview.filter(
    (r) =>
      !r.reviewed &&
      r.publicationUrl === publication.url &&
      isItemId(r.reviewUrl),
  );
  const reviewed = resourcesToReview.filter(
    (r) => r.publicationUrl === publication.url && isItemId(r.reviewUrl),
  );

  return { toReview, reviewed };
};

export function PublicationHandler({ publication }: Props) {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const [isCompareModalOpened, setIsCompareModalOpened] = useState(false);

  const files = useAppSelector(FilesSelectors.selectFiles);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const applications = useAppSelector(
    ModelsSelectors.selectPublishRequestModels,
  );
  const resourcesToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourcesToReviewByPublicationUrl(
      state,
      publication.url,
    ),
  );
  const rules = useAppSelector((state) =>
    PublicationSelectors.selectRulesByPath(state, publication.targetFolder),
  );
  const isRulesLoading = useAppSelector(
    PublicationSelectors.selectIsRulesLoading,
  );
  const isApplicationReview = useAppSelector(
    PublicationSelectors.selectIsApplicationReview,
  );

  const notExistEntities = useMemo(
    () =>
      [...files, ...conversations, ...prompts, ...applications].filter(
        (entity) => entity.publicationInfo?.isNotExist,
      ),
    [conversations, files, prompts, applications],
  );

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

  useEffect(() => {
    // we do not need to review files
    const resourcesToReview = publication.resources.filter(
      (resource) => !isFileId(resource.targetUrl),
    );
    const resourcesToReviewIds = resourcesToReview.map(
      (resource) => resource.reviewUrl,
    );
    const notExistEntitiesIds = notExistEntities.map((entity) => entity.id);
    const isSomeResourceNotExist = resourcesToReviewIds.some((id) =>
      notExistEntitiesIds.includes(id),
    );

    if (!isSomeResourceNotExist) {
      dispatch(
        PublicationActions.setPublicationsToReview({
          items: resourcesToReview.map((resource) => ({
            reviewed: false,
            reviewUrl: resource.reviewUrl,
            publicationUrl: publication.url,
          })),
        }),
      );
    }
  }, [dispatch, notExistEntities, publication.resources, publication.url]);

  const expandFoldersByFeatureType = useCallback(
    (
      toReview: ResourceToReview[],
      reviewed: ResourceToReview[],
      featureType: FeatureType,
    ) => {
      const paths = uniq(
        [...toReview, ...reviewed].flatMap((resource) =>
          getParentFolderIdsFromEntityId(
            getFolderIdFromEntityId(resource.reviewUrl),
          ).filter((id) => id !== resource.reviewUrl),
        ),
      );

      if (paths.length) {
        dispatch(
          UIActions.setOpenedFoldersIds({
            openedFolderIds: paths,
            featureType,
          }),
        );
      }
    },
    [dispatch],
  );

  const handlePublicationReview = useCallback(() => {
    const { toReview: conversationsToReview, reviewed: reviewedConversations } =
      getReviewItems(publication, resourcesToReview, isConversationId);
    const { toReview: promptsToReview, reviewed: reviewedPrompts } =
      getReviewItems(publication, resourcesToReview, isPromptId);
    const { toReview: applicationsToReview, reviewed: reviewedApplications } =
      getReviewItems(publication, resourcesToReview, isApplicationId);

    const startConversationsReview = () => {
      expandFoldersByFeatureType(
        conversationsToReview,
        reviewedConversations,
        FeatureType.Chat,
      );
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [
            getFirstReviewUrl(conversationsToReview, reviewedConversations),
          ],
        }),
      );
    };

    const startApplicationsReview = () => {
      const applicationId = getFirstReviewUrl(
        applicationsToReview,
        reviewedApplications,
      );
      dispatch(ApplicationActions.get({ applicationId }));
      dispatch(PublicationActions.setIsApplicationReview(true));
    };

    const startPromptsReview = () => {
      expandFoldersByFeatureType(
        promptsToReview,
        reviewedPrompts,
        FeatureType.Prompt,
      );
      const firstReviewPromptId = getFirstReviewUrl(
        promptsToReview,
        reviewedPrompts,
      );
      dispatch(
        PromptsActions.uploadPrompt({
          promptId: firstReviewPromptId,
        }),
      );
      dispatch(
        PromptsActions.selectPrompt({
          promptId: firstReviewPromptId,
          isApproveRequiredResource: true,
        }),
      );
    };

    if (conversationsToReview.length) {
      startConversationsReview();
      return;
    }

    if (promptsToReview.length) {
      startPromptsReview();
      return;
    }

    if (applicationsToReview.length) {
      startApplicationsReview();
      return;
    }

    if (reviewedConversations.length) {
      startConversationsReview();
    } else if (reviewedPrompts.length) {
      startPromptsReview();
    } else {
      startApplicationsReview();
    }
  }, [dispatch, expandFoldersByFeatureType, publication, resourcesToReview]);

  const invalidEntities = useMemo(
    () =>
      notExistEntities.filter((entity) =>
        publication.resources.some(
          (resource) => resource.reviewUrl === entity.id,
        ),
      ),
    [notExistEntities, publication.resources],
  );

  const isOnlyFilesPublication = publication.resources.every((resource) =>
    isFileId(resource.reviewUrl),
  );
  const publishToUrl = publication.targetFolder
    ? publication.targetFolder.replace(/^[^/]+/, 'Organization')
    : '';
  const publicationName = publication.name || getPublicationId(publication.url);
  const areRulesChanged =
    !isRulesLoading &&
    publication.rules &&
    !isEqual(publication.rules, rules[publication.targetFolder] || []);

  return (
    <div className="flex size-full flex-col items-center overflow-y-auto p-0 md:px-5 md:pt-5">
      <div
        className="flex size-full flex-col items-center gap-px rounded 2xl:max-w-[1000px]"
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

                {/*TODO remove publicationAuthor when publication.displayAuthor will be ready at the core side */}
                <PublicationInfoSection
                  labelDataQa="publication-display-author-label"
                  label={t("Author's public name: ")}
                  valueDataQa="publication-display-author"
                  valueToDisplay={
                    publication.displayAuthor ?? publicationAuthor
                  }
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
                <FiltersComponent
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
        <div
          className={classNames(
            'flex w-full items-center gap-5 rounded-t bg-layer-2 px-3 py-4 md:px-4',
            isOnlyFilesPublication ? 'justify-end' : 'justify-between',
          )}
        >
          {invalidEntities.length ? (
            <div className="flex items-center gap-3">
              <IconExclamationCircle
                size={24}
                className="shrink-0 text-error"
                stroke="1.5"
              />
              <p
                className="text-sm text-error"
                data-qa="duplicate-unpublishing"
              >
                {invalidEntities.map((e, idx) => (
                  <span key={e.id} className="italic">
                    &quot;
                    {e.name.substring(0, 50) === e.name
                      ? e.name
                      : `${e.name.substring(0, 50)}...`}
                    &quot;{idx === invalidEntities.length - 1 ? ' ' : ', '}
                  </span>
                ))}
                {t(
                  "have already been unpublished. You can't approve this request.",
                )}
              </p>
            </div>
          ) : (
            !isOnlyFilesPublication && (
              <button
                className="text-accent-primary"
                onClick={handlePublicationReview}
                data-qa="go-to-review"
              >
                {t(
                  resourcesToReview.some((r) => r.reviewed)
                    ? 'Continue review'
                    : 'Go to a review',
                )}
              </button>
            )
          )}
          <div className="flex gap-3">
            <button
              className="button button-secondary"
              onClick={() =>
                dispatch(
                  PublicationActions.rejectPublication({
                    url: publication.url,
                  }),
                )
              }
              data-qa="reject"
            >
              {t('Reject')}
            </button>
            <Tooltip
              hideTooltip={resourcesToReview.every((r) => r.reviewed)}
              tooltip={t(
                invalidEntities.length
                  ? "Request can't be approved as some conversations are unpublished"
                  : "It's required to review all resources",
              )}
            >
              <button
                className="button button-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                disabled={
                  !resourcesToReview.every((r) => r.reviewed) ||
                  !!invalidEntities.length
                }
                onClick={() =>
                  dispatch(
                    PublicationActions.approvePublication({
                      url: publication.url,
                    }),
                  )
                }
                data-qa="approve"
              >
                {t('Approve')}
              </button>
            </Tooltip>
          </div>
        </div>
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
