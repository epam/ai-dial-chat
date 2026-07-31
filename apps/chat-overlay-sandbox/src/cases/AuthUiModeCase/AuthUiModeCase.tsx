import {
  ChatOverlay,
  OverlayAuthUiMode,
  OverlayEventType,
} from '@epam/ai-dial-chat-overlay';
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
    <main className="auth-ui-mode-case">
      <h1>Provider auth UI mode case</h1>
      <p>
        Use provider IDs returned by your deployment. Test while signed out:
        configured providers appear in the login picker, and unconfigured
        providers keep the safe external-login default.
      </p>
      <p role="note">
        Same-window login is an explicit opt-in. Verify iframe compatibility for
        the provider and tenant before selecting it.
      </p>

      <fieldset className="auth-ui-mode-controls">
        <legend>auth.providerUiModes</legend>
        <p className="auth-ui-mode-controls__count" aria-live="polite">
          {providerModes.length}{' '}
          {providerModes.length === 1 ? 'provider' : 'providers'} configured
        </p>
        <div className="auth-ui-mode-controls__providers">
          {providerModes.map((provider, index) => (
            <div
              key={provider.fieldId}
              className="auth-ui-mode-controls__provider"
            >
              <label>
                Provider {index + 1} ID
                <input
                  type="text"
                  value={provider.id}
                  onChange={(event) =>
                    updateProviderId(index, event.target.value)
                  }
                />
              </label>
              <label>
                Provider {index + 1} mode
                <select
                  value={provider.mode}
                  onChange={(event) =>
                    updateProviderMode(
                      index,
                      event.target.value as OverlayAuthUiMode,
                    )
                  }
                >
                  <option value={OverlayAuthUiMode.External}>External</option>
                  <option value={OverlayAuthUiMode.SameWindow}>
                    Same window
                  </option>
                </select>
              </label>
              <button
                className="auth-ui-mode-controls__remove"
                type="button"
                aria-label={`Remove provider ${index + 1}`}
                disabled={providerModes.length === 1}
                onClick={() => removeProvider(provider.fieldId)}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="auth-ui-mode-controls__actions">
          <button type="button" onClick={addProvider}>
            Add provider
          </button>
          <button
            type="button"
            disabled={providerModes.length === 0}
            onClick={() => void clearProviderModes()}
          >
            Clear provider settings
          </button>
          <button type="button" onClick={() => void applyProviderModes()}>
            Apply auth settings
          </button>
        </div>
      </fieldset>

      <div ref={rootRef} className="auth-ui-mode-case__overlay" />
      <EventLog entries={log} />
    </main>
  );
};

export default memo(AuthUiModeCase);
