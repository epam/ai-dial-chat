import { TAG_INPUT_TAG_CLASS_NAME } from '@epam/ai-dial-chat-shared';
import { Input, RadioGroup, Select, TagInput } from '@epam/ai-dial-ui-kit';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ToolsetTransportType } from '../../constants/toolsets';
import type {
  SettingsFormLabels,
  SettingsFormProps,
} from '../../models/settings-form-props';
import { isToolsetAuthValid } from '../../utils/toolsets';
import { AuthSection } from '../AuthSection/AuthSection';
import { ConnectMcpUrlContent } from '../ConnectMcpUrlContent/ConnectMcpUrlContent';

/** Setup section form: endpoint, protocol, allowed tools, authentication block, and the Connect section. */
export const SettingsForm: FC<SettingsFormProps> = ({
  form,
  errors,
  isSaving,
  toolsetId,
  isEditMode,
  connectUrl,
  listToolNames,
  authActions,
  oauthCallbackPath,
  onNotifySuccess,
  onNotifyError,
  onChange,
  onAuthChange,
  onEnsureSaved,
  labels,
}) => {
  /**
   * Discovered tool names for the "Allowed tools" picker, fetched from the
   * toolset's own MCP `tools/list` once it's saved and its auth is usable.
   * `null` means "show the free-text TagInput" — no server round trip failed
   * loudly here, since typing a tool name by hand must always stay possible.
   */
  const [availableToolNames, setAvailableToolNames] = useState<string[] | null>(
    null,
  );

  const isConnectVisible = Boolean(connectUrl) && Boolean(toolsetId);

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
    if (
      !toolsetId ||
      !listToolNames ||
      !isToolsetAuthValid(form.auth, isEditMode)
    ) {
      setAvailableToolNames(null);
      return;
    }

    let isCancelled = false;

    const loadToolNames = async () => {
      try {
        const toolNames = await listToolNames(toolsetId);
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
  }, [toolsetId, isEditMode, form.auth, form.endpoint, listToolNames]);

  return (
    <div className="flex max-w-[1060px] flex-col gap-4">
      <Input
        id="toolset-endpoint"
        value={form.endpoint}
        onChange={(value) => onChange({ endpoint: value ?? '' })}
        labelProps={{
          label: labels?.endpointLabel ?? 'Endpoint',
          required: true,
        }}
        placeholder={labels?.endpointPlaceholder ?? 'https://...'}
        caption={
          labels?.endpointCaption ??
          'The HTTPS address where the server accepts MCP requests.'
        }
        error={errors.endpoint || undefined}
        invalid={!!errors.endpoint}
      />

      <RadioGroup
        labelProps={{
          label: labels?.protocolLabel ?? 'Protocol',
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
            label: labels?.allowedToolsLabel ?? 'Allowed tools',
          }}
          placeholder={
            labels?.allowedToolsSelectPlaceholder ?? 'Select allowed tools'
          }
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
            label: labels?.allowedToolsLabel ?? 'Allowed tools',
          }}
          placeholder={
            labels?.allowedToolsPlaceholder ?? 'Add tools, comma separated'
          }
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
        authActions={authActions}
        oauthCallbackPath={oauthCallbackPath}
        onNotifySuccess={onNotifySuccess}
        onNotifyError={onNotifyError}
        onAuthChange={onAuthChange}
        onEnsureSaved={onEnsureSaved}
        labels={labels?.auth}
      />

      {isConnectVisible && (
        <ConnectMcpUrlContent
          url={connectUrl ?? ''}
          labels={labels?.connect}
          className="border-t border-tertiary pt-4"
        />
      )}
    </div>
  );
};
