import { ChatOverlay, OverlayEventType } from '@epam/ai-dial-chat-overlay';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import EventLog from '../../components/EventLog/EventLog';
import MissingEnvNotice from '../../components/MissingEnvNotice/MissingEnvNotice';
import { getChatOverlayHost } from '../../env';

const HANDSHAKE_WARNING_TIMEOUT_MS = 5000;

const SUBSCRIBED_EVENTS = [
  OverlayEventType.InitReady,
  OverlayEventType.Ready,
  OverlayEventType.ReadyToInteract,
  OverlayEventType.GptStartGenerating,
  OverlayEventType.GptEndGenerating,
  OverlayEventType.StopGenerating,
  OverlayEventType.SelectedConversationLoaded,
  OverlayEventType.ConversationsUpdated,
] as const;

/**
 * Sandbox case demonstrating the `ChatOverlay` class directly: the
 * `ready -> getMessages -> sendMessage` path, a `setOverlayOptions` update
 * after load, `setInputContent`/`setSystemPrompt`/`setTemperature`,
 * `loaderHideEvent`, and subscriptions to every v1 event.
 */
const DirectOverlayCase: FC = () => {
  const host = getChatOverlayHost();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<ChatOverlay | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isHandshakeSlow, setIsHandshakeSlow] = useState(false);
  const [observedEvents, setObservedEvents] = useState<
    ReadonlySet<OverlayEventType>
  >(new Set());
  const [log, setLog] = useState<string[]>([]);

  const appendLog = useCallback((line: string) => {
    setLog((prev) => [...prev, `${new Date().toLocaleTimeString()} ${line}`]);
  }, []);

  const appendEventLog = useCallback(
    (eventType: OverlayEventType) => {
      setObservedEvents((prev) => new Set(prev).add(eventType));
      appendLog(eventType);
    },
    [appendLog],
  );

  useEffect(() => {
    if (!host || !rootRef.current) return;

    let isActive = true;
    setIsReady(false);
    setIsHandshakeSlow(false);
    setObservedEvents(new Set());

    const overlay = new ChatOverlay(rootRef.current, {
      domain: host,
      loaderHideEvent: OverlayEventType.Ready,
    });
    overlayRef.current = overlay;

    const unsubscribers = SUBSCRIBED_EVENTS.map((eventType) =>
      overlay.subscribe(eventType, () => appendEventLog(eventType)),
    );

    const handshakeTimeoutId = window.setTimeout(() => {
      if (!isActive) return;
      setIsHandshakeSlow(true);
    }, HANDSHAKE_WARNING_TIMEOUT_MS);

    overlay
      .ready()
      .then(() => {
        if (!isActive) return;
        window.clearTimeout(handshakeTimeoutId);
        setIsReady(true);
      })
      .catch(() => {
        if (!isActive) return;
        window.clearTimeout(handshakeTimeoutId);
        appendLog('ready() rejected');
      });

    return () => {
      isActive = false;
      window.clearTimeout(handshakeTimeoutId);
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      overlay.destroy();
      overlayRef.current = null;
      setIsReady(false);
    };
  }, [appendEventLog, appendLog, host]);

  const handshakeHint = observedEvents.has(OverlayEventType.Ready)
    ? 'READY was received, but READY_TO_INTERACT is still pending. Check that the embedded chat route calls notifyConversationLoaded after the overlay options handshake.'
    : `Handshake is still pending. Check that the embedded chat backend has OVERLAY_ENABLED=true and ALLOWED_IFRAME_ORIGINS includes ${window.location.origin}.`;

  const handleGetMessages = async () => {
    const response = await overlayRef.current?.getMessages();
    appendLog(`getMessages -> ${JSON.stringify(response)}`);
  };

  const handleSendMessage = async () => {
    const response = await overlayRef.current?.sendMessage(
      'Hello from the sandbox',
    );
    appendLog(`sendMessage -> ${JSON.stringify(response)}`);
  };

  const handleUpdateThemeAndModel = async () => {
    const response = await overlayRef.current?.setOverlayOptions({
      theme: 'dark',
      modelId: 'gpt-4o',
    });
    appendLog(
      `setOverlayOptions(theme, modelId) -> ${JSON.stringify(response)}`,
    );
  };

  const handleUpdateThemeToLight = async () => {
    const response = await overlayRef.current?.setOverlayOptions({
      theme: 'light',
    });
    appendLog(`setOverlayOptions(theme: light) -> ${JSON.stringify(response)}`);
  };

  const handleSetInputContent = async () => {
    await overlayRef.current?.setInputContent('Drafted from the sandbox');
    appendLog('setInputContent("Drafted from the sandbox")');
  };

  const handleSetSystemPrompt = async () => {
    const response =
      await overlayRef.current?.setSystemPrompt('Answer concisely.');
    appendLog(`setSystemPrompt -> ${JSON.stringify(response)}`);
  };

  const handleSetTemperature = async () => {
    const response = await overlayRef.current?.setTemperature(0.2);
    appendLog(`setTemperature -> ${JSON.stringify(response)}`);
  };

  if (!host) {
    return <MissingEnvNotice />;
  }

  return (
    <div>
      <h1>Direct ChatOverlay case</h1>
      <p aria-live="polite">
        Ready: {isReady ? 'yes' : 'waiting for handshake...'}
      </p>
      {isHandshakeSlow && !isReady && <p role="alert">{handshakeHint}</p>}
      <div
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}
      >
        <button type="button" onClick={handleGetMessages} disabled={!isReady}>
          Get messages
        </button>
        <button type="button" onClick={handleSendMessage} disabled={!isReady}>
          Send message
        </button>
        <button
          type="button"
          onClick={handleUpdateThemeAndModel}
          disabled={!isReady}
        >
          Update theme + model
        </button>
        <button
          type="button"
          onClick={handleUpdateThemeToLight}
          disabled={!isReady}
        >
          Update theme to light
        </button>
        <button
          type="button"
          onClick={handleSetInputContent}
          disabled={!isReady}
        >
          Set input content
        </button>
        <button
          type="button"
          onClick={handleSetSystemPrompt}
          disabled={!isReady}
        >
          Set system prompt
        </button>
        <button
          type="button"
          onClick={handleSetTemperature}
          disabled={!isReady}
        >
          Set temperature
        </button>
      </div>
      <div
        ref={rootRef}
        style={{
          position: 'relative',
          width: 'min(100%, 380px)',
          height: 600,
          marginBottom: 16,
        }}
      />
      <EventLog entries={log} />
    </div>
  );
};

export default memo(DirectOverlayCase);
