import {
  ChatOverlay,
  OverlayEventType,
  OverlayFeature,
} from '@epam/ai-dial-chat-overlay';
import { Input, NeutralButton, PrimaryButton } from '@epam/ai-dial-ui-kit';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import EventLog from '../../components/EventLog/EventLog';
import MissingEnvNotice from '../../components/MissingEnvNotice/MissingEnvNotice';
import { getChatOverlayHost } from '../../env';

/** Named `enabledFeatures` combinations exercised by the preset buttons. */
const PRESETS: Record<string, OverlayFeature[]> = {
  'All defaults (sample)': [
    OverlayFeature.Header,
    OverlayFeature.ConversationsSection,
    OverlayFeature.ConversationsPanelToggle,
    OverlayFeature.Likes,
    OverlayFeature.ConversationsSharing,
    OverlayFeature.VoiceInput,
  ],
  'Header + sharing only': [
    OverlayFeature.Header,
    OverlayFeature.ConversationsSharing,
  ],
  'Empty set': [],
  /* Intentionally includes an unrecognized value to demonstrate the
   * "filtered with a warning, still applied" behavior from ui-feature-toggles. */
  'Header + invalid value (demo)': [
    OverlayFeature.Header,
    'not-a-real-feature' as OverlayFeature,
  ],
};

const normalizeCustomInput = (value: string): OverlayFeature[] =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0) as OverlayFeature[];

/*
 * Sandbox case demonstrating `setOverlayOptions({ enabledFeatures })` through
 * a direct `ChatOverlay` instance: preset combinations, a custom comma-separated
 * list, and a response log showing each call's `SetOverlayOptionsResponse`.
 */
const EnabledFeaturesCase: FC = () => {
  const host = getChatOverlayHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<ChatOverlay | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  }, []);

  useEffect(() => {
    if (!host || !rootRef.current) return;

    let isActive = true;
    setIsReady(false);

    const overlay = new ChatOverlay(rootRef.current, {
      domain: host,
      loaderHideEvent: OverlayEventType.Ready,
    });
    overlayRef.current = overlay;

    overlay
      .ready()
      .then(() => {
        if (!isActive) return;
        setIsReady(true);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      overlay.destroy();
      overlayRef.current = null;
      setIsReady(false);
    };
  }, [host]);

  const applyPreset = async (label: string, features: OverlayFeature[]) => {
    const response = await overlayRef.current?.setOverlayOptions({
      enabledFeatures: features,
    });
    appendLog(
      `setOverlayOptions({ enabledFeatures: ${JSON.stringify(features)} }) [${label}] -> ${JSON.stringify(response)}`,
    );
  };

  const applyCustom = async () => {
    const features = normalizeCustomInput(customInput);
    await applyPreset('custom', features);
  };

  if (!host) {
    return <MissingEnvNotice />;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">enabledFeatures case</h1>

      <p aria-live="polite">
        Ready: {isReady ? 'yes' : 'waiting for handshake...'}
      </p>
      <div className="my-3 flex flex-wrap gap-2">
        {Object.entries(PRESETS).map(([label, features]) => (
          <NeutralButton
            key={label}
            className="min-h-11"
            type="button"
            label={label}
            disabled={!isReady}
            onClick={() => void applyPreset(label, features)}
          />
        ))}
      </div>
      <div className="mb-3 flex flex-col items-stretch gap-2 desktop:flex-row desktop:items-end">
        <Input
          id="custom-input"
          containerClassName="min-w-0 flex-1"
          className="min-h-11"
          type="text"
          labelProps={{ label: 'Custom comma-separated list' }}
          value={customInput}
          onChange={(value) => setCustomInput(value ?? '')}
        />
        <PrimaryButton
          className="min-h-11"
          type="button"
          label="Apply custom list"
          disabled={!isReady}
          onClick={() => void applyCustom()}
        />
      </div>
      <div
        ref={rootRef}
        className="relative mb-4 h-[min(600px,78dvh)] w-[min(100%,380px)] desktop:h-[600px]"
      />

      <EventLog entries={log} onClear={() => setLog([])} />
    </div>
  );
};

export default memo(EnabledFeaturesCase);
