import { IconExclamationCircle } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'next-i18next';

import classNames from 'classnames';

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

import { FeatureType } from '@/src/types/common';
import { Publication, PublicationRule } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ApplicationActions } from '@/src/store/application/application.reducers';
import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { FilesSelectors } from '@/src/store/files/files.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.reducers';
import {
  PromptsActions,
  PromptsSelectors,
} from '@/src/store/prompts/prompts.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import { PUBLIC_URL_PREFIX } from '@/src/constants/public';

import CollapsibleSection from '../../Common/CollapsibleSection';
import { Spinner } from '../../Common/Spinner';
import Tooltip from '../../Common/Tooltip';
import { CompareRulesModal } from './CompareRulesModal';
import {
  ApplicationPublicationResources,
  ConversationPublicationResources,
  FilePublicationResources,
  PromptPublicationResources,
} from './PublicationResources';
import { ReviewApplicationDialog } from './ReviewApplicationDialog';
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

  return (
    <>
      {(!filteredRuleEntries.length ||
        filteredRuleEntries.every(([_, rules]) => !rules.length)) &&
        !publication.rules?.length && (
          <p className="text-sm text-secondary" data-qa="availability-label">
            {t(
              'This publication will be available to all users in the organization',
            )}
          </p>
        )}
      {filteredRuleEntries
        .filter(([_, rules]) => rules.length)
        .map(([path, rules]) => (
          <RuleListItem key={path} path={path} rules={rules} />
        ))}

      {!!publication.rules?.length && !!publication.targetFolder && (
        <RuleListItem path={publication.targetFolder} rules={newRules} />
      )}
    </>
  );
}

interface Props {
  publication: Publication;
}

export function PublicationHandler({ publication }: Props) {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const [isCompareModalOpened, setIsCompareModalOpened] = useState(false);

  const files = useAppSelector(FilesSelectors.selectFiles);
  const prompts = useAppSelector(PromptsSelectors.selectPrompts);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const publishRequestModels = useAppSelector(
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
      [...files, ...conversations, ...prompts, ...publishRequestModels].filter(
        (entity) => entity.publicationInfo?.isNotExist,
      ),
    [conversations, files, prompts, publishRequestModels],
  );

  useEffect(() => {
    if (publication.targetFolder !== PUBLIC_URL_PREFIX) {
      dispatch(
        PublicationActions.uploadRules({
          path: publication.targetFolder.split('/').slice(1).join('/'),
        }),
      );
    }
  }, [dispatch, publication.targetFolder]);

  const filteredRuleEntries = !publication.rules
    ? Object.entries(rules)
    : Object.entries(rules).filter(
        ([path]) => path !== publication.targetFolder,
      );
  const newRules: PublicationRule[] = useMemo(
    () =>
      publication.rules?.map((rule) => ({
        source: rule.source,
        function: rule.function,
        targets: rule.targets,
      })) || [],
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
          items: resourcesToReview.map((r) => ({
            reviewed: false,
            reviewUrl: r.reviewUrl,
            publicationUrl: publication.url,
          })),
        }),
      );
    }
  }, [dispatch, notExistEntities, publication.resources, publication.url]);

  const handlePublicationReview = useCallback(() => {
    const conversationsToReviewIds = resourcesToReview.filter(
      (r) =>
        !r.reviewed &&
        r.publicationUrl === publication.url &&
        isConversationId(r.reviewUrl),
    );
    const reviewedConversationsIds = resourcesToReview.filter(
      (r) =>
        r.publicationUrl === publication.url && isConversationId(r.reviewUrl),
    );

    const promptsToReviewIds = resourcesToReview.filter(
      (r) =>
        !r.reviewed &&
        r.publicationUrl === publication.url &&
        isPromptId(r.reviewUrl),
    );
    const reviewedPromptsIds = resourcesToReview.filter(
      (r) => r.publicationUrl === publication.url && isPromptId(r.reviewUrl),
    );

    const applicationsToReviewIds = resourcesToReview.filter(
      (r) =>
        !r.reviewed &&
        r.publicationUrl === publication.url &&
        isApplicationId(r.reviewUrl),
    );
    const reviewedApplicationsIds = resourcesToReview.filter(
      (r) =>
        r.publicationUrl === publication.url && isApplicationId(r.reviewUrl),
    );

    const expandFolders = () => {
      const conversationPaths = uniq(
        [...conversationsToReviewIds, ...reviewedConversationsIds].flatMap(
          (p) =>
            getParentFolderIdsFromEntityId(
              getFolderIdFromEntityId(p.reviewUrl),
            ).filter((id) => id !== p.reviewUrl),
        ),
      );

      if (conversationPaths.length) {
        dispatch(
          UIActions.setOpenedFoldersIds({
            openedFolderIds: conversationPaths,
            featureType: FeatureType.Chat,
          }),
        );
      }

      const promptPaths = uniq(
        [...promptsToReviewIds, ...reviewedPromptsIds].flatMap((p) =>
          getParentFolderIdsFromEntityId(
            getFolderIdFromEntityId(p.reviewUrl),
          ).filter((id) => id !== p.reviewUrl),
        ),
      );

      if (promptPaths.length) {
        dispatch(UIActions.setShowPromptbar(true));
        dispatch(
          UIActions.setOpenedFoldersIds({
            openedFolderIds: promptPaths,
            featureType: FeatureType.Prompt,
          }),
        );
      }
    };

    const startConversationsReview = () => {
      expandFolders();
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [
            conversationsToReviewIds.length
              ? conversationsToReviewIds[0].reviewUrl
              : reviewedConversationsIds[0].reviewUrl,
          ],
        }),
      );
    };

    const startApplicationsReview = () => {
      dispatch(
        ApplicationActions.get(
          applicationsToReviewIds.length
            ? applicationsToReviewIds[0].reviewUrl
            : reviewedApplicationsIds[0].reviewUrl,
        ),
      );
      dispatch(PublicationActions.setIsApplicationReview(true));
    };

    const startPromptsReview = () => {
      expandFolders();
      dispatch(
        PromptsActions.uploadPrompt({
          promptId: promptsToReviewIds.length
            ? promptsToReviewIds[0].reviewUrl
            : reviewedPromptsIds[0].reviewUrl,
        }),
      );
      dispatch(
        PromptsActions.setSelectedPrompt({
          promptId: promptsToReviewIds.length
            ? promptsToReviewIds[0].reviewUrl
            : reviewedPromptsIds[0].reviewUrl,
          isApproveRequiredResource: true,
        }),
      );
      dispatch(
        PromptsActions.setIsEditModalOpen({
          isOpen: true,
          isPreview: true,
        }),
      );
    };

    if (conversationsToReviewIds.length) {
      startConversationsReview();
      return;
    }

    if (promptsToReviewIds.length) {
      startPromptsReview();
      return;
    }

    if (applicationsToReviewIds.length) {
      startApplicationsReview();
      return;
    }

    if (reviewedConversationsIds.length) {
      startConversationsReview();
    } else if (reviewedPromptsIds.length) {
      startPromptsReview();
    } else {
      startApplicationsReview();
    }
  }, [dispatch, publication.url, resourcesToReview]);

  const sections = [
    {
      featureType: FeatureType.Chat,
      sectionName: t('Conversations'),
      dataQa: 'conversations-to-approve',
      Component: ConversationPublicationResources,
      showTooltip: true,
    },
    {
      featureType: FeatureType.Prompt,
      sectionName: t('Prompts'),
      dataQa: 'prompts-to-approve',
      Component: PromptPublicationResources,
      showTooltip: true,
    },
    {
      featureType: FeatureType.Application,
      sectionName: t('Applications'),
      dataQa: 'applications-to-approve',
      Component: ApplicationPublicationResources,
      showTooltip: true,
    },
    {
      featureType: FeatureType.File,
      sectionName: t('Files'),
      dataQa: 'files-to-approve',
      Component: FilePublicationResources,
      showTooltip: true,
    },
  ];

  const publishToUrl = publication.targetFolder
    ? publication.targetFolder.replace(/^[^/]+/, 'Organization')
    : '';
  const invalidEntities = notExistEntities.filter((entity) =>
    publication.resources.some((r) => r.reviewUrl === entity.id),
  );
  const isOnlyFilesPublication = publication.resources.every((resource) =>
    isFileId(resource.reviewUrl),
  );

  return (
    <div className="flex size-full flex-col items-center overflow-y-auto p-0 md:px-5 md:pt-5">
      <div
        className="flex size-full flex-col items-center gap-[1px] rounded 2xl:max-w-[1000px]"
        data-qa="publish-approval-modal"
      >
        <div className="flex w-full items-center rounded-t bg-layer-2 px-3 py-4 md:px-5">
          <Tooltip
            tooltip={publication.name || getPublicationId(publication.url)}
            contentClassName="max-w-[400px] break-all"
            triggerClassName="truncate"
          >
            <h4
              data-qa="publish-name"
              className="truncate whitespace-pre break-all text-base font-semibold"
            >
              {publication.name || getPublicationId(publication.url)}
            </h4>
          </Tooltip>
        </div>
        <div className="flex w-full flex-col gap-[1px] overflow-hidden rounded-b bg-layer-1 [&:first-child]:rounded-t">
          <div className="relative size-full gap-[1px] divide-y divide-tertiary overflow-auto md:grid md:grid-cols-2 md:grid-rows-1 md:divide-y-0">
            <div className="flex shrink flex-col divide-y divide-tertiary overflow-auto bg-layer-2 md:py-4">
              <div className="px-3 md:px-5">
                <h3 className="flex text-sm" data-qa="publish-to-label">
                  {t('Publish to')}
                </h3>
                <button
                  className="mt-4 flex w-full items-center rounded border border-primary bg-transparent px-3 py-2"
                  disabled
                >
                  <Tooltip
                    contentClassName="max-w-[400px] break-all"
                    triggerClassName="truncate whitespace-pre"
                    tooltip={
                      <div className="flex break-words">{publishToUrl}</div>
                    }
                    dataQa="publish-to-path"
                  >
                    <span className="w-full">{publishToUrl}</span>
                  </Tooltip>
                </button>
                <div className="my-4">
                  <p className="text-xs text-secondary" data-qa="creation-date">
                    {t('Request creation date: ')}
                  </p>
                  <p className="mt-1 text-sm" data-qa="publish-date">
                    {new Date(publication.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <section className="px-3 py-4 md:px-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm">
                  <div className="flex w-full justify-between">
                    <p data-qa="allow-access-label">
                      {t('Allow access if all match')}
                    </p>
                    {!isRulesLoading &&
                      (publication.rules &&
                      !isEqual(
                        publication.rules,
                        rules[publication.targetFolder] || [],
                      ) ? (
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
                      ))}
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
                  ({
                    dataQa,
                    sectionName,
                    Component,
                    featureType,
                    showTooltip,
                  }) =>
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
                              {t(' Unpublish')}
                            </span>
                          </>
                        }
                      >
                        <Component
                          resources={publication.resources}
                          readonly
                          showTooltip={showTooltip}
                        />
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
              <p className="text-sm text-error">
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
                {resourcesToReview.some((r) => r.reviewed)
                  ? t('Continue review')
                  : t('Go to a review')}
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
              tooltip={
                invalidEntities.length
                  ? t(
                      "Request can't be approved as some conversations are unpublished",
                    )
                  : t("It's required to review all resources")
              }
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
