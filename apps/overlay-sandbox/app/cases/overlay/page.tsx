'use client';

import { ChatOverlay, ChatOverlayOptions } from '@epam/ai-dial-overlay';
import { Feature } from '@epam/ai-dial-shared';
import { useEffect, useRef } from 'react';

const overlayOptions: Omit<ChatOverlayOptions, 'hostDomain'> = {
  domain: 'http://localhost:3000',
  theme: 'light',
  modelId: 'gpt-4',
  enabledFeatures: [
    Feature.ConversationsSection,
    Feature.PromptsSection,
    Feature.TopSettings,
    Feature.TopClearConversation,
    Feature.TopChatInfo,
    Feature.TopChatModelSettings,
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
};

export default function Index() {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlay = useRef<ChatOverlay | null>(null);

  useEffect(() => {
    if (!overlay.current) {
      overlay.current = new ChatOverlay(containerRef.current!, {
        ...overlayOptions,
        hostDomain: window.location.origin,
      });
    }
  }, []);

  useEffect(() => {
    overlay.current?.subscribe('@DIAL_OVERLAY/GPT_END_GENERATING', () =>
      console.info('END GENERATING'),
    );

    overlay.current?.subscribe('@DIAL_OVERLAY/GPT_START_GENERATING', () =>
      console.info('START GENERATING'),
    );

    overlay.current?.getMessages().then((messages) => {
      console.info(messages);
    });
  }, [overlay]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex gap-2">
        <button
          className="rounded bg-gray-200 p-2"
          onClick={() => {
            overlay.current?.sendMessage('Hello');
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

            overlay.current?.setOverlayOptions(newOptions);
          }}
        >
          Update configuration on the fly
        </button>

        <button
          className="rounded bg-gray-200 p-2"
          onClick={() => {
            overlay.current?.setSystemPrompt(
              'End each word with string "!?!?!"',
            );
          }}
        >
          End each word with string &quot;!?!?!&quot;
        </button>
      </div>

      <div
        ref={containerRef}
        style={{
          height: 700,
          width: 500,
        }}
      ></div>
    </div>
  );
}
