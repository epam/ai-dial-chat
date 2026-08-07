import {
  ChatOverlay,
  OverlayAuthUiMode,
  OverlayEventType,
} from '@epam/ai-dial-chat-overlay';
import {
  DialDangerButton,
  Input,
  DialNeutralButton,
  DialPrimaryButton,
  DialSelectField,
} from '@epam/ai-dial-ui-kit';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import EventLog from '../../components/EventLog/EventLog';
import MissingEnvNotice from '../../components/MissingEnvNotice/MissingEnvNotice';
import { getChatOverlayHost } from '../../env';

interface ProviderModeField {
  fieldId: number;
  id: string;
  mode: OverlayAuthUiMode;
}

const DEFAULT_PROVIDER_MODES: ProviderModeField[] = [
  { fieldId: 0, id: 'keycloak', mode: OverlayAuthUiMode.SameWindow },
  { fieldId: 1, id: 'auth0', mode: OverlayAuthUiMode.External },
];

const toProviderUiModes = (
  fields: ProviderModeField[],
): Record<string, OverlayAuthUiMode> =>
  Object.fromEntries(
    fields
      .map(({ id, mode }) => [id.trim(), mode] as const)
      .filter(([id]) => id.length > 0),
  );

/** Exercises constructor and runtime updates for `auth.providerUiModes`. */
const AuthUiModeCase: FC = () => {
  const host = getChatOverlayHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<ChatOverlay | null>(null);
  const nextProviderFieldIdRef = useRef(DEFAULT_PROVIDER_MODES.length);
  const [providerModes, setProviderModes] = useState(DEFAULT_PROVIDER_MODES);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = useCallback((line: string) => {
    setLog((previous) => [
      ...previous,
      `${new Date().toLocaleTimeString()} ${line}`,
    ]);
  }, []);

  useEffect(() => {
    if (!host || !rootRef.current) return;

    const initialProviderUiModes = toProviderUiModes(DEFAULT_PROVIDER_MODES);
    const overlay = new ChatOverlay(rootRef.current, {
      domain: host,
      loaderHideEvent: OverlayEventType.Ready,
      auth: { providerUiModes: initialProviderUiModes },
    });
    overlayRef.current = overlay;
    appendLog(
      `Created with auth.providerUiModes=${JSON.stringify(initialProviderUiModes)}`,
    );

    return () => {
      overlay.destroy();
      overlayRef.current = null;
    };
  }, [appendLog, host]);

  const updateProviderId = (index: number, id: string) => {
    setProviderModes((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, id } : field,
      ),
    );
  };

  const updateProviderMode = (index: number, mode: OverlayAuthUiMode) => {
    setProviderModes((current) =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, mode } : field,
      ),
    );
  };

  const addProvider = () => {
    const fieldId = nextProviderFieldIdRef.current;
    nextProviderFieldIdRef.current += 1;
    setProviderModes((current) => [
      ...current,
      { fieldId, id: '', mode: OverlayAuthUiMode.External },
    ]);
  };

  const removeProvider = (fieldId: number) => {
    setProviderModes((current) =>
      current.length === 1
        ? current
        : current.filter((provider) => provider.fieldId !== fieldId),
    );
  };

  const applyProviderModes = async () => {
    const providerUiModes = toProviderUiModes(providerModes);
    const response = await overlayRef.current?.setOverlayOptions({
      auth: { providerUiModes },
    });
    appendLog(
      `setOverlayOptions({ auth: { providerUiModes: ${JSON.stringify(providerUiModes)} } }) -> ${JSON.stringify(response)}`,
    );
  };

  const clearProviderModes = async () => {
    setProviderModes([]);
    const response = await overlayRef.current?.setOverlayOptions({
      auth: { providerUiModes: {} },
    });
    appendLog(
      `setOverlayOptions({ auth: { providerUiModes: {} } }) -> ${JSON.stringify(response)}`,
    );
  };

  if (!host) {
    return <MissingEnvNotice />;
  }

  return (
    <main className="max-w-[960px] pb-6">
      <h1 className="text-3xl font-bold">Provider auth UI mode case</h1>
      <p>
        Use provider IDs returned by your deployment. Test while signed out:
        configured providers appear in the login picker, and unconfigured
        providers keep the safe external-login default.
      </p>
      <p role="note">
        Same-window login is an explicit opt-in. Verify iframe compatibility for
        the provider and tenant before selecting it.
      </p>

      <fieldset className="my-4 max-w-[720px] rounded-lg border border-secondary px-3 py-3">
        <legend className="px-1 font-semibold">auth.providerUiModes</legend>
        <p className="mb-3 mt-1 text-secondary" aria-live="polite">
          {providerModes.length}{' '}
          {providerModes.length === 1 ? 'provider' : 'providers'} configured
        </p>
        <div className="mb-3 grid grid-cols-1 gap-3">
          {providerModes.map((provider, index) => (
            <div
              key={provider.fieldId}
              className="grid grid-cols-1 gap-2 desktop:grid-cols-[repeat(2,minmax(0,1fr))_auto] desktop:items-end"
            >
              <Input
                id={`provider-${provider.fieldId}-id`}
                className="min-h-11"
                type="text"
                labelProps={{ label: `Provider ${index + 1} ID` }}
                value={provider.id}
                onChange={(value) => updateProviderId(index, value ?? '')}
              />
              <DialSelectField
                id={`provider-${provider.fieldId}-mode`}
                label={`Provider ${index + 1} mode`}
                selectClassName="min-h-11 w-full"
                value={provider.mode}
                options={[
                  {
                    value: OverlayAuthUiMode.External,
                    label: 'External',
                  },
                  {
                    value: OverlayAuthUiMode.SameWindow,
                    label: 'Same window',
                  },
                ]}
                onChange={(value) =>
                  updateProviderMode(index, value as OverlayAuthUiMode)
                }
              />
              <DialDangerButton
                className="min-h-11 w-full desktop:w-auto"
                type="button"
                label={<span aria-hidden>Remove</span>}
                aria-label={`Remove provider ${index + 1}`}
                disabled={providerModes.length === 1}
                onClick={() => removeProvider(provider.fieldId)}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <DialNeutralButton
            className="min-h-11"
            type="button"
            label="Add provider"
            onClick={addProvider}
          />
          <DialDangerButton
            className="min-h-11"
            type="button"
            label="Clear provider settings"
            disabled={providerModes.length === 0}
            onClick={() => void clearProviderModes()}
          />
          <DialPrimaryButton
            className="min-h-11"
            type="button"
            label="Apply auth settings"
            onClick={() => void applyProviderModes()}
          />
        </div>
      </fieldset>

      <div
        ref={rootRef}
        className="relative my-4 h-[min(600px,78dvh)] w-[min(100%,380px)] desktop:h-[600px]"
      />
      <EventLog entries={log} onClear={() => setLog([])} />
    </main>
  );
};

export default memo(AuthUiModeCase);
