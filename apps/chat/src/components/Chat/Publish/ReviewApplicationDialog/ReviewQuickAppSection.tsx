import { IconDownload, IconFile } from '@tabler/icons-react';

import { useTranslation } from '@/src/hooks/useTranslation';

import {
  getQuickAppConfig,
  getToolsetStr,
  isQuickApp,
} from '@/src/utils/app/application';
import { constructPath } from '@/src/utils/app/file';
import { splitEntityId } from '@/src/utils/app/shared-utils';
import { ApiUtils } from '@/src/utils/server/api';

import { CustomApplicationModel } from '@/src/types/applications';
import { QuickAppConfig } from '@/src/types/quick-apps';
import { Translation } from '@/src/types/translation';

import { useAppSelector } from '@/src/store/hooks';
import { ModelsSelectors } from '@/src/store/models/models.selectors';

import { MonacoEditor } from '@/src/components/Common/MonacoEditor';
import Tooltip from '@/src/components/Common/Tooltip';

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
            contentClassName="sm:max-w-[400px] max-w-[250px] break-all z-[100]"
            triggerClassName="truncate whitespace-pre"
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

const editorOptions = {
  readOnly: true,
};

interface ReviewQuickAppSectionViewProps {
  config: QuickAppConfig;
}

const ReviewQuickAppSectionView = ({
  config,
}: ReviewQuickAppSectionViewProps) => {
  const { t } = useTranslation(Translation.Chat);
  const modelsMap = useAppSelector(ModelsSelectors.selectModelsMap);

  return (
    <>
      {modelsMap[config.model] && (
        <div className="flex gap-4">
          <span className="w-[122px] text-secondary">{t('Model: ')}</span>
          <span className="max-w-[414px] break-all text-primary">
            {modelsMap[config.model]?.name}
          </span>
        </div>
      )}

      <div className="flex gap-4">
        <span className="w-[122px] text-secondary">{t('Temperature: ')}</span>
        <span className="max-w-[414px] break-all text-primary">
          {config.temperature}
        </span>
      </div>

      {!!config.document_relative_url?.length && (
        <div className="flex items-center gap-4">
          <span className="w-[122px] shrink-0 self-start text-secondary">
            {t('Document URLs: ')}
          </span>
          <span className="flex min-w-0 flex-col gap-2">
            {config.document_relative_url.map((url) => (
              <DocumentField key={url} url={url} />
            ))}
          </span>
        </div>
      )}

      {config.instructions && (
        <div className="flex gap-4">
          <span className="w-[122px] shrink-0 text-secondary">
            {t('Instructions: ')}
          </span>
          <span className="grow break-all text-primary">
            {config.instructions}
          </span>
        </div>
      )}

      {config.web_api_toolset && (
        <div className="flex gap-4">
          <span className="w-[122px] shrink-0 text-secondary">
            {t('Toolset: ')}
          </span>
          <MonacoEditor
            language="json"
            value={getToolsetStr(config)}
            options={editorOptions}
            height={400}
            allowFullScreen
          />
        </div>
      )}
    </>
  );
};

interface ReviewQuickAppSectionProps {
  application?: CustomApplicationModel;
}

export const ReviewQuickAppSection = ({
  application,
}: ReviewQuickAppSectionProps) => {
  const isQuickApplication = application && isQuickApp(application);
  const config = isQuickApplication ? getQuickAppConfig(application) : null;

  if (!isQuickApplication || !config) return null;

  return <ReviewQuickAppSectionView config={config} />;
};
