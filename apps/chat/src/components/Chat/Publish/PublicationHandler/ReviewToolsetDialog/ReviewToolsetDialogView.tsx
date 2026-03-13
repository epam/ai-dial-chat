import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getModelDescription } from '@/src/utils/app/application';
import { getFolderIdFromEntityId } from '@/src/utils/app/folders';
import { ApiUtils } from '@/src/utils/server/api';

import { ToolsetModel } from '@/src/types/toolsets';
import { Translation } from '@/src/types/translation';

import { ToolsetSelectors } from '@/src/store/selectors';

import { NA_VERSION } from '@/src/constants/publication';

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
        <h2 className="text-base font-semibold">{t('Toolset')}</h2>

        <MarketplaceEntityInfoRow
          label={t('Name')}
          value={toolset.name}
          dataQa="app-name"
        />
        <MarketplaceEntityInfoRow
          label={t('Version')}
          value={toolset.version ?? NA_VERSION}
          dataQa="app-version"
        />
        <MarketplaceEntityInfoRow
          label={t('Icon')}
          value={<ModelIcon entity={toolset} entityId={toolset.id} size={60} />}
          valueClassName=""
        />
        <MarketplaceEntityInfoRow
          label={t('Description')}
          value={description}
          dataQa="app-description"
        />
        {toolset.topics?.length && (
          <MarketplaceEntityInfoRow
            label={t('Topics')}
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
          label={t('Endpoint')}
          value={toolset.endpoint}
          dataQa="app-endpoint"
        />
        <MarketplaceEntityInfoRow
          label={t('Transport protocol')}
          value={toolset.transport}
          dataQa="app-transport"
        />
        <MarketplaceEntityInfoRow
          label={t('Authentication type')}
          value={toolset.authSettings?.authenticationType}
          dataQa="app-authentication-type"
        />
        <MarketplaceEntityInfoRow
          label={t('Allowed tools')}
          value={toolset.allowedTools?.join(', ')}
          dataQa="app-allowed-tools"
        />
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
