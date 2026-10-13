import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { Spinner } from '@epam/ai-dial-ui-kit';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';
import { type FC, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomViewerI18nKeys } from '../../constants/translation-keys';
import { useUser } from '../../context/auth/UserContext';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../hooks/language/useLanguage';
import type { CustomViewer } from '../../models/custom-viewer';
import {
  buildCustomViewerUrl,
  createLeadingDeduper,
  getViewerConversationId,
} from '../../utils/custom-viewer';

/* Bursts of the same conversation event collapse into one callback (0.x parity). */
const CONVERSATION_EVENT_WINDOW_MS = 300;

interface Props {
  /** The resolved viewer to embed. */
  viewer: CustomViewer;
  /** DIAL id of the open conversation; absent when the viewer is started from a new chat. */
  conversationId?: string;
  /** Moves focus into the viewer iframe once it is mounted. */
  shouldAutoFocus?: boolean;
  /** Called with the id from a `CREATED_CONVERSATION_SUCCESS` event. */
  onConversationCreated?: (conversationId: string) => void;
  /** Called with the id from an `UPDATED_CONVERSATION_SUCCESS` event. */
  onConversationUpdated?: (conversationId: string) => void;
}

const CustomViewerFrame: FC<Props> = ({
  viewer,
  conversationId,
  shouldAutoFocus = false,
  onConversationCreated,
  onConversationUpdated,
}) => {
  const { t } = useTranslation();
  const { user } = useUser();
  const { currentTheme } = useTheme();
  const { language } = useLanguage();
  const hostRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<VisualizerConnector | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { url, title, applicationId } = viewer;
  const providerId = user?.providerId;

  const iframeUrl = useMemo(
    () =>
      buildCustomViewerUrl({
        url,
        applicationId,
        conversationId,
        theme: currentTheme,
        authProvider: providerId,
      }),
    [url, applicationId, conversationId, currentTheme, providerId],
  );

  /* Read when the language changes, which re-renders through useLanguage. */
  const dir = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';

  const visualizeData = useMemo(
    () => ({
      mimeType: 'application/json',
      visualizerData: {
        isPreview: false,
        conversationId,
        layout: {
          width: 0,
          height: 0,
          themeId: currentTheme,
          currentLocale: language,
          dir,
        },
      },
    }),
    [conversationId, currentTheme, language, dir],
  );

  /* Callbacks are read through refs so a new identity never remounts the iframe. */
  const onCreatedRef = useRef(onConversationCreated);
  const onUpdatedRef = useRef(onConversationUpdated);
  useEffect(() => {
    onCreatedRef.current = onConversationCreated;
    onUpdatedRef.current = onConversationUpdated;
  }, [onConversationCreated, onConversationUpdated]);

  const frameTitle = t(CustomViewerI18nKeys.FrameTitle, {
    viewerTitle: title,
  });

  useEffect(() => {
    const hostElement = hostRef.current;
    if (!hostElement || !iframeUrl) return;

    setIsReady(false);
    const connector = new VisualizerConnector(hostElement, {
      domain: iframeUrl,
      hostDomain: window.location.origin,
      visualizerName: title,
    });
    connectorRef.current = connector;
    let isActive = true;

    const shouldHandle = createLeadingDeduper(CONVERSATION_EVENT_WINDOW_MS);
    const subscribeToConversationEvent = (
      event: VisualizerConnectorEvents,
      getCallback: () => ((id: string) => void) | undefined,
    ) =>
      connector.subscribe(`${title}/${event}`, (payload) => {
        const id = getViewerConversationId(payload);
        if (!id) {
          console.warn(
            `Custom viewer: ignored ${event} without a conversation id`,
          );
          return;
        }
        if (shouldHandle(`${event}:${id}`)) {
          getCallback()?.(id);
        }
      });

    const unsubscribeCreated = subscribeToConversationEvent(
      VisualizerConnectorEvents.createdConversationSuccess,
      () => onCreatedRef.current,
    );
    const unsubscribeUpdated = subscribeToConversationEvent(
      VisualizerConnectorEvents.updatedConversationSuccess,
      () => onUpdatedRef.current,
    );

    const waitForReady = async (): Promise<void> => {
      try {
        await connector.ready();
        if (isActive) setIsReady(true);
      } catch {
        /* The connector rejects its pending handshake when destroyed. */
      }
    };
    void waitForReady();

    return () => {
      isActive = false;
      unsubscribeCreated();
      unsubscribeUpdated();
      connector.destroy();
      connectorRef.current = null;
    };
  }, [iframeUrl, title]);

  /* The connector owns the iframe element, so its accessible name is set on the node it created. */
  useEffect(() => {
    const iframe = hostRef.current?.querySelector('iframe');
    if (!iframe) return;
    iframe.setAttribute('title', frameTitle);
    if (shouldAutoFocus) iframe.focus();
  }, [frameTitle, iframeUrl, title, shouldAutoFocus]);

  useEffect(() => {
    const connector = connectorRef.current;
    if (!isReady || !connector) return;

    const sendData = async (): Promise<void> => {
      try {
        await connector.send(
          VisualizerConnectorRequests.sendVisualizeData,
          visualizeData,
        );
      } catch {
        console.warn(
          `Custom viewer: ${VisualizerConnectorRequests.sendVisualizeData} failed`,
        );
      }
    };
    void sendData();
  }, [isReady, visualizeData]);

  if (!iframeUrl) {
    return (
      <div className="flex size-full items-center justify-center p-4">
        <p role="alert" className="text-start text-error">
          {t(CustomViewerI18nKeys.InvalidUrl)}
        </p>
      </div>
    );
  }

  return (
    <div className="relative size-full min-h-0">
      <div ref={hostRef} className="size-full" />
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-layer-base">
          <Spinner ariaLabel={t(CustomViewerI18nKeys.Loading)} />
        </div>
      )}
    </div>
  );
};

export default memo(CustomViewerFrame);
