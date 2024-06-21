import { IconHelpCircle } from '@tabler/icons-react';
import { useEffect, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import {
  getFolderIdFromEntityId,
  getParentFolderIdsFromEntityId,
} from '@/src/utils/app/folders';
import { isConversationId, isFileId, isPromptId } from '@/src/utils/app/id';
import { EnumMapper } from '@/src/utils/app/mappers';
import { getPublicationId } from '@/src/utils/app/publications';

import { FeatureType } from '@/src/types/common';
import { Publication, PublishActions } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { PromptsActions } from '@/src/store/prompts/prompts.reducers';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';
import { UIActions } from '@/src/store/ui/ui.reducers';

import CollapsibleSection from '../../Common/CollapsibleSection';
import Tooltip from '../../Common/Tooltip';
import {
  ConversationPublicationResources,
  FilePublicationResources,
  PromptPublicationResources,
} from './PublicationResources';
import { TargetAudienceFilterComponent } from './TargetAudienceFilter';

import startCase from 'lodash-es/startCase';
import toLower from 'lodash-es/toLower';
import uniq from 'lodash-es/uniq';

interface Props {
  publication: Publication;
}

export function HandlePublication({ publication }: Props) {
  const dispatch = useAppDispatch();

  const { t } = useTranslation(Translation.Chat);

  const resourcesToReview = useAppSelector((state) =>
    PublicationSelectors.selectResourcesToReviewByPublicationUrl(
      state,
      publication.url,
    ),
  );

  const filters = useMemo(
    () =>
      publication.rules?.map((rule) => ({
        id: rule.source,
        name: startCase(toLower(rule.source)),
        function: rule.function,
        targets: rule.targets,
      })) || [],
    [publication.rules],
  );

  useEffect(() => {
    // we do not need to review files
    const resourcesToReview = publication.resources.filter(
      (r) => !isFileId(r.targetUrl),
    );

    dispatch(
      PublicationActions.setPublicationsToReview({
        items: resourcesToReview.map((r) => ({
          reviewed: false,
          reviewUrl: r.reviewUrl,
          publicationUrl: publication.url,
        })),
      }),
    );
  }, [dispatch, publication.resources, publication.url]);

  const handlePublicationReview = () => {
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

    if (conversationsToReviewIds.length || reviewedConversationsIds.length) {
      const conversationPaths = uniq(
        [...conversationsToReviewIds, ...reviewedConversationsIds].flatMap(
          (p) =>
            getParentFolderIdsFromEntityId(
              getFolderIdFromEntityId(p.reviewUrl),
            ).filter((id) => id !== p.reviewUrl),
        ),
      );

      dispatch(
        UIActions.setOpenedFoldersIds({
          openedFolderIds: conversationPaths,
          featureType: FeatureType.Chat,
        }),
      );
      dispatch(
        ConversationsActions.selectConversations({
          conversationIds: [
            conversationsToReviewIds.length
              ? conversationsToReviewIds[0].reviewUrl
              : reviewedConversationsIds[0].reviewUrl,
          ],
        }),
      );
    }

    const promptsToReviewIds = resourcesToReview.filter(
      (r) =>
        !r.reviewed &&
        r.publicationUrl === publication.url &&
        isPromptId(r.reviewUrl),
    );
    const reviewedPromptsIds = resourcesToReview.filter(
      (r) => r.publicationUrl === publication.url && isPromptId(r.reviewUrl),
    );

    if (promptsToReviewIds.length || reviewedPromptsIds.length) {
      const promptPaths = uniq(
        [...promptsToReviewIds, ...reviewedPromptsIds].flatMap((p) => {
          const url = p.reviewUrl;

          return getParentFolderIdsFromEntityId(
            getFolderIdFromEntityId(url),
          ).filter((id) => id !== url);
        }),
      );

      dispatch(UIActions.setShowPromptbar(true));
      dispatch(
        UIActions.setOpenedFoldersIds({
          openedFolderIds: promptPaths,
          featureType: FeatureType.Prompt,
        }),
      );
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
    }
  };

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

  return (
    <div className="flex size-full flex-col items-center overflow-y-auto p-0 md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-[1px] rounded 2xl:max-w-[1000px]">
        <div className="flex w-full items-center justify-center rounded-t bg-layer-2 px-3 py-4 md:px-5">
          <Tooltip
            tooltip={getPublicationId(publication.url)}
            contentClassName="max-w-[400px] break-all"
            triggerClassName="truncate text-center w-full"
          >
            <h4
              data-qa="app-name"
              className="truncate whitespace-pre break-all text-center"
            >
              {publication.name || getPublicationId(publication.url)}
            </h4>
          </Tooltip>
        </div>
        <div className="flex w-full flex-col gap-[1px] overflow-hidden rounded-b bg-layer-1 [&:first-child]:rounded-t">
          <div className="relative size-full gap-[1px] overflow-auto md:grid md:grid-cols-2 md:grid-rows-1">
            <div className="flex shrink flex-col divide-y divide-tertiary overflow-auto bg-layer-2 md:py-4">
              <div className="px-3 py-4 md:px-5">
                {publication.resources[0].action !== PublishActions.DELETE ? (
                  <>
                    <label className="flex text-sm" htmlFor="approvePath">
                      {t('Publish to')}
                    </label>
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
                      >
                        <span className="w-full">{publishToUrl}</span>
                      </Tooltip>
                    </button>
                    <div className="my-4">
                      <p className="text-xs text-secondary">
                        {t('Request creation date: ')}
                      </p>
                      <p className="mt-1 text-sm">
                        {new Date(publication.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="flex text-sm" htmlFor="approvePath">
                      {t('General info')}
                    </label>
                    <div className="my-4 grid w-full grid-cols-3 gap-3 text-xs">
                      <p className="text-secondary">
                        <span>{t('Publication id: ')}</span>
                      </p>
                      <p className="text-secondary">{t('Path: ')}</p>
                      <span className="col-span-2 flex truncate whitespace-pre">
                        <Tooltip
                          tooltip={publication.targetFolder?.replace(
                            /^[^/]+/,
                            'Organization',
                          )}
                          contentClassName="max-w-[400px] break-all"
                          triggerClassName="truncate whitespace-pre"
                        >
                          {publication.targetFolder?.replace(
                            /^[^/]+/,
                            'Organization',
                          )}
                        </Tooltip>
                      </span>
                      <p className="text-secondary">
                        {t('Publication date: ')}
                      </p>
                      <span className="col-span-2">
                        {new Date(publication.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <section className="px-3 py-4 md:px-5">
                <h2 className="my-4 flex items-center gap-2 text-sm">
                  {t('Target Audience Filters')}

                  {!!filters.length && (
                    <Tooltip
                      placement="top"
                      tooltip={
                        <div className="flex max-w-[230px] break-words text-xs">
                          {t(
                            'The collection will be published for all users who meet AT LEAST ONE option from every',
                          )}
                        </div>
                      }
                    >
                      <IconHelpCircle
                        size={18}
                        className="text-secondary hover:text-accent-primary"
                      />
                    </Tooltip>
                  )}
                </h2>
                {filters.length ? (
                  filters.map((v) => (
                    <CollapsibleSection
                      name={v.name}
                      dataQa={`filter-${v.id}`}
                      key={`filter-${v.id}-${v.function}-${v.targets.join(',')}`}
                      openByDefault={false}
                      className="!pl-0"
                    >
                      <TargetAudienceFilterComponent
                        readonly
                        initialSelectedFilter={{
                          filterFunction: v.function,
                          filterParams: v.targets,
                          id: v.id,
                          name: v.name,
                        }}
                        name={v.name}
                        id={v.id}
                      />
                    </CollapsibleSection>
                  ))
                ) : (
                  <h2 className="mt-4 flex items-center gap-4 text-sm text-secondary">
                    {t(
                      'This publication will be available to all users in the organization',
                    )}
                  </h2>
                )}
              </section>
            </div>
            <div className="overflow-y-auto bg-layer-2 px-3 py-4 md:px-5">
              {sections.map(
                ({
                  dataQa,
                  sectionName,
                  Component,
                  featureType,
                  showTooltip,
                }) =>
                  publication.resourceTypes.includes(
                    EnumMapper.getBackendResourceTypeByFeatureType(featureType),
                  ) && (
                    <CollapsibleSection
                      key={featureType}
                      name={sectionName}
                      openByDefault
                      dataQa={dataQa}
                    >
                      <Component
                        resources={publication.resources}
                        forViewOnly
                        showTooltip={showTooltip}
                      />
                    </CollapsibleSection>
                  ),
              )}
            </div>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-2 rounded-t bg-layer-2 px-3 py-4 md:px-4">
          <button
            className="text-accent-primary"
            onClick={handlePublicationReview}
          >
            {t('Go to a review...')}
          </button>
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
            >
              {t('Reject')}
            </button>
            <Tooltip
              hideTooltip={resourcesToReview.every((r) => r.reviewed)}
              tooltip={t("It's required to review all resources")}
            >
              <button
                className="button button-primary disabled:cursor-not-allowed disabled:text-controls-disable"
                disabled={!resourcesToReview.every((r) => r.reviewed)}
                onClick={() =>
                  dispatch(
                    PublicationActions.approvePublication({
                      url: publication.url,
                    }),
                  )
                }
              >
                {t('Approve')}
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}
