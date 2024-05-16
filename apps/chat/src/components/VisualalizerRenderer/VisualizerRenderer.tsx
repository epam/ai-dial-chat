import { IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CustomVisualizer } from '@/src/types/custom-visualizers';

import {
  ConversationsActions,
  ConversationsSelectors,
} from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';

import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';

interface Props {
  attachmentUrl: string;
  renderer: CustomVisualizer;
  mimeType: string;
}

export const VisualizerRenderer = ({
  attachmentUrl,
  renderer,
  mimeType,
}: Props) => {
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const visualizer = useRef<VisualizerConnector | null>(null);

  const [ready, setReady] = useState<boolean>();
  const { url: rendererUrl, title: visualizerTitle } = renderer;

  const dispatch = useAppDispatch();

  const loadedCustomAttachmentData = useAppSelector(
    ConversationsSelectors.selectLoadedCustomAttachments,
  );

  //TODO implement attachmentDataLoading

  // const attachmentDataLoading = useAppSelector(
  //   ConversationsSelectors.selectCustomAttachmentLoading,
  // );

  const customAttachmentData = attachmentUrl
    ? loadedCustomAttachmentData.find((loadedData) =>
        loadedData.url.endsWith(attachmentUrl),
      )?.data
    : undefined;

  useEffect(() => {
    if (attachmentUrl && !customAttachmentData) {
      dispatch(
        ConversationsActions.getCustomAttachmentData({
          pathToAttachment: attachmentUrl,
        }),
      );
    }
  }, [attachmentUrl, customAttachmentData, dispatch]);

  const sendMessage = useCallback(
    async (visualizer: VisualizerConnector) => {
      await visualizer.ready();

      visualizer.send(VisualizerConnectorRequests.sendVisualizeData, {
        mimeType,
        visualizerData: customAttachmentData,
      });
    },
    [mimeType, customAttachmentData],
  );

  useEffect(() => {
    if (iframeContainerRef.current && !visualizer.current) {
      visualizer.current = new VisualizerConnector(iframeContainerRef.current, {
        domain: rendererUrl,
        hostDomain: window.location.origin,
        visualizerName: visualizerTitle,
      });

      return () => {
        visualizer.current?.destroy();
        visualizer.current = null;
      };
    }
  }, [rendererUrl, visualizerTitle]);

  useEffect(() => {
    if (ready && !!visualizer.current) {
      sendMessage(visualizer.current);
    }
  }, [ready, attachmentUrl, mimeType, sendMessage]);

  useEffect(() => {
    const postMessageListener = (
      event: MessageEvent<VisualizerConnectorRequest>,
    ) => {
      if (event.origin !== rendererUrl) return;

      if (
        event.data.type ===
        `${visualizerTitle}/${VisualizerConnectorEvents.readyToInteract}`
      ) {
        setReady(true);
      }
    };

    window.addEventListener('message', postMessageListener, false);

    return () => window.removeEventListener('message', postMessageListener);
  }, [visualizerTitle, rendererUrl]);

  if (!attachmentUrl) {
    return null;
  }

  return (
    <div ref={iframeContainerRef} className="h-[400px]">
      <div className="flex flex-row justify-between pr-10">
        <h2>{visualizerTitle}</h2>
        <button
          className="button button-secondary"
          onClick={() => visualizer.current && sendMessage(visualizer.current)}
        >
          <IconRefresh size={18} />
        </button>
      </div>
    </div>
  );
};
