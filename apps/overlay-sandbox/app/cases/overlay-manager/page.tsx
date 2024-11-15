'use client';

import {
  ChatOverlayManager,
  ChatOverlayManagerOptions,
} from '@epam/ai-dial-overlay';
import { Feature } from '@epam/ai-dial-shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const overlayOptions: Omit<ChatOverlayManagerOptions, 'hostDomain'> = {
  id: 'test',
  domain: process.env.NEXT_PUBLIC_OVERLAY_HOST!,
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
  iconSvg: `<svg viewBox="0 0 62 62" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M31 62C48.1208 62 62 48.1208 62 31C62 13.8792 48.1208 0 31 0C13.8792 0 0 13.8792 0 31C0 48.1208 13.8792 62 31 62Z" fill="url(#paint0_linear_601_2793)" fill-opacity="0.6"></path>
<path fill-rule="evenodd" clip-rule="evenodd" d="M31.5425 45.1922C32.9058 45.0974 34.2575 44.8769 35.5802 44.5334C37.2126 45.0316 38.9383 45.1443 40.6216 44.8628C40.6882 44.8521 40.7556 44.8469 40.8231 44.8473C41.4237 44.8473 42.2123 45.1961 43.3612 45.9323V44.7214C43.3615 44.5119 43.4174 44.3062 43.5233 44.1254C43.6292 43.9446 43.7812 43.7953 43.9638 43.6926C44.4637 43.4097 44.9287 43.0842 45.353 42.7257C47.027 41.3075 47.9725 39.4165 47.9725 37.4131C47.9725 36.7408 47.8659 36.0879 47.6644 35.464C48.1701 34.5204 48.5789 33.5284 48.8792 32.4996C49.8502 33.9547 50.3705 35.6638 50.375 37.4131C50.375 40.1353 49.1079 42.6734 46.9166 44.5296C46.5508 44.8391 46.1658 45.1252 45.7638 45.3859V48.2166C45.7638 49.1912 44.64 49.7511 43.8476 49.1718C43.0982 48.6116 42.3223 48.0879 41.5226 47.6024C41.2935 47.4654 41.0553 47.3443 40.8096 47.2401C40.1508 47.3389 39.4766 47.3893 38.7965 47.3893C36.0608 47.3893 33.5323 46.5698 31.5425 45.1922ZM17.0771 39.5308C13.6206 36.5994 11.625 32.6062 11.625 28.3263C11.625 19.5823 19.8749 12.5938 29.9479 12.5938C40.0229 12.5938 48.2728 19.5823 48.2728 28.3263C48.2728 37.0721 40.021 44.0607 29.9479 44.0607C28.8164 44.0607 27.6966 43.9735 26.5999 43.7991C26.1252 43.9115 24.2284 45.0391 21.4946 47.0347C20.5046 47.7594 19.0999 47.0599 19.0999 45.8413V41.013C18.3919 40.5667 17.716 40.0714 17.0771 39.5308ZM26.6658 40.8212C26.7491 40.8212 26.8344 40.827 26.9177 40.8406C27.9058 41.0072 28.9211 41.0924 29.9479 41.0924C38.4574 41.0924 45.2677 35.3226 45.2677 28.3263C45.2677 21.3319 38.4574 15.562 29.9479 15.562C21.4423 15.562 14.6281 21.3319 14.6281 28.3263C14.6281 31.7091 16.2188 34.8944 19.0321 37.2775C19.7393 37.8743 20.5162 38.4168 21.3493 38.8895C21.8162 39.153 22.1049 39.6451 22.1049 40.176V42.9602C24.2672 41.509 25.6893 40.8212 26.6658 40.8212ZM22.1379 31.2964C20.8107 31.2964 19.7354 30.2308 19.7354 28.9211C19.7354 27.6094 20.8107 26.5457 22.1379 26.5457C23.4651 26.5457 24.5404 27.6094 24.5404 28.9211C24.5404 30.2327 23.4651 31.2964 22.1379 31.2964ZM29.9479 31.2964C28.6208 31.2964 27.5454 30.2308 27.5454 28.9211C27.5454 27.6094 28.6208 26.5457 29.9479 26.5457C31.2751 26.5457 32.3504 27.6094 32.3504 28.9211C32.3504 30.2327 31.2751 31.2964 29.9479 31.2964ZM37.758 31.2964C36.4308 31.2964 35.3555 30.2308 35.3555 28.9211C35.3555 27.6094 36.4308 26.5457 37.758 26.5457C39.0852 26.5457 40.1605 27.6094 40.1605 28.9211C40.1605 30.2327 39.0852 31.2964 37.758 31.2964Z" fill="white" fill-opacity="0.6"></path>
<defs>
<linearGradient id="paint0_linear_601_2793" x1="0" y1="31" x2="62" y2="31" gradientUnits="userSpaceOnUse">
<stop stop-color="#00DBDE"></stop>
<stop offset="1" stop-color="#FC00FF"></stop>
</linearGradient>
</defs>
</svg>`,
};

export default function Index() {
  const overlayManager = useRef<ChatOverlayManager | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [dialogInfo, setDialogInfo] = useState('');
  const [conversationIdInputValue, setConversationIdInputValue] = useState('');

  const handleDisplayInformation = useCallback((textToShow: string) => {
    dialogRef.current?.showModal();

    setDialogInfo(textToShow);
  }, []);

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
      <dialog ref={dialogRef} className="rounded p-5">
        <div className="flex justify-end">
          <button
            className="rounded bg-gray-200 p-2"
            autoFocus
            onClick={() => dialogRef.current?.close()}
          >
            X
          </button>
        </div>
        <p className="whitespace-pre-wrap">{dialogInfo}</p>
      </dialog>

      <div className="flex max-w-[300px] flex-col gap-2">
        <details>
          <summary>Chat actions</summary>

          <div className="flex flex-col gap-2">
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
                overlayManager.current?.setSystemPrompt(
                  overlayOptions.id,
                  'End each word with string "!?!?!"',
                );
              }}
            >
              Set system prompt: End each word with string &quot;!?!?!&quot;
            </button>

            <button
              className="rounded bg-gray-200 p-2"
              onClick={async () => {
                const messages = await overlayManager.current?.getMessages(
                  overlayOptions.id,
                );

                handleDisplayInformation(JSON.stringify(messages, null, 2));
              }}
            >
              Get messages
            </button>

            <button
              className="rounded bg-gray-200 p-2"
              onClick={async () => {
                const conversations =
                  await overlayManager.current?.getConversations(
                    overlayOptions.id,
                  );

                handleDisplayInformation(
                  JSON.stringify(conversations, null, 2),
                );
              }}
            >
              Get conversations
            </button>

            <button
              className="rounded bg-gray-200 p-2"
              onClick={async () => {
                const conversation =
                  await overlayManager.current?.createConversation(
                    overlayOptions.id,
                  );

                handleDisplayInformation(JSON.stringify(conversation, null, 2));
              }}
            >
              Create conversation
            </button>

            <button
              className="rounded bg-gray-200 p-2"
              onClick={async () => {
                const conversation =
                  await overlayManager.current?.createConversation(
                    overlayOptions.id,
                    'test-inner-folder',
                  );

                handleDisplayInformation(JSON.stringify(conversation, null, 2));
              }}
            >
              Create conversation in inner folder
            </button>

            <div className="flex flex-col gap-1 border p-1">
              <button
                className="rounded bg-gray-200 p-2"
                onClick={async () => {
                  const conversation =
                    await overlayManager.current?.selectConversation(
                      overlayOptions.id,
                      conversationIdInputValue,
                    );

                  handleDisplayInformation(
                    JSON.stringify(conversation, null, 2),
                  );
                }}
              >
                Select conversation by ID
              </button>
              <textarea
                className="border"
                placeholder="Type conversation ID"
                value={conversationIdInputValue}
                onChange={(e) => setConversationIdInputValue(e.target.value)}
              />
            </div>
          </div>
        </details>
        <details>
          <summary>Overlay configuration</summary>

          <div>
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
              Set dark theme and new model
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
