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
          (p) => {
            const url = p.reviewUrl;

            return getParentFolderIdsFromEntityId(
              getFolderIdFromEntityId(url),
            ).filter((id) => id !== url);
          },
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
    <div className="size-full flex-col items-center p-0 text-primary-bg-light md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-[1px] rounded-primary 2xl:max-w-[1000px]">
        <div className="flex w-full items-center justify-center rounded-t-primary bg-layer-2 p-4 shadow-primary">
          <h4
            data-qa="app-name"
            className="w-full whitespace-pre text-center text-base font-semibold"
          >
            {publication.resources[0].action !== PublishActions.DELETE
              ? t('Publication request for: ')
              : t('Unpublish: ')}
            {getPublicationId(publication.url)}
          </h4>
        </div>
        <div className="flex w-full flex-col gap-[1px] overflow-hidden bg-layer-1 [&:first-child]:rounded-t-primary">
          <div className="relative size-full gap-[1px] overflow-auto md:grid md:grid-cols-2 md:grid-rows-1">
            <div className="flex shrink flex-col divide-y divide-secondary overflow-auto bg-layer-2 py-4">
              <div className="px-5">
                {publication.resources[0].action !== PublishActions.DELETE ? (
                  <>
                    <label
                      className="flex text-sm font-medium"
                      htmlFor="approvePath"
                    >
                      {t('Publish to')}
                    </label>
                    <button
                      className="mt-4 flex w-full items-center rounded-primary border border-secondary bg-transparent px-3 py-2 shadow-primary"
                      disabled
                    >
                      <Tooltip
                        contentClassName="max-w-[400px] break-all"
                        triggerClassName="truncate whitespace-pre"
                        tooltip={
                          <div className="flex break-words text-xs">
                            {publishToUrl}
                          </div>
                        }
                      >
                        <span className="w-full">{publishToUrl}</span>
                      </Tooltip>
                    </button>
                    <div className="my-4">
                      <p className="text-xs font-medium text-secondary-bg-light">
                        {t('Request creation date: ')}
                      </p>
                      <p className="mt-1 text-sm">
                        {new Date(publication.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <label
                      className="flex text-sm font-medium"
                      htmlFor="approvePath"
                    >
                      {t('General info')}
                    </label>
                    <div className="my-4 grid w-full grid-cols-3 gap-3 text-xs">
                      <p className="text-secondary-bg-light">
                        <span>{t('Publication id: ')}</span>
                      </p>
                      <span className="col-span-2 truncate">
                        {getPublicationId(publication.url)}
                      </span>
                      <p className="text-secondary-bg-light">{t('Path: ')}</p>
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
                      <p className="text-secondary-bg-light">
                        {t('Publication date: ')}
                      </p>
                      <span className="col-span-2">
                        {new Date(publication.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </>
                )}
              </div>
              <section className="px-5">
                <h2 className="my-4 flex items-center gap-2 text-sm font-medium">
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
                        className="text-secondary-bg-light hover:text-accent-primary"
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
                  <h2 className="mt-4 flex items-center gap-4 text-sm">
                    {t(
                      'This publication will be available to all users in the organization',
                    )}
                  </h2>
                )}
              </section>
            </div>
            <div className="publication-sections overflow-y-auto bg-layer-2 px-5 py-4">
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
        <div className="flex w-full items-center justify-between gap-2 rounded-b-primary bg-layer-2 p-4 shadow-primary">
          <button
            className="text-quaternary-bg-light hover:text-pr-primary-700"
            onClick={handlePublicationReview}
          >
            {t('Go to a publication review...')}
          </button>
          <div>
            <button
              className="button button-secondary mr-3"
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
          </div>
        </div>
      </div>
    </div>
  );
}
