import { IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { CustomRenderer } from '@/src/types/custom-renderes';

import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { VisualizerConnector } from '@epam/visualizer-connector';

interface Props {
  attachmentUrl: string;
  renderer: CustomRenderer;
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
  const { Url: rendererUrl, Title } = renderer;

  const sendMessage = useCallback(
    async (visualizer: VisualizerConnector) => {
      await visualizer.ready();

      const visualizerData = {
        message: 'Hello, I am a message from the chat!',
      };

      visualizer.send(VisualizerConnectorRequests.sendVisualizeData, {
        mimeType,
        visualizerData,
      });
    },
    [mimeType],
  );

  useEffect(() => {
    if (iframeContainerRef.current && !visualizer.current) {
      visualizer.current = new VisualizerConnector(iframeContainerRef.current, {
        domain: rendererUrl,
        hostDomain: window.location.origin,
        visualizerName: Title,
      });
    }
  }, [Title, rendererUrl]);

  useEffect(() => {
    if (ready && visualizer.current) {
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
        `${Title}/${VisualizerConnectorEvents.readyToInteract}`
      ) {
        setReady(true);
      }
    };

    window.addEventListener('message', postMessageListener, false);

    return () => window.removeEventListener('message', postMessageListener);
  }, [Title, rendererUrl]);

  return (
    <div ref={iframeContainerRef}>
      <h2>{Title}</h2>
      <button
        className="button button-secondary mt-5"
        onClick={() => visualizer.current && sendMessage(visualizer.current)}
      >
        <IconRefresh />
      </button>
    </div>
  );
};
