import {
  ChatOverlayManager,
  OverlayEventType,
  OverlayPosition,
} from '@epam/ai-dial-chat-overlay';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import EventLog from '../../components/EventLog/EventLog';
import MissingEnvNotice from '../../components/MissingEnvNotice/MissingEnvNotice';
import { getChatOverlayHost } from '../../env';

const OVERLAY_ID = 'sandbox-manager-overlay';
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
 * Sandbox case demonstrating `ChatOverlayManager`: the v1 method/event
 * surface plus positioning, show/hide/remove, fullscreen open, and loader
 * hide configuration.
 */
const ManagerOverlayCase: FC = () => {
  const host = getChatOverlayHost();
  const managerRef = useRef<ChatOverlayManager | null>(null);
  const [isCreated, setIsCreated] = useState(false);
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
    if (!host) return;

    let isActive = true;
    setIsReady(false);
    setIsHandshakeSlow(false);
    setObservedEvents(new Set());

    const manager = new ChatOverlayManager();
    managerRef.current = manager;
    manager.createOverlay({
      overlayId: OVERLAY_ID,
      domain: host,
      position: OverlayPosition.RightBottom,
      allowFullscreen: true,
      loaderHideEvent: OverlayEventType.Ready,
    });
    setIsCreated(true);

    const unsubscribers = SUBSCRIBED_EVENTS.map((eventType) =>
      manager.subscribe(OVERLAY_ID, eventType, () => appendEventLog(eventType)),
    );

    const handshakeTimeoutId = window.setTimeout(() => {
      if (!isActive) return;
      setIsHandshakeSlow(true);
    }, HANDSHAKE_WARNING_TIMEOUT_MS);

    manager
      .ready(OVERLAY_ID)
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
      manager.destroy();
      managerRef.current = null;
      setIsCreated(false);
      setIsReady(false);
    };
  }, [appendEventLog, appendLog, host]);

  const handshakeHint = observedEvents.has(OverlayEventType.Ready)
    ? 'READY was received, but READY_TO_INTERACT is still pending. Check that the embedded chat route calls notifyConversationLoaded after the overlay options handshake.'
    : `Handshake is still pending. Check that the embedded chat backend has OVERLAY_ENABLED=true and ALLOWED_IFRAME_ORIGINS includes ${window.location.origin}.`;

  const handleShow = () => managerRef.current?.showOverlay(OVERLAY_ID);
  const handleHide = () => managerRef.current?.hideOverlay(OVERLAY_ID);
  const handleRemove = () => {
    managerRef.current?.removeOverlay(OVERLAY_ID);
    setIsCreated(false);
    setIsReady(false);
  };
  const handleOpenFullscreen = () => {
    void managerRef.current?.openFullscreen(OVERLAY_ID);
  };
  const handleGetMessages = async () => {
    const response = await managerRef.current?.getMessages(OVERLAY_ID);
    appendLog(`getMessages -> ${JSON.stringify(response)}`);
  };
  const handleSendMessage = async () => {
    const response = await managerRef.current?.sendMessage(
      OVERLAY_ID,
      'Hello from the manager sandbox',
    );
    appendLog(`sendMessage -> ${JSON.stringify(response)}`);
  };
  const handleUpdateThemeAndModel = async () => {
    const response = await managerRef.current?.setOverlayOptions(OVERLAY_ID, {
      theme: 'dark',
      modelId: 'gpt-4o',
    });
    appendLog(
      `setOverlayOptions(theme, modelId) -> ${JSON.stringify(response)}`,
    );
  };
  const handleUpdateThemeToLight = async () => {
    const response = await managerRef.current?.setOverlayOptions(OVERLAY_ID, {
      theme: 'light',
    });
    appendLog(`setOverlayOptions(theme: light) -> ${JSON.stringify(response)}`);
  };
  const handleSetInputContent = async () => {
    await managerRef.current?.setInputContent(
      OVERLAY_ID,
      'Drafted from the manager sandbox',
    );
    appendLog('setInputContent("Drafted from the manager sandbox")');
  };
  const handleClearInputContent = async () => {
    await managerRef.current?.setInputContent(OVERLAY_ID, '');
    appendLog('setInputContent("")');
  };
  const handleSetSystemPrompt = async () => {
    const response = await managerRef.current?.setSystemPrompt(
      OVERLAY_ID,
      'Answer concisely.',
    );
    appendLog(`setSystemPrompt -> ${JSON.stringify(response)}`);
  };
  const handleSetTemperature = async () => {
    const response = await managerRef.current?.setTemperature(OVERLAY_ID, 0.2);
    appendLog(`setTemperature -> ${JSON.stringify(response)}`);
  };

  if (!host) {
    return <MissingEnvNotice />;
  }

  return (
    <div className="manager-overlay-case">
      <h1>ChatOverlayManager case</h1>
      <p aria-live="polite">
        Ready: {isReady ? 'yes' : 'waiting for handshake...'}
      </p>
      {isHandshakeSlow && !isReady && <p role="alert">{handshakeHint}</p>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={handleShow} disabled={!isCreated}>
          Show overlay
        </button>
        <button type="button" onClick={handleHide} disabled={!isCreated}>
          Hide overlay
        </button>
        <button type="button" onClick={handleRemove} disabled={!isCreated}>
          Remove overlay
        </button>
        <button
          type="button"
          onClick={handleOpenFullscreen}
          disabled={!isCreated}
        >
          Open full screen
        </button>
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
          onClick={handleClearInputContent}
          disabled={!isReady}
        >
          Clear input content
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
      <EventLog entries={log} onClear={() => setLog([])} />
    </div>
  );
};

export default memo(ManagerOverlayCase);
