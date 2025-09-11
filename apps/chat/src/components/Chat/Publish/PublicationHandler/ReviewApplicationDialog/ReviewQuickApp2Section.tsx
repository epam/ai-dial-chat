import { IconDownload, IconFile } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getQuickApp2Config, isQuickApp2 } from '@/src/utils/app/application';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { EntityType } from '@/src/types/common';
import {
  DialDeploymentSimpleTool,
  MCPToolset,
  QuickApp2Config,
  isCodeInterpreterToolset,
  isDialDeploymentToolset,
  isMcpToolset,
} from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors, ToolsetSelectors } from '@/src/store/selectors';

import { AgentAndToolsetChip } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetChip';
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

  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const toolsetsMap = useAppSelector(ToolsetSelectors.selectToolsetsMap);

  const { agents, toolsets, isCodeInterpreter } = useMemo(
    () =>
      config.tool_sets?.reduce<{
        agents: DialDeploymentSimpleTool[];
        toolsets: MCPToolset[];
        isCodeInterpreter: boolean;
      }>(
        (acc, toolset) => {
          if (isDialDeploymentToolset(toolset)) {
            acc.agents = toolset.tools;
          } else if (isMcpToolset(toolset)) {
            acc.toolsets = [...acc.toolsets, toolset];
          } else if (isCodeInterpreterToolset(toolset)) {
            acc.isCodeInterpreter = true;
          }

          return acc;
        },
        { agents: [], toolsets: [], isCodeInterpreter: false },
      ),
    [config.tool_sets],
  );

  return (
    <>
      {isCodeInterpreter && (
        <div className="flex gap-4">
          <span className="w-[122px] text-secondary">
            {t('Code Interpreter: ')}
          </span>
          <span className="max-w-[414px] break-all text-primary">
            {t(isCodeInterpreter ? 'On' : 'Off')}
          </span>
        </div>
      )}
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
        <div className="flex items-center gap-4">
          <span className="w-[122px] shrink-0 text-secondary">
            {t('Agents: ')}
          </span>
          <span className="flex gap-2 text-primary">
            {agents.map((agent) => (
              <AgentAndToolsetChip
                key={agent.deployment_id}
                // TODO: handle case when model is not found (+ try search model in a review bucket when will be supported on core side)
                item={modelsMap[agent.deployment_id]!}
                readonly
              />
            ))}
          </span>
        </div>
      )}

      {toolsets.length > 0 && (
        <div className="flex gap-4">
          <span className="w-[122px] shrink-0 text-secondary">
            {t('Toolsets: ')}
          </span>
          <span className="flex gap-2 text-primary">
            {toolsets.map((toolset) => (
              <AgentAndToolsetChip
                key={toolset.name}
                item={
                  toolsetsMap[toolset.name] ?? {
                    id: toolset.name,
                    description: toolset.description,
                    name: toolset.name,
                    type: EntityType.Toolset,
                    reference: toolset.name,
                    isDefault: false,
                  }
                }
                readonly
              />
            ))}
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
