import { IconDownload, IconFile } from '@tabler/icons-react';
import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import { getQuickApp2Config, isQuickApp2 } from '@/src/utils/app/application';
import { constructPath } from '@/src/utils/app/file';
import { isApplicationId } from '@/src/utils/app/id';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { ApiUtils, parseEntityApiKey } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
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
import {
  ModelsSelectors,
  SettingsSelectors,
  ToolsetSelectors,
} from '@/src/store/selectors';

import { AgentAndToolsetChip } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetChip';
import { Tooltip } from '@/src/components/Common/Tooltip';

import { Feature } from '@epam/ai-dial-shared';

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

  const isCodeInterpreterEnabled = useAppSelector((state) =>
    SettingsSelectors.isFeatureEnabled(state, Feature.CodeInterpreter),
  );

  const { agents, toolsets, isCodeInterpreter } = useMemo(
    () =>
      (config.tool_sets ?? []).reduce<{
        agents: (DialDeploymentSimpleTool & { name: string })[];
        toolsets: (MCPToolset & { name: string })[];
        isCodeInterpreter: boolean;
      }>(
        (acc, toolset) => {
          if (isDialDeploymentToolset(toolset)) {
            acc.agents = toolset.tools.map((tool) => ({
              ...tool,
              name: isApplicationId(tool.deployment_id)
                ? ApiUtils.decodeApiUrl(
                    parseEntityApiKey(splitEntityId(tool.deployment_id).name, {
                      parseVersion: true,
                    }).name,
                  )
                : tool.deployment_id,
            }));
          } else if (isMcpToolset(toolset)) {
            acc.toolsets.push({
              ...toolset,
              name:
                toolset.name ||
                ApiUtils.decodeApiUrl(
                  parseEntityApiKey(splitEntityId(toolset.dial_id).name, {
                    parseVersion: true,
                  }).name,
                ),
            });
          } else if (isCodeInterpreterToolset(toolset)) {
            acc.isCodeInterpreter = true;
          }
          return acc;
        },
        { agents: [], toolsets: [], isCodeInterpreter: false },
      ),
    [config.tool_sets],
  );

  const orchestratorModel = modelsMap[config.orchestrator.deployment.name];
  const orchestratorName = orchestratorModel
    ? orchestratorModel.name
    : !isApplicationId(config.orchestrator.deployment.name)
      ? ApiUtils.decodeApiUrl(
          parseEntityApiKey(
            splitEntityId(config.orchestrator.deployment.name).name,
            {
              parseVersion: true,
            },
          ).name,
        )
      : config.orchestrator.deployment.name;

  return (
    <>
      {isCodeInterpreterEnabled && isCodeInterpreter && (
        <div className="flex gap-4">
          <span className="w-[122px] text-secondary">
            {t('Code Interpreter: ')}
          </span>
          <span className="max-w-[414px] break-all text-primary">
            {t(isCodeInterpreter ? 'On' : 'Off')}
          </span>
        </div>
      )}
      <div className="flex gap-4">
        <span className="w-[122px] text-secondary">{t('Model: ')}</span>
        <span className="max-w-[414px] break-all text-primary">
          {orchestratorName}
        </span>
      </div>

      <div className="flex gap-4">
        <span className="w-[122px] text-secondary">{t('Temperature: ')}</span>
        <span className="max-w-[414px] break-all text-primary">
          {config.orchestrator.deployment.parameters.temperature}
        </span>
      </div>

      {(config.contexts?.length ?? 0) > 0 && (
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
          <div className="flex flex-wrap gap-2 text-primary">
            {agents.map((agent) => {
              const decodedId = ApiUtils.decodeApiUrl(agent.deployment_id);
              return (
                <AgentAndToolsetChip
                  key={decodedId}
                  item={modelsMap[decodedId]}
                  id={decodedId}
                  readonly
                />
              );
            })}
          </div>
        </div>
      )}

      {toolsets.length > 0 && (
        <div className="flex items-center gap-4">
          <span className="w-[122px] shrink-0 text-secondary">
            {t('Toolsets: ')}
          </span>
          <div className="flex flex-wrap gap-2 text-primary">
            {toolsets.map((toolset) => {
              const decodedId = ApiUtils.decodeApiUrl(toolset.dial_id);
              return (
                <AgentAndToolsetChip
                  key={decodedId}
                  item={toolsetsMap[decodedId]}
                  id={decodedId}
                  readonly
                />
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

interface ReviewQuickApp2SectionProps {
  application: CustomApplicationModel;
}

export const ReviewQuickApp2Section = ({
  application,
}: ReviewQuickApp2SectionProps) => {
  const isQuickApplication = isQuickApp2(application);
  const config = isQuickApplication ? getQuickApp2Config(application) : null;

  if (!isQuickApplication || !config) return null;

  return <ReviewQuickApp2SectionView config={config} />;
};
