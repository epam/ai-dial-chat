'use client';

import {
  ChatOverlayManager,
  ChatOverlayManagerOptions,
} from '@epam/ai-dial-overlay';
import { Feature } from '@epam/ai-dial-shared';
import { useEffect, useRef } from 'react';

const overlayOptions: Omit<ChatOverlayManagerOptions, 'hostDomain'> = {
  id: 'test',
  domain: process.env.E2E_OVERLAY_HOST ?? 'http://localhost:3000',
  theme: 'light',
  modelId: 'gpt-4',
  enabledFeatures: [
    Feature.ConversationsSection,
    Feature.PromptsSection,
    Feature.TopSettings,
    Feature.TopClearConversation,
    Feature.TopChatInfo,
    Feature.TopChatModelSettings,
    Feature.EmptyChatSettings,
    Feature.Header,
    Feature.Footer,
    Feature.RequestApiKey,
    Feature.ReportAnIssue,
    Feature.Likes,
  ],
  requestTimeout: 20000,
  loaderStyles: {
    background: 'white',
    fontSize: '24px',
  },
  allowFullscreen: true,
};

export default function Index() {
  const overlayManager = useRef<ChatOverlayManager | null>(null);

  useEffect(() => {
    if (!overlayManager.current) {
      overlayManager.current = new ChatOverlayManager();
      overlayManager.current.createOverlay({
        ...overlayOptions,
        hostDomain: window.location.origin,
      });
    }
  }, []);

  useEffect(() => {
    overlayManager.current?.subscribe(
      overlayOptions.id,
      '@DIAL_OVERLAY/GPT_END_GENERATING',
      () => console.info('END GENERATING'),
    );

    overlayManager.current?.subscribe(
      overlayOptions.id,
      '@DIAL_OVERLAY/GPT_START_GENERATING',
      () => console.info('START GENERATING'),
    );

    overlayManager.current?.getMessages(overlayOptions.id).then((messages) => {
      console.info(messages);
    });
  }, [overlayManager]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex gap-2">
        <button
          className="rounded bg-gray-200 p-2"
          onClick={() => {
            overlayManager.current?.sendMessage(overlayOptions.id, 'Hello');
          }}
        >
          Send &apos;Hello&apos; to Chat
        </button>

        <button
          className="rounded bg-gray-200 p-2"
          onClick={() => {
            const newOptions = {
              ...overlayOptions,
              hostDomain: window.location.origin,
            };

            newOptions.theme = 'dark';
            newOptions.modelId = 'stability.stable-diffusion-xl';

            overlayManager.current?.setOverlayOptions(
              overlayOptions.id,
              newOptions,
            );
          }}
        >
          Update configuration on the fly
        </button>

        <button
          className="rounded bg-gray-200 p-2"
          onClick={() => {
            overlayManager.current?.setSystemPrompt(
              overlayOptions.id,
              'End each word with string "!?!?!"',
            );
          }}
        >
          End each word with string &quot;!?!?!&quot;
        </button>
      </div>
    </div>
  );
}
