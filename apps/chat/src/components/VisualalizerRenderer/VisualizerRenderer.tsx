import { useEffect, useRef } from 'react';

import { CustomRenderer } from '@/src/types/custom-renderes';

import { VisualizerConnectorRequests } from '@epam/ai-dial-shared';
import { VisualizerConnector } from '@epam/visualizer-connector';

interface Props {
  attachmentUrl: string;
  renderer: CustomRenderer;
}

export const VisualizerRenderer = ({ attachmentUrl, renderer }: Props) => {
  const { Url: rendererUrl, Title } = renderer;

  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const visualizer = useRef<VisualizerConnector | null>(null);

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
  });

  useEffect(() => {
    visualizer.current?.send(
      VisualizerConnectorRequests.sendVisualizeData,
      {
        attachmentData: {
          message: 'Hello, I am a message from the chat!',
          attachmentUrl: `${attachmentUrl}`,
        },
      },
      false,
    );
  });

  return (
    <div ref={iframeContainerRef}>
      <h1>Renderer</h1>
    </div>
  );
};
