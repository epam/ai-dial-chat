import { IconDownload, IconFile } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getQuickApp2Config, isQuickApp2 } from '@/src/utils/app/application';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import {
  DialDeploymentTool,
  MCPToolset,
  QuickApp2Config,
  isDialDeploymentToolset,
} from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/selectors';

import { Tooltip } from '@/src/components/Common/Tooltip';

interface DocumentFieldProps {
  url?: string;
}

const DocumentField = ({ url }: DocumentFieldProps) => {
  const urlParts = url ? splitEntityId(url) : null;

  if (!url || !urlParts) return null;

  return (
    <div className="flex items-center gap-4">
      <div className="flex grow items-center gap-2 overflow-hidden">
        <div className="flex grow items-center gap-2 truncate">
          <span className="flex shrink-0">
            <IconFile size={18} className="text-secondary" />
          </span>

          <Tooltip
            tooltip={urlParts.name}
            triggerClassName="truncate whitespace-pre"
            contentClassName="break-all"
            dataQa="entity-name"
          >
            {urlParts.name}
          </Tooltip>
        </div>

        <a
          download={urlParts.name}
          href={constructPath('api', ApiUtils.encodeApiUrl(url))}
          data-qa="download"
        >
          <IconDownload
            className="shrink-0 text-secondary hover:text-accent-primary"
            size={18}
          />
        </a>
      </div>
    </div>
  );
};

interface ReviewQuickApp2SectionViewProps {
  config: QuickApp2Config;
}

const ReviewQuickApp2SectionView = ({
  config,
}: ReviewQuickApp2SectionViewProps) => {
  const { t } = useTranslation(Translation.Chat);

  const { agents, toolsets } = useMemo(
    () =>
      config.tool_sets?.reduce<{
        agents: DialDeploymentTool[];
        toolsets: MCPToolset[];
      }>(
        (acc, toolset) => {
          if (isDialDeploymentToolset(toolset)) {
            acc.agents = toolset.tools;
          } else {
            acc.toolsets = [...acc.toolsets, toolset];
          }

          return acc;
        },
        { agents: [], toolsets: [] },
      ),
    [config.tool_sets],
  );

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <>
      {modelsMap[config.orchestrator.deployment.name] && (
        <div className="flex gap-4">
          <span className="w-[122px] text-secondary">{t('Model: ')}</span>
          <span className="max-w-[414px] break-all text-primary">
            {modelsMap[config.orchestrator.deployment.name]?.name}
          </span>
        </div>
      )}

      <div className="flex gap-4">
        <span className="w-[122px] text-secondary">{t('Temperature: ')}</span>
        <span className="max-w-[414px] break-all text-primary">
          {config.orchestrator.deployment.parameters.temperature}
        </span>
      </div>

      {!!config.contexts?.length && (
        <div className="flex items-center gap-4">
          <span className="w-[122px] shrink-0 self-start text-secondary">
            {t('Document URLs: ')}
          </span>
          <span className="flex min-w-0 flex-col gap-2">
            {config.contexts.map(({ url }) => (
              <DocumentField key={url} url={url} />
            ))}
          </span>
        </div>
      )}

      {config.orchestrator.system_prompt.content && (
        <div className="flex gap-4">
          <span className="w-[122px] shrink-0 text-secondary">
            {t('Instructions: ')}
          </span>
          <span className="grow break-all text-primary">
            {config.orchestrator.system_prompt.content}
          </span>
        </div>
      )}

      {agents.length > 0 && (
        <div className="flex gap-4">
          <span className="w-[122px] shrink-0 text-secondary">
            {t('Agents: ')}
          </span>
          <span className="max-w-[414px] break-all text-primary">
            {agents.map((agent) => agent.deployment.name).join(', ')}
          </span>
        </div>
      )}

      {toolsets.length > 0 && (
        <div className="flex gap-4">
          <span className="w-[122px] shrink-0 text-secondary">
            {t('Toolsets: ')}
          </span>
          <span className="max-w-[414px] break-all text-primary">
            {toolsets.map((toolset) => toolset.name).join(', ')}
          </span>
        </div>
      )}
    </>
  );
};

interface ReviewQuickApp2SectionProps {
  application?: CustomApplicationModel;
}

export const ReviewQuickApp2Section = ({
  application,
}: ReviewQuickApp2SectionProps) => {
  const isQuickApplication = application && isQuickApp2(application);
  const config = isQuickApplication ? getQuickApp2Config(application) : null;

  if (!isQuickApplication || !config) return null;

  return <ReviewQuickApp2SectionView config={config} />;
};
