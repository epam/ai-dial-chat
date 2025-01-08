'use client';

import { ChatOverlay, ChatOverlayOptions } from '@epam/ai-dial-overlay';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ChatOverlayWrapperProps {
  overlayOptions: Omit<ChatOverlayOptions, 'hostDomain'>;
}

export const ChatOverlayWrapper: React.FC<ChatOverlayWrapperProps> = ({
  overlayOptions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlay = useRef<ChatOverlay | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [dialogInfo, setDialogInfo] = useState('');
  const [conversationIdInputValue, setConversationIdInputValue] = useState('');

  const handleDisplayInformation = useCallback((textToShow: string) => {
    dialogRef.current?.showModal();
    setDialogInfo(textToShow);
  }, []);

  const handleSelectConversation = useCallback(async () => {
    const selectResult = await overlay.current?.selectConversation(
      conversationIdInputValue,
    );

    handleDisplayInformation(
      JSON.stringify(selectResult?.conversation, null, 2),
    );
  }, [conversationIdInputValue, handleDisplayInformation]);

  useEffect(() => {
    if (!overlay.current) {
      overlay.current = new ChatOverlay(containerRef.current!, {
        ...overlayOptions,
        hostDomain: window.location.origin,
      });
    }
  }, [overlayOptions]);

  useEffect(() => {
    overlay.current?.subscribe('@DIAL_OVERLAY/GPT_END_GENERATING', () =>
      console.info('END GENERATING'),
    );

    overlay.current?.subscribe('@DIAL_OVERLAY/GPT_START_GENERATING', () =>
      console.info('START GENERATING'),
    );
    overlay.current?.subscribe(
      '@DIAL_OVERLAY/SELECTED_CONVERSATION_LOADED',
      async (info) => {
        console.info('Conversation selected - ');
        const { messages } = await overlay.current!.getMessages();
        console.info('messages', messages);

        console.info(JSON.stringify(info, null, 2));
      },
    );

    overlay.current?.getMessages().then((messages) => {
      console.info(messages);
    });
  }, [overlay]);

  return (
    <div className="flex gap-2 p-2">
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

      <div
        ref={containerRef}
        style={{
          height: 700,
          width: 500,
        }}
      ></div>

      <div className="flex max-w-[300px] flex-col gap-2">
        <details>
          <summary>Chat actions</summary>

          <div className="flex flex-col gap-2">
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
                overlay.current?.setSystemPrompt(
                  'End each word with string "!?!?!"',
                );
              }}
            >
              Set system prompt: End each word with string &quot;!?!?!&quot;
            </button>

            <button
              className="rounded bg-gray-200 p-2"
              onClick={async () => {
                const messages = await overlay.current?.getMessages();

                handleDisplayInformation(JSON.stringify(messages, null, 2));
              }}
            >
              Get messages
            </button>

            <button
              className="rounded bg-gray-200 p-2"
              onClick={async () => {
                const conversations = await overlay.current?.getConversations();

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
                  await overlay.current?.createConversation();

                handleDisplayInformation(JSON.stringify(conversation, null, 2));
              }}
            >
              Create conversation
            </button>

            <button
              className="rounded bg-gray-200 p-2"
              onClick={async () => {
                const conversation =
                  await overlay.current?.createConversation(
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
                onClick={handleSelectConversation}
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

                overlay.current?.setOverlayOptions(newOptions);
              }}
            >
              Set dark theme and new model
            </button>
          </div>
        </details>
      </div>
    </div>
  );
};
