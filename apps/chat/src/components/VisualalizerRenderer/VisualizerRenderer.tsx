import { useEffect, useRef, useState } from 'react';

import { CustomRenderer } from '@/src/types/custom-renderes';

import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { VisualizerConnector } from '@epam/visualizer-connector';

interface Props {
  attachmentUrl: string;
  renderer: CustomRenderer;
}

export const VisualizerRenderer = ({ attachmentUrl, renderer }: Props) => {
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const visualizer = useRef<VisualizerConnector | null>(null);

  const [ready, setReady] = useState<boolean>();
  const { Url: rendererUrl, Title } = renderer;

  useEffect(() => {
    if (!visualizer.current) {
      visualizer.current = new VisualizerConnector(
        iframeContainerRef.current!,
        {
          domain: rendererUrl,
          hostDomain: window.location.origin,
          visualizerName: Title,
        },
      );
    }
  }, [Title, rendererUrl]);

  useEffect(() => {
    if (ready && visualizer.current) {
      visualizer.current.send(VisualizerConnectorRequests.sendVisualizeData, {
        attachmentData: {
          message: 'Hello, I am a message from the chat!',
          attachmentUrl: `${attachmentUrl}`,
        },
      });
    }
  }, [ready, attachmentUrl]);

  useEffect(() => {
    const postMessageListener = (event: MessageEvent<any>) => {
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
      <h1>{Title}</h1>
    </div>
  );
};
