import { useMemo } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getQuickApp2Config,
  getQuickAppItemNameFromConfig,
  isQuickApp2,
  migrateMCPToolsetIdName,
} from '@/src/utils/app/application';
import { isApplicationId } from '@/src/utils/app/id';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { ApiUtils, parseEntityApiKey } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import {
  DialDeploymentSimpleTool,
  MCPToolset,
  QuickApp2Config,
  UnknownToolset,
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
  UISelectors,
} from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import { AgentAndToolsetChip } from '@/src/components/Common/AgentAndToolsetSelector/AgentAndToolsetChip';
import { DialMarkdownEditor } from '@/src/components/Common/MarkdownEditor/MarkdownEditor';

import { MarketplaceEntityInfoRow } from '../MarketplaceEntityInfoRow';
import { DocumentField } from './DocumentField';

import { Feature } from '@epam/ai-dial-shared';
import groupBy from 'lodash-es/groupBy';

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
  const theme = useAppSelector(UISelectors.selectThemeState);

  const { agents, toolsets, unknownToolsets, isCodeInterpreter } = useMemo(
    () =>
      (config.tool_sets ?? []).reduce<{
        agents: (DialDeploymentSimpleTool & { name: string })[];
        toolsets: (MCPToolset & { name: string })[];
        unknownToolsets: (UnknownToolset & { name: string })[];
        isCodeInterpreter: boolean;
      }>(
        (acc, toolset) => {
          if (isDialDeploymentToolset(toolset)) {
            const { appTools = [], otherTools = [] } = groupBy(
              toolset.tools,
              (tool) =>
                modelsMap[ApiUtils.decodeApiUrl(tool.deployment_id)]
                  ? 'appTools'
                  : 'otherTools',
            );
            acc.agents = appTools.map((tool) => ({
              ...tool,
              name: getQuickAppItemNameFromConfig(tool),
            }));
            acc.unknownToolsets.push(
              ...otherTools.map((tool) => ({
                ...tool,
                name: getQuickAppItemNameFromConfig(tool),
              })),
            );
          } else if (isMcpToolset(toolset)) {
            acc.toolsets.push({
              ...toolset,
              name: getQuickAppItemNameFromConfig(
                migrateMCPToolsetIdName(toolset),
              ),
            });
          } else if (isCodeInterpreterToolset(toolset)) {
            acc.isCodeInterpreter = true;
          } else {
            acc.unknownToolsets.push({
              ...toolset,
              name: getQuickAppItemNameFromConfig(
                toolset as unknown as MCPToolset,
              ),
            });
          }
          return acc;
        },
        {
          agents: [],
          toolsets: [],
          unknownToolsets: [],
          isCodeInterpreter: false,
        },
      ),
    [config.tool_sets, modelsMap],
  );

  const orchestratorModel =
    modelsMap[config.orchestrator.deployment.deployment_id];
  const orchestratorName = orchestratorModel
    ? orchestratorModel.name
    : !isApplicationId(config.orchestrator.deployment.deployment_id)
      ? ApiUtils.decodeApiUrl(
          parseEntityApiKey(
            splitEntityId(config.orchestrator.deployment.deployment_id, true)
              .name,
            { parseVersion: true },
          ).name,
        )
      : config.orchestrator.deployment.deployment_id;
  const hasToolsets = toolsets.length > 0 || unknownToolsets.length > 0;

  return (
    <>
      {isCodeInterpreterEnabled && isCodeInterpreter && (
        <MarketplaceEntityInfoRow
          label={t(ChatI18nKeys.CodeInterpreter)}
          value={t(ChatI18nKeys.On)}
          valueClassName="max-w-[414px] break-all text-primary"
        />
      )}
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.Model)}
        value={orchestratorName}
        valueClassName="max-w-[414px] break-all text-primary"
      />
      {config.orchestrator.deployment.parameters?.temperature && (
        <MarketplaceEntityInfoRow
          label={t(ChatI18nKeys.Temperature)}
          value={config.orchestrator.deployment.parameters.temperature}
          valueClassName="max-w-[414px] break-all text-primary"
        />
      )}
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.DocumentUrls)}
        value={
          config.contexts?.length ? (
            <div className="flex min-w-0 flex-col gap-2">
              {config.contexts.map(({ url }) => (
                <DocumentField key={url} url={url} />
              ))}
            </div>
          ) : null
        }
        valueClassName=""
      />
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.Instructions)}
        valueClassName=""
        noTooltip
        value={
          <DialMarkdownEditor
            value={config.orchestrator.system_prompt.content}
            height={200}
            theme={theme}
            preview="preview"
            commands={[]}
            className="rounded-[5px]"
          />
        }
      />
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.Agents)}
        value={
          agents.length ? (
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
          ) : null
        }
        valueClassName=""
      />
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.Toolsets)}
        value={
          hasToolsets ? (
            <div className="flex flex-wrap gap-2 text-primary">
              {toolsets.map((toolset) => {
                const decodedId = ApiUtils.decodeApiUrl(toolset.deployment_id);
                return (
                  <AgentAndToolsetChip
                    key={decodedId}
                    item={toolsetsMap[decodedId]}
                    id={decodedId}
                    readonly
                  />
                );
              })}
              {unknownToolsets.map((toolset) => (
                <AgentAndToolsetChip
                  key={toolset.name}
                  id={toolset.name}
                  item={undefined}
                  readonly
                />
              ))}
            </div>
          ) : null
        }
        valueClassName=""
      />
    </>
  );
};

interface ReviewQuickApp2SectionProps {
  application: CustomApplicationModel;
}

export const ReviewQuickApp2Section = ({
  application,
}: ReviewQuickApp2SectionProps) => {
  const config = isQuickApp2(application)
    ? getQuickApp2Config(application)
    : null;

  if (!config) return null;

  return <ReviewQuickApp2SectionView config={config} />;
};
