import { IconHelp } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from 'next-i18next';

import { BackendResourceType } from '@/src/types/common';
import { Publication } from '@/src/types/publication';
import { Translation } from '@/src/types/translation';

import { useAppDispatch } from '@/src/store/hooks';
import { PublicationActions } from '@/src/store/publication/publication.reducers';

import CollapsibleSection from '../../Common/CollapsibleSection';
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
                  <span className="truncate">{publication.targetUrl}</span>
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
              <div className="px-5">
                <p className="my-4 flex items-center text-sm">
                  {t('Target Audience Filters')}
                  <IconHelp size={18} className="ml-2 text-secondary" />
                </p>
                {filters.map((v) => (
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
                ))}
              </div>
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
          <button className="text-accent-primary">
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
              className="button button-primary"
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
