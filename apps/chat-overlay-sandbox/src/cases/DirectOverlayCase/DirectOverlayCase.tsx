import { ChatOverlay, OverlayEventType } from '@epam/ai-dial-chat-overlay';
import { DialNeutralButton } from '@epam/ai-dial-ui-kit';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import EventLog from '../../components/EventLog/EventLog';
import MissingEnvNotice from '../../components/MissingEnvNotice/MissingEnvNotice';
import { getChatOverlayHost } from '../../env';
import { runLoggedOverlayAction } from '../../logOverlayAction';

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
    await runLoggedOverlayAction(
      'getMessages',
      async () => overlayRef.current?.getMessages(),
      (response) => `getMessages -> ${JSON.stringify(response)}`,
      appendLog,
    );
  };

  const handleSendMessage = async () => {
    await runLoggedOverlayAction(
      'sendMessage',
      async () => overlayRef.current?.sendMessage('Hello from the sandbox'),
      (response) => `sendMessage -> ${JSON.stringify(response)}`,
      appendLog,
    );
  };

  const handleUpdateThemeAndModel = async () => {
    await runLoggedOverlayAction(
      'setOverlayOptions(theme, modelId)',
      async () =>
        overlayRef.current?.setOverlayOptions({
          theme: 'dark',
          modelId: 'gpt-4o',
        }),
      (response) =>
        `setOverlayOptions(theme, modelId) -> ${JSON.stringify(response)}`,
      appendLog,
    );
  };

  const handleUpdateThemeToLight = async () => {
    await runLoggedOverlayAction(
      'setOverlayOptions(theme: light)',
      async () => overlayRef.current?.setOverlayOptions({ theme: 'light' }),
      (response) =>
        `setOverlayOptions(theme: light) -> ${JSON.stringify(response)}`,
      appendLog,
    );
  };

  const handleSetInputContent = async () => {
    await runLoggedOverlayAction(
      'setInputContent',
      async () =>
        overlayRef.current?.setInputContent('Drafted from the sandbox'),
      () => 'setInputContent("Drafted from the sandbox")',
      appendLog,
    );
  };

  const handleSetSystemPrompt = async () => {
    await runLoggedOverlayAction(
      'setSystemPrompt',
      async () => overlayRef.current?.setSystemPrompt('Answer concisely.'),
      (response) => `setSystemPrompt -> ${JSON.stringify(response)}`,
      appendLog,
    );
  };

  const handleSetTemperature = async () => {
    await runLoggedOverlayAction(
      'setTemperature',
      async () => overlayRef.current?.setTemperature(0.2),
      (response) => `setTemperature -> ${JSON.stringify(response)}`,
      appendLog,
    );
  };

  if (!host) {
    return <MissingEnvNotice />;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold">Direct ChatOverlay case</h1>
      <p aria-live="polite">
        Ready: {isReady ? 'yes' : 'waiting for handshake...'}
      </p>
      {isHandshakeSlow && !isReady && <p role="alert">{handshakeHint}</p>}
      <div className="my-3 flex flex-wrap gap-2">
        <DialNeutralButton
          className="min-h-11"
          type="button"
          label="Get messages"
          onClick={handleGetMessages}
          disabled={!isReady}
        />
        <DialNeutralButton
          className="min-h-11"
          type="button"
          label="Send message"
          onClick={handleSendMessage}
          disabled={!isReady}
        />
        <DialNeutralButton
          className="min-h-11"
          type="button"
          label="Update theme + model"
          onClick={handleUpdateThemeAndModel}
          disabled={!isReady}
        />
        <DialNeutralButton
          className="min-h-11"
          type="button"
          label="Update theme to light"
          onClick={handleUpdateThemeToLight}
          disabled={!isReady}
        />
        <DialNeutralButton
          className="min-h-11"
          type="button"
          label="Set input content"
          onClick={handleSetInputContent}
          disabled={!isReady}
        />
        <DialNeutralButton
          className="min-h-11"
          type="button"
          label="Set system prompt"
          onClick={handleSetSystemPrompt}
          disabled={!isReady}
        />
        <DialNeutralButton
          className="min-h-11"
          type="button"
          label="Set temperature"
          onClick={handleSetTemperature}
          disabled={!isReady}
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

export default memo(DirectOverlayCase);
