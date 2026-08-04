import { CatalogEntityType } from '@epam/ai-dial-catalog';
import {
  DIAL_ICON_SIZE,
  GhostIconButton,
  DialInput,
  DialSelect,
  DialTagInput,
  ElementSize,
} from '@epam/ai-dial-ui-kit';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import type { FC } from 'react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConnectMcpUrlContent from '../../../components/ConnectMcpUrlContent/ConnectMcpUrlContent';
import { ToolsetTransportType } from '../../../constants/toolsets';
import {
  ApiI18nKeys,
  BasicI18nKeys,
  ButtonsI18nKeys,
  ToolsetEditorI18nKeys,
} from '../../../constants/translation-keys';
import { useAppConfig } from '../../../context/AppConfigContext';
import type {
  ToolsetAuthFormData,
  ToolsetFormData,
  ToolsetFormErrors,
} from '../../../models/toolsets';
import { buildToolsetMcpUrl } from '../../../utils/mcp-endpoint-url';
import AuthSection from './AuthSection';

interface Props {
  form: ToolsetFormData;
  errors: ToolsetFormErrors;
  isSaving: boolean;
  toolsetId: string;
  isEditMode: boolean;
  onChange: (patch: Partial<ToolsetFormData>) => void;
  onAuthChange: (patch: Partial<ToolsetAuthFormData>) => void;
  onEnsureSaved: () => Promise<string | false>;
}

const SettingsForm: FC<Props> = ({
  form,
  errors,
  isSaving,
  toolsetId,
  isEditMode,
  onChange,
  onAuthChange,
  onEnsureSaved,
}) => {
  const { t } = useTranslation();
  const { config } = useAppConfig();
  const [isCopied, setIsCopied] = useState(false);

  const dialCoreExternalUrl = config.dialCoreExternalUrl;
  const isConnectVisible = Boolean(dialCoreExternalUrl) && Boolean(toolsetId);
  const mcpUrl = isConnectVisible
    ? buildToolsetMcpUrl(dialCoreExternalUrl ?? '', toolsetId)
    : '';

  const protocolOptions = useMemo(
    () => [
      { value: ToolsetTransportType.Http, label: 'HTTP' },
      {
        value: ToolsetTransportType.Sse,
        label: 'SSE',
        description: t(ToolsetEditorI18nKeys.ProtocolSseDeprecatedLabel),
      },
    ],
    [t],
  );

  const handleCopyEndpoint = async () => {
    if (!form.endpoint.trim()) return;
    try {
      await navigator.clipboard.writeText(form.endpoint.trim());
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard unavailable — nothing to surface.
    }
  };

  const handleProtocolChange = (next: string | string[]) => {
    if (typeof next === 'string') {
      onChange({ protocol: next as ToolsetTransportType });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <DialInput
            id="toolset-endpoint"
            value={form.endpoint}
            onChange={(value) => onChange({ endpoint: value ?? '' })}
            labelProps={{
              label: t(ApiI18nKeys.EndpointLabel),
              required: true,
            }}
            placeholder={t(BasicI18nKeys.UrlPlaceholder)}
            error={errors.endpoint || undefined}
            invalid={!!errors.endpoint}
          />
        </div>
        <GhostIconButton
          aria-label={t(ToolsetEditorI18nKeys.CopyUrlLabel)}
          size={ElementSize.Standard}
          onClick={handleCopyEndpoint}
          icon={
            isCopied ? (
              <IconCheck
                size={DIAL_ICON_SIZE.SM}
                className="text-success"
                aria-hidden
              />
            ) : (
              <IconCopy
                size={DIAL_ICON_SIZE.SM}
                className="text-secondary"
                aria-hidden
              />
            )
          }
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="dial-small-text text-secondary">
          {t(ToolsetEditorI18nKeys.ProtocolLabel)}
        </span>
        <DialSelect
          elementId="toolset-protocol"
          options={protocolOptions}
          value={form.protocol}
          onChange={handleProtocolChange}
        />
      </div>

      <DialTagInput
        elementId="toolset-allowed-tools"
        label={t(ToolsetEditorI18nKeys.AllowedToolsLabel)}
        placeholder={t(ToolsetEditorI18nKeys.AllowedToolsPlaceholder)}
        initialTags={form.allowedTools}
        onChange={(allowedTools) => onChange({ allowedTools })}
      />

      <AuthSection
        auth={form.auth}
        errors={errors}
        isSaving={isSaving}
        toolsetId={toolsetId}
        isEditMode={isEditMode}
        endpoint={form.endpoint}
        onAuthChange={onAuthChange}
        onEnsureSaved={onEnsureSaved}
      />

      {isConnectVisible && (
        <ConnectMcpUrlContent
          entityType={CatalogEntityType.Toolset}
          url={mcpUrl}
          copyLabelKey={ButtonsI18nKeys.CopyUrl}
          className="border-t border-tertiary pt-4"
        />
      )}
    </div>
  );
};

export default memo(SettingsForm);
