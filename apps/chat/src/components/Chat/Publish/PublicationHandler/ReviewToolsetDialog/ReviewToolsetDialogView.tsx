import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelDescription } from '@/src/utils/app/application';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { PublicationSelectors, ToolsetSelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';
import { NA_VERSION } from '@/src/constants/publication';
import { AUTH_TYPE_OPTIONS } from '@/src/constants/toolsets';

import { PublicationControls } from '@/src/components/Chat/Publish/PublicationControls/PublicationControls';
import { ModelIcon } from '@/src/components/Chatbar/ModelIcon';
import { withRenderWhenEntities } from '@/src/components/Common/RenderWhen';
import { MarketplaceEntityTopic } from '@/src/components/Marketplace/MarketplaceEntityTopic';

import { MarketplaceEntityInfoRow } from '../MarketplaceEntityInfoRow';

interface ReviewToolsetDialogContentProps {
  toolset: ToolsetModel;
}

function ReviewToolsetDialogContent({
  toolset,
}: ReviewToolsetDialogContentProps) {
  const { t } = useTranslation(Translation.Chat);

  const selectedPublicationUrl = useAppSelector(
    PublicationSelectors.selectSelectedPublicationUrl,
  );
  const isResourceUnpublishing = useAppSelector((state) =>
    PublicationSelectors.selectIsResourceUnpublishing(
      state,
      selectedPublicationUrl ?? '',
      toolset.id,
    ),
  );

  const controlsEntity = useMemo(
    () => ({
      id: ApiUtils.decodeApiUrl(toolset.id),
      name: toolset.name,
      folderId: getFolderIdFromEntityId(toolset.id),
    }),
    [toolset.id, toolset.name],
  );
  const description = getModelDescription(toolset);

  return (
    <>
      <div className="flex flex-col gap-2 overflow-auto px-3 py-4 text-sm md:p-6">
        <h2 className="text-base font-semibold">
          {`${isResourceUnpublishing ? t(ChatI18nKeys.Unpublish) : t(ChatI18nKeys.Publish)} ${t(ChatI18nKeys.Toolset)}`}
        </h2>
        <div className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2">
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Name)}
            value={toolset.name}
            dataQa="entity-name"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Version)}
            value={toolset.version ?? NA_VERSION}
            dataQa="entity-version"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Icon)}
            value={
              <ModelIcon
                entity={toolset}
                entityId={toolset.id}
                size={60}
                isTooltipDisabled
              />
            }
            valueClassName=""
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Description)}
            value={description}
            dataQa="entity-description"
          />
          {toolset.topics?.length > 0 && (
            <MarketplaceEntityInfoRow
              label={t(ChatI18nKeys.Topics)}
              value={
                <div className="flex flex-wrap gap-1">
                  {toolset.topics.map((topic) => (
                    <MarketplaceEntityTopic key={topic} topic={topic} />
                  ))}
                </div>
              }
            />
          )}
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.Endpoint)}
            value={toolset.endpoint}
            dataQa="toolset-endpoint"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.TransportProtocol)}
            value={toolset.transport}
            dataQa="toolset-transport"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.AuthenticationType)}
            value={
              AUTH_TYPE_OPTIONS[toolset.authSettings?.authenticationType]?.name
            }
            dataQa="toolset-authentication-type"
          />
          <MarketplaceEntityInfoRow
            label={t(ChatI18nKeys.AllowedTools)}
            value={toolset.allowedTools?.join(', ')}
            dataQa="toolset-allowed-tools"
          />
        </div>
      </div>
      <div className="flex w-full items-center justify-end border-t border-tertiary px-3 py-4 md:px-5">
        <PublicationControls
          entity={controlsEntity}
          controlsClassNames="text-sm"
        />
      </div>
    </>
  );
}

export const ReviewToolsetDialogView =
  withRenderWhenEntities<ReviewToolsetDialogContentProps>({
    toolset: ToolsetSelectors.selectToolsetDetails,
  })(ReviewToolsetDialogContent);
