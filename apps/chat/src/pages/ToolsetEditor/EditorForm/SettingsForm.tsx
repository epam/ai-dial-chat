import { buildToolsetMcpUrl } from '@epam/ai-dial-chat-hooks';
import {
  CatalogEntityType,
  TAG_INPUT_TAG_CLASS_NAME,
} from '@epam/ai-dial-chat-shared';
import { Input, RadioGroup, Select, TagInput } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
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
import { listMcpToolNames } from '../../../server-api/mcp-apps';
import { isToolsetAuthValid } from '../../../utils/toolsets';
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
  /**
   * Discovered tool names for the "Allowed tools" picker, fetched from the
   * toolset's own MCP `tools/list` once it's saved and its auth is usable.
   * `null` means "show the free-text TagInput" — no server round trip failed
   * loudly here, since typing a tool name by hand must always stay possible.
   */
  const [availableToolNames, setAvailableToolNames] = useState<string[] | null>(
    null,
  );

  const dialCoreExternalUrl = config.dialCoreExternalUrl;
  const isConnectVisible = Boolean(dialCoreExternalUrl) && Boolean(toolsetId);
  const mcpUrl = isConnectVisible
    ? buildToolsetMcpUrl(dialCoreExternalUrl ?? '', toolsetId)
    : '';

  const protocolOptions = useMemo(
    () => [
      { value: ToolsetTransportType.Http, label: 'HTTP' },
      { value: ToolsetTransportType.Sse, label: 'SSE' },
    ],
    [],
  );

  const handleProtocolChange = (next: string) => {
    onChange({ protocol: next as ToolsetTransportType });
  };

  useEffect(() => {
    if (!toolsetId || !isToolsetAuthValid(form.auth, isEditMode)) {
      setAvailableToolNames(null);
      return;
    }

    let isCancelled = false;

    const loadToolNames = async () => {
      try {
        const toolNames = await listMcpToolNames(toolsetId, 'toolset');
        if (!isCancelled) {
          setAvailableToolNames(toolNames.length > 0 ? toolNames : null);
        }
      } catch {
        if (!isCancelled) setAvailableToolNames(null);
      }
    };
    void loadToolNames();

    return () => {
      isCancelled = true;
    };
  }, [toolsetId, isEditMode, form.auth, form.endpoint]);

  return (
    <div className="flex max-w-[1060px] flex-col gap-4">
      <Input
        id="toolset-endpoint"
        value={form.endpoint}
        onChange={(value) => onChange({ endpoint: value ?? '' })}
        labelProps={{
          label: t(ApiI18nKeys.EndpointLabel),
          required: true,
        }}
        placeholder={t(BasicI18nKeys.UrlPlaceholder)}
        caption={t(ToolsetEditorI18nKeys.EndpointCaption)}
        error={errors.endpoint || undefined}
        invalid={!!errors.endpoint}
      />

      <RadioGroup
        labelProps={{
          label: t(ToolsetEditorI18nKeys.ProtocolLabel),
          required: true,
        }}
        id="toolset-protocol"
        items={protocolOptions}
        value={form.protocol}
        onChange={handleProtocolChange}
      />

      {availableToolNames ? (
        <Select
          id="toolset-allowed-tools"
          multiple
          searchable
          selectAll
          labelProps={{
            label: t(ToolsetEditorI18nKeys.AllowedToolsLabel),
          }}
          placeholder={t(ToolsetEditorI18nKeys.AllowedToolsSelectPlaceholder)}
          options={availableToolNames.map((toolName) => ({
            value: toolName,
            label: toolName,
          }))}
          value={form.allowedTools}
          onChange={(allowedTools) =>
            onChange({ allowedTools: allowedTools as string[] })
          }
        />
      ) : (
        <TagInput
          id="toolset-allowed-tools"
          labelProps={{
            label: t(ToolsetEditorI18nKeys.AllowedToolsLabel),
          }}
          placeholder={t(ToolsetEditorI18nKeys.AllowedToolsPlaceholder)}
          value={form.allowedTools}
          onChange={(allowedTools) => onChange({ allowedTools })}
          tagClassName={TAG_INPUT_TAG_CLASS_NAME}
        />
      )}

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
