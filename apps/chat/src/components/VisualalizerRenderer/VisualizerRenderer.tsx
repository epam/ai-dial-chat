import { IconRefresh } from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CustomRenderer } from '@/src/types/custom-renderes';

import {
  VisualizerConnectorEvents,
  VisualizerConnectorRequest,
  VisualizerConnectorRequests,
} from '@epam/ai-dial-shared';
import { VisualizerConnector } from '@epam/ai-dial-visualizer-connector';

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
  //This is for the MVP only.
  //TODO should be changed to get visualizer data like for the Plotly (TBD);
  const visualizerData: Record<string, unknown> = useMemo(
    () => ({
      dataToRender: attachmentUrl,
    }),
    [attachmentUrl],
  );

  const sendMessage = useCallback(
    async (visualizer: VisualizerConnector) => {
      await visualizer.ready();

      visualizer.send(VisualizerConnectorRequests.sendVisualizeData, {
        mimeType,
        visualizerData,
      });
    },
    [mimeType, visualizerData],
  );

  useEffect(() => {
    if (iframeContainerRef.current && !visualizer.current) {
      visualizer.current = new VisualizerConnector(iframeContainerRef.current, {
        domain: rendererUrl,
        hostDomain: window.location.origin,
        visualizerName: Title,
      });

      return () => {
        visualizer.current?.destroy();
        visualizer.current = null;
      };
    }
  }, [rendererUrl, Title]);

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
      <div className="flex flex-row justify-between pr-10">
        <h2>{Title}</h2>
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
