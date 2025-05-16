'use client';

import { BackToButton } from './backToSelectOverlayMode';

import {
  ChatOverlay,
  ChatOverlayOptions,
  OverlayConversation,
} from '@epam/ai-dial-overlay';
import React, { useCallback, useEffect, useRef, useState } from 'react';

export const commonOverlayProps = {
  domain: process.env.NEXT_PUBLIC_OVERLAY_HOST!,
  requestTimeout: 20000,
  loaderStyles: {
    background: 'white',
    fontSize: '24px',
  },
};

interface ChatOverlayWrapperProps {
  overlayOptions: Omit<ChatOverlayOptions, 'hostDomain'>;
}

export const ChatOverlayWrapper: React.FC<ChatOverlayWrapperProps> = ({
  overlayOptions,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlay = useRef<ChatOverlay | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [conversations, setConversations] = useState<OverlayConversation[]>([]);
  const [dialogInfo, setDialogInfo] = useState('');
  const [conversationIdInputValue, setConversationIdInputValue] = useState('');
  const [conversationNewName, setConversationNewName] = useState('');

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

  const handleRefreshConversations = useCallback(async () => {
    const convs = await overlay.current?.getConversations();
    setConversations(convs?.conversations ?? []);
  }, []);

  const handleDeleteConversation = useCallback(async () => {
    await overlay.current?.deleteConversation(conversationIdInputValue);
  }, [conversationIdInputValue]);

  const handleCreatePlaybackConversation = useCallback(async () => {
    const replayResult = await overlay.current?.createPlaybackConversation(
      conversationIdInputValue,
    );

    handleDisplayInformation(
      JSON.stringify(replayResult?.conversation, null, 2),
    );
  }, [conversationIdInputValue, handleDisplayInformation]);

  const handleExportConversation = useCallback(async () => {
    await overlay.current?.exportConversation(conversationIdInputValue);
  }, [conversationIdInputValue]);

  const handleRenameConversation = useCallback(async () => {
    const replayResult = await overlay.current?.renameConversation(
      conversationIdInputValue,
      conversationNewName,
    );

    handleDisplayInformation(
      JSON.stringify(replayResult?.conversation, null, 2),
    );
  }, [conversationIdInputValue, conversationNewName, handleDisplayInformation]);

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
            className="button"
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

      <div className="flex max-w-[600px] flex-col gap-2">
        <BackToButton />
        <details open={true} id="chat-actions">
          <summary>Chat actions</summary>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              <button
                className="button"
                onClick={() => {
                  overlay.current?.sendMessage('Hello');
                }}
                data-qa="send-message"
              >
                Send &apos;Hello&apos; to Chat
              </button>

              <button
                className="button"
                onClick={() => {
                  overlay.current?.setSystemPrompt(
                    'End each word with string "!?!?!"',
                  );
                }}
                data-qa="set-sys-prompt"
              >
                Set system prompt: End each word with string &quot;!?!?!&quot;
              </button>

              <button
                className="button"
                onClick={async () => {
                  const messages = await overlay.current?.getMessages();

                  handleDisplayInformation(JSON.stringify(messages, null, 2));
                }}
                data-qa="get-messages"
              >
                Get messages
              </button>

              <button
                className="button"
                onClick={async () => {
                  const conversations =
                    await overlay.current?.getConversations();

                  handleDisplayInformation(
                    JSON.stringify(conversations, null, 2),
                  );
                }}
                data-qa="get-conversations"
              >
                Get conversations
              </button>

              <button
                className="button"
                onClick={async () => {
                  const conversation =
                    await overlay.current?.createConversation();

                  handleDisplayInformation(
                    JSON.stringify(conversation, null, 2),
                  );
                }}
                data-qa="create-conversation"
              >
                Create conversation
              </button>

              <button
                className="button"
                onClick={async () => {
                  const conversation =
                    await overlay.current?.createConversation(
                      'test-inner-folder-root/test-inner-folder-child',
                    );

                  handleDisplayInformation(
                    JSON.stringify(conversation, null, 2),
                  );
                }}
                data-qa="create-conversation-in-folder"
              >
                Create conversation in inner folder
              </button>
            </div>

            <div className="flex flex-col gap-1 border p-1">
              <textarea
                className="border"
                placeholder="Type conversation ID"
                value={conversationIdInputValue}
                onChange={(e) => setConversationIdInputValue(e.target.value)}
                data-qa="conversation-id"
              />
              <div className="flex gap-1 overflow-x-hidden">
                <select
                  className="max-w-[70%] shrink"
                  value={conversationIdInputValue}
                  onChange={(e) =>
                    setConversationIdInputValue((e.target as any).value)
                  }
                >
                  {conversations.map((conv) => (
                    <option className="truncate" key={conv.id}>
                      {conv.id}
                    </option>
                  ))}
                </select>
                <button className="button" onClick={handleRefreshConversations}>
                  Refresh
                </button>
              </div>
              <div className="flex flex-col gap-1 border p-1">
                <button
                  className="button"
                  onClick={handleSelectConversation}
                  data-qa="select-conversation-by-id"
                >
                  Select conversation by ID
                </button>
                <button
                  className="button"
                  onClick={handleDeleteConversation}
                  data-qa="delete-conversation-by-id"
                >
                  Delete conversation by ID
                </button>
                <button
                  className="button"
                  onClick={handleCreatePlaybackConversation}
                  data-qa="playback-conversation-by-id"
                >
                  Create playback conversation by source conversation ID
                </button>
                <button
                  className="button"
                  onClick={handleExportConversation}
                  data-qa="export-conversation-by-id"
                >
                  Trigger Export conversation by source conversation ID
                </button>
                <div>
                  <button
                    className="button"
                    onClick={handleRenameConversation}
                    data-qa="rename-conversation-by-id"
                  >
                    Rename conversation by source conversation ID
                  </button>
                  <input
                    className="border"
                    placeholder="New name"
                    value={conversationNewName}
                    onChange={(e) => setConversationNewName(e.target.value)}
                    data-qa="conversation-new-name"
                  />
                </div>
              </div>
            </div>
          </div>
        </details>
        <details open={true} id="configuration">
          <summary>Overlay configuration</summary>

          <div>
            <button
              className="button w-full"
              onClick={() => {
                const newOptions = {
                  ...overlayOptions,
                  hostDomain: window.location.origin,
                };

                newOptions.theme = 'light';
                newOptions.modelId = 'stability.stable-diffusion-xl';

                overlay.current?.setOverlayOptions(newOptions);
              }}
              data-qa="set-configuration"
            >
              Set light theme and new model
            </button>
          </div>
        </details>
      </div>
    </div>
  );
};
