import { useMemo, useState } from 'react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getMcpToolsetStr,
  getModelName,
  getQuickAppConfig,
  getWebAPIToolsetStr,
  isQuickApp,
} from '@/src/utils/app/application';

import { CustomApplicationModel, Toolsets } from '@/src/types/applications';
import { QuickAppConfig } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors, UISelectors } from '@/src/store/selectors';

import { ChatI18nKeys } from '@/src/constants/i18n';

import {
  DialMarkdownEditor,
  type EditorTheme,
} from '@/src/components/Common/MarkdownEditor/MarkdownEditor';
import { MonacoEditor } from '@/src/components/Common/MonacoEditor';

import { MarketplaceEntityInfoRow } from '../MarketplaceEntityInfoRow';
import { DocumentField } from './DocumentField';

const editorOptions = { readOnly: true };

interface ReviewQuickAppSectionViewProps {
  config: QuickAppConfig;
}

const ReviewQuickAppSectionView = ({
  config,
}: ReviewQuickAppSectionViewProps) => {
  const { t } = useTranslation(Translation.Chat);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);
  const theme = useAppSelector(UISelectors.selectThemeState);
  const locale = useAppSelector(UISelectors.selectLocale);

  const editorTabs = useMemo(
    () => [
      {
        id: Toolsets.WebApiToolset,
        label: 'Web API',
        value: getWebAPIToolsetStr(config),
        language: 'json',
      },
      {
        id: Toolsets.McpToolset,
        label: 'MCP',
        value: getMcpToolsetStr(config),
        language: 'json',
      },
    ],
    [config],
  );

  const [activeTabId, setActiveTabId] = useState<Toolsets | undefined>(
    () => editorTabs[0]?.id,
  );

  return (
    <>
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.Model)}
        value={getModelName(modelsMap[config.model], locale)}
        valueClassName="max-w-[414px] break-all text-primary"
      />
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.Temperature)}
        value={config.temperature}
        valueClassName="max-w-[414px] break-all text-primary"
      />
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.DocumentUrls)}
        value={
          config.document_relative_url?.length ? (
            <div className="flex min-w-0 flex-col gap-2">
              {config.document_relative_url.map((url) => (
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
            value={config.instructions}
            height={200}
            theme={theme as EditorTheme}
            preview="preview"
            commands={[]}
            className="rounded-[5px]"
          />
        }
      />
      <MarketplaceEntityInfoRow
        label={t(ChatI18nKeys.Toolsets)}
        value={
          config.web_api_toolset || config.mcp_toolset ? (
            <MonacoEditor
              height={400}
              options={editorOptions}
              allowFullScreen
              files={editorTabs}
              activeFileId={activeTabId}
              onTabChange={(id) => setActiveTabId(id as Toolsets)}
            />
          ) : null
        }
        valueClassName=""
      />
    </>
  );
};

interface ReviewQuickAppSectionProps {
  application: CustomApplicationModel;
}

export const ReviewQuickAppSection = ({
  application,
}: ReviewQuickAppSectionProps) => {
  const config = isQuickApp(application)
    ? getQuickAppConfig(application)
    : null;

  if (!config) return null;

  return <ReviewQuickAppSectionView config={config} />;
};
