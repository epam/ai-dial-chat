'use client';

import { BackToButton } from './backToSelectOverlayMode';

import {
  ChatOverlayManager,
  ChatOverlayManagerOptions,
} from '@epam/ai-dial-overlay';
import React, { useCallback, useEffect, useRef, useState } from 'react';

interface ChatOverlayManagerWrapperProps {
  overlayManagerOptions: Omit<ChatOverlayManagerOptions, 'hostDomain'>;
}

export const ChatOverlayManagerWrapper: React.FC<
  ChatOverlayManagerWrapperProps
> = ({ overlayManagerOptions }) => {
  const overlayManager = useRef<ChatOverlayManager | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [dialogInfo, setDialogInfo] = useState('');
  const [created, setCreated] = useState(false);
  const [conversationIdInputValue, setConversationIdInputValue] = useState('');

  const handleDisplayInformation = useCallback((textToShow: string) => {
    dialogRef.current?.showModal();

    setDialogInfo(textToShow);
  }, []);

  useEffect(() => {
    if (!overlayManager.current) {
      overlayManager.current = new ChatOverlayManager();
      overlayManager.current.createOverlay({
        ...overlayManagerOptions,
        hostDomain: window.location.origin,
      });
      setCreated(true);
    }
  }, [overlayManagerOptions]);

  useEffect(() => {
    return () => {
      if (overlayManager.current && created) {
        overlayManager.current?.removeOverlay(overlayManagerOptions.id);
      }
    };
  }, [created, overlayManagerOptions.id]);

  useEffect(() => {
    overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      '@DIAL_OVERLAY/GPT_END_GENERATING',
      () => console.info('END GENERATING'),
    );

    overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      '@DIAL_OVERLAY/GPT_START_GENERATING',
      () => console.info('START GENERATING'),
    );

    overlayManager.current
      ?.getMessages(overlayManagerOptions.id)
      .then((messages) => {
        console.info(messages);
      });
  }, [overlayManagerOptions]);

  return (
    <div className="flex flex-col gap-2 p-2">
      <dialog ref={dialogRef} className="rounded p-5">
        <div className="flex justify-end">
          <button
            className="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
          >
            X
          </button>
        </div>
        <p className="whitespace-pre-wrap">{dialogInfo}</p>
      </dialog>

      <div className="flex max-w-[300px] flex-col gap-2">
        <BackToButton />
        <details>
          <summary>Chat actions</summary>

          <div className="flex flex-col gap-2">
            <button
              className="button"
              onClick={() => {
                overlayManager.current?.sendMessage(
                  overlayManagerOptions.id,
                  'Hello',
                );
              }}
            >
              Send &apos;Hello&apos; to Chat
            </button>

            <button
              className="button"
              onClick={() => {
                overlayManager.current?.setSystemPrompt(
                  overlayManagerOptions.id,
                  'End each word with string "!?!?!"',
                );
              }}
            >
              Set system prompt: End each word with string &quot;!?!?!&quot;
            </button>

            <button
              className="button"
              onClick={async () => {
                const messages = await overlayManager.current?.getMessages(
                  overlayManagerOptions.id,
                );

                handleDisplayInformation(JSON.stringify(messages, null, 2));
              }}
            >
              Get messages
            </button>

            <button
              className="button"
              onClick={async () => {
                const conversations =
                  await overlayManager.current?.getConversations(
                    overlayManagerOptions.id,
                  );

                handleDisplayInformation(
                  JSON.stringify(conversations, null, 2),
                );
              }}
            >
              Get conversations
            </button>

            <button
              className="button"
              onClick={async () => {
                const conversation =
                  await overlayManager.current?.createConversation(
                    overlayManagerOptions.id,
                  );

                handleDisplayInformation(JSON.stringify(conversation, null, 2));
              }}
            >
              Create conversation
            </button>

            <button
              className="button"
              onClick={async () => {
                const conversation =
                  await overlayManager.current?.createConversation(
                    overlayManagerOptions.id,
                    'test-inner-folder',
                  );

                handleDisplayInformation(JSON.stringify(conversation, null, 2));
              }}
            >
              Create conversation in inner folder
            </button>

            <div className="flex flex-col gap-1 border p-1">
              <button
                className="button"
                onClick={async () => {
                  const conversation =
                    await overlayManager.current?.selectConversation(
                      overlayManagerOptions.id,
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
              className="button"
              onClick={() => {
                const newOptions = {
                  ...overlayManagerOptions,
                  hostDomain: window.location.origin,
                };

                newOptions.theme = 'dark';
                newOptions.modelId = 'stability.stable-diffusion-xl';

                overlayManager.current?.setOverlayOptions(
                  overlayManagerOptions.id,
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
};
