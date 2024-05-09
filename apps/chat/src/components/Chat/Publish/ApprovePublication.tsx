import { IconHelpCircle } from '@tabler/icons-react';
import { useEffect, useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { isFileId } from '@/src/utils/app/id';

import { BackendResourceType } from '@/src/types/common';
import { Publication } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { ConversationsActions } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import {
  PublicationActions,
  PublicationSelectors,
} from '@/src/store/publication/publication.reducers';

import CollapsibleSection from '../../Common/CollapsibleSection';
import Tooltip from '../../Common/Tooltip';
import {
  ConversationPublicationResources,
  FilePublicationResources,
  PromptPublicationResources,
} from './PublicationResources';
import { TargetAudienceFilterComponent } from './TargetAudienceFilter';

import capitalize from 'lodash-es/capitalize';

interface Props {
  publication: Publication;
}

export function ApprovePublication({ publication }: Props) {
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
        name: capitalize(rule.source),
        function: rule.function,
        targets: rule.targets,
      })) || [],
    [publication.rules],
  );

  useEffect(() => {
    // we do not need to review files
    const resourcesToReview = publication.resources.filter(
      (r) => !isFileId(r.reviewUrl),
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
    const resourcesToReviewIds = resourcesToReview.filter(
      (r) =>
        !r.reviewed &&
        r.publicationUrl === publication.url &&
        !isFileId(r.reviewUrl),
    );

    dispatch(
      ConversationsActions.selectConversations({
        conversationIds: [
          resourcesToReviewIds.length
            ? resourcesToReviewIds[0].reviewUrl
            : resourcesToReview[0].reviewUrl,
        ],
      }),
    );
  };

  const sections = [
    {
      resourceType: BackendResourceType.CONVERSATION,
      sectionName: t('Conversations'),
      dataQa: 'conversations-to-approve',
      Component: ConversationPublicationResources,
    },
    {
      resourceType: BackendResourceType.PROMPT,
      sectionName: t('Prompts'),
      dataQa: 'prompts-to-approve',
      Component: PromptPublicationResources,
    },
    {
      resourceType: BackendResourceType.FILE,
      sectionName: t('Files'),
      dataQa: 'files-to-approve',
      Component: FilePublicationResources,
    },
  ];

  return (
    <div className="flex size-full flex-col items-center p-0 md:px-5 md:pt-5">
      <div className="flex size-full flex-col items-center gap-[1px] rounded 2xl:max-w-[1000px]">
        <div className="flex w-full items-center justify-center rounded-t bg-layer-2 p-4">
          <h4
            data-qa="app-name"
            className="w-full whitespace-pre text-center text-xl font-semibold"
          >
            {publication.url.split('/').slice(-1).shift()}
          </h4>
        </div>
        <div className="flex w-full flex-col gap-[1px] overflow-hidden rounded-b bg-layer-1 [&:first-child]:rounded-t">
          <div className="relative size-full gap-[1px] overflow-auto md:grid md:grid-cols-2 md:grid-rows-1">
            <div className="flex shrink flex-col divide-y divide-tertiary overflow-auto bg-layer-2 py-4">
              <div className="px-5">
                <label className="flex text-sm" htmlFor="approvePath">
                  {t('Publish to')}
                </label>
                <button
                  className="mt-4 flex w-full items-center rounded border border-primary bg-transparent px-3 py-2"
                  disabled
                >
                  <span className="truncate">
                    {publication.targetUrl.replace(/^[^/]+/, 'Organization')}
                  </span>
                </button>
                <div className="my-4">
                  <p className="text-xs text-secondary">
                    {t('Request creation date: ')}
                  </p>
                  <p className="mt-1 text-sm">
                    {new Date(publication.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <section className="px-5">
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
                  <h2 className="mt-4 flex items-center gap-4 text-sm">
                    {t(
                      'This publication will be available to all users in the organization',
                    )}
                  </h2>
                )}
              </section>
            </div>
            <div className="bg-layer-2 px-5 py-4">
              {sections.map(
                ({ dataQa, sectionName, Component, resourceType }) =>
                  publication.resourceTypes.includes(resourceType) && (
                    <CollapsibleSection
                      key={resourceType}
                      name={sectionName}
                      openByDefault
                      dataQa={dataQa}
                    >
                      <Component
                        resources={publication.resources}
                        forViewOnly
                      />
                    </CollapsibleSection>
                  ),
              )}
            </div>
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-2 rounded-t bg-layer-2 p-4">
          <button
            className="text-accent-primary"
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
