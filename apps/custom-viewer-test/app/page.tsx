'use client';

import { ChatVisualizerConnector } from '@epam/ai-dial-chat-visualizer-connector';
import React, { useEffect, useRef } from 'react';

const setData = () => {
  return;
};

export default function Index() {
  const chatVisualizerConnector = useRef<ChatVisualizerConnector | null>(null);

  useEffect(() => {
    if (!chatVisualizerConnector.current) {
      chatVisualizerConnector.current = new ChatVisualizerConnector(
        process.env.NEXT_PUBLIC_VIEWER_HOST,
        process.env.NEXT_PUBLIC_APP_NAME,
        setData,
      );
      chatVisualizerConnector.current.sendReady();
      //Make some actions if needed
      chatVisualizerConnector.current.sendReadyToInteract();
      return () => {
        chatVisualizerConnector.current?.destroy();
        chatVisualizerConnector.current = null;
      };
    }
  }, []);

  return (
    <>
      <h1>Custom Viewer Test Page</h1>
      <p>This is a test page for the custom viewer.</p>
    </>
  );
}
