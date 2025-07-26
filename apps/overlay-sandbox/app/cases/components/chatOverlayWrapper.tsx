'use client';

import { BackToButton } from './backToSelectOverlayMode';

import {
  ChatOverlay,
  ChatOverlayOptions,
  Feature,
  OverlayConversation,
  OverlayEvents,
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
  const [importedConversation, setImportedConversation] = useState('');
  const [messageIndex, setMessageIndex] = useState('0');
  const [inputContent, setInputContent] = useState('');

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

  const handleDeleteMessage = useCallback(async () => {
    const messageIndexValue = parseInt(messageIndex, 10);
    if (isNaN(messageIndexValue)) return;

    const result = await overlay.current?.deleteMessage(messageIndexValue);
    handleDisplayInformation(JSON.stringify(result?.messages, null, 2));
  }, [messageIndex, handleDisplayInformation]);

  const handleUpdateMessage = useCallback(async () => {
    const messages = (await overlay.current?.getMessages())?.messages;

    if (!messages) {
      return;
    }

    const messageIndexValue = parseInt(messageIndex, 10);
    if (isNaN(messageIndexValue)) return;

    const result = await overlay.current?.updateMessage(messageIndexValue, {
      ...messages[messageIndexValue],
      content: messages[messageIndexValue].content + '\n\nHello overlay!',
    });
    handleDisplayInformation(JSON.stringify(result?.messages, null, 2));
  }, [messageIndex, handleDisplayInformation]);

  const handleSetInputContent = useCallback(async () => {
    await overlay.current?.setInputContent(inputContent);
  }, [inputContent]);

  const handleCreatePlaybackConversation = useCallback(async () => {
    const replayResult = await overlay.current?.createPlaybackConversation(
      conversationIdInputValue,
    );

    handleDisplayInformation(
      JSON.stringify(replayResult?.conversation, null, 2),
    );
  }, [conversationIdInputValue, handleDisplayInformation]);

  const handleExportConversation = useCallback(async () => {
    const convObject = await overlay.current?.exportConversation(
      conversationIdInputValue,
    );

    handleDisplayInformation(JSON.stringify(convObject, null, 2));
  }, [conversationIdInputValue, handleDisplayInformation]);

  const handleImportConversation = useCallback(async () => {
    let parsedImportedConversation;
    try {
      parsedImportedConversation = JSON.parse(importedConversation);
    } catch (e) {
      console.warn('Invalid imported conversation', e);
      return;
    }
    const convObject = await overlay.current?.importConversation(
      parsedImportedConversation,
    );

    handleDisplayInformation(JSON.stringify(convObject, null, 2));
  }, [handleDisplayInformation, importedConversation]);

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
    const subEndGenerating = overlay.current?.subscribe(
      '@DIAL_OVERLAY/GPT_END_GENERATING',
      () => console.info('END GENERATING'),
    );

    const subStartGenerating = overlay.current?.subscribe(
      '@DIAL_OVERLAY/GPT_START_GENERATING',
      () => console.info('START GENERATING'),
    );
    const subSelectedConversationLoaded = overlay.current?.subscribe(
      '@DIAL_OVERLAY/SELECTED_CONVERSATION_LOADED',
      async (info) => {
        console.info('Conversation selected - ');
        const { messages } = await overlay.current!.getMessages();
        console.info('messages', messages);

        console.info(JSON.stringify(info, null, 2));
      },
    );
    const subConversationUpdated = overlay.current?.subscribe(
      `@DIAL_OVERLAY/${OverlayEvents.conversationsUpdated}`,
      async () => {
        console.info('Conversations updated');
      },
    );
    const editMessageEvent = overlay.current?.subscribe(
      `@DIAL_OVERLAY/${OverlayEvents.editMessage}`,
      async (payload) => {
        console.info('Message edited', { payload });
      },
    );
    const regenerateLastMessageEvent = overlay.current?.subscribe(
      `@DIAL_OVERLAY/${OverlayEvents.regenerateMessage}`,
      async () => {
        console.info('Message regenerated');
      },
    );
    const deleteMessageEvent = overlay.current?.subscribe(
      `@DIAL_OVERLAY/${OverlayEvents.deleteMessage}`,
      async (payload) => {
        console.info('Message deleted', { payload });
      },
    );
    const subMessageCustomButton = overlay.current?.subscribe(
      `@DIAL_OVERLAY/${OverlayEvents.messageCustomButton}`,
      async (info) => {
        console.info(
          'Custom message button event',
          JSON.stringify(info, null, 2),
        );
      },
    );

    overlay.current?.getMessages().then((messages) => {
      console.info(messages);
    });

    const subs = [
      subEndGenerating,
      subStartGenerating,
      subSelectedConversationLoaded,
      subConversationUpdated,
      subMessageCustomButton,
      editMessageEvent,
      regenerateLastMessageEvent,
      deleteMessageEvent,
    ];
    return () => {
      subs.forEach((sub) => {
        sub?.();
      });
    };
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

              <div className="flex flex-col gap-1 border p-1">
                <button
                  className="button"
                  onClick={handleDeleteMessage}
                  data-qa="delete-message"
                >
                  Delete message by index
                </button>

                <button
                  className="button"
                  onClick={handleUpdateMessage}
                  data-qa="update-message"
                >
                  Add `Hello overlay!` to the end of message by index
                </button>

                <input
                  className="border"
                  placeholder="Message index"
                  value={messageIndex}
                  onChange={(e) => {
                    setMessageIndex(e.target.value);
                  }}
                  data-qa="delete-message-index"
                />
              </div>

              <div className="flex flex-col gap-1 border p-1">
                <button
                  className="button"
                  onClick={handleSetInputContent}
                  data-qa="set-input-content"
                >
                  Set input content
                </button>

                <input
                  className="border"
                  placeholder="Input content"
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  data-qa="set-input-content-input"
                />
              </div>

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
                  const conversations =
                    await overlay.current?.getSelectedConversations();

                  handleDisplayInformation(
                    JSON.stringify(conversations, null, 2),
                  );
                }}
                data-qa="get-selected-conversations"
              >
                Get selected conversations
              </button>

              <button
                className="button"
                onClick={async () => {
                  const conversation =
                    await overlay.current?.createLocalConversation();

                  handleDisplayInformation(
                    JSON.stringify(conversation, null, 2),
                  );
                }}
                data-qa="create-local-conversation"
              >
                Create local conversation
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

              <button
                className="button"
                onClick={async () => {
                  const conversation =
                    await overlay.current?.stopSelectedPlaybackConversation();

                  handleDisplayInformation(
                    JSON.stringify(conversation, null, 2),
                  );
                }}
                data-qa="stop-selected-playback-conversation"
              >
                Stop selected playback conversation
              </button>

              <div className="flex flex-col gap-1 border p-1">
                <button
                  className="button"
                  onClick={handleImportConversation}
                  data-qa="import-conversation"
                >
                  Import conversation
                </button>

                <input
                  className="border"
                  placeholder="Imported conversation object"
                  value={importedConversation}
                  onChange={(e) => setImportedConversation(e.target.value)}
                  data-qa="imported-conversation"
                />
              </div>
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
                    <option className="truncate" key={conv.id} value={conv.id}>
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

          <div className="flex flex-col gap-1">
            <button
              className="button w-full"
              onClick={() => {
                const newOptions = {
                  ...overlayOptions,
                  hostDomain: window.location.origin,
                };

                newOptions.theme = 'light';
                newOptions.modelId = 'imagegeneration@005';

                overlay.current?.setOverlayOptions(newOptions);
              }}
              data-qa="set-configuration"
            >
              Set light theme and new model
            </button>
            <button
              className="button w-full"
              onClick={() => {
                const newOptions = {
                  ...overlayOptions,
                  hostDomain: window.location.origin,
                };

                newOptions.enabledFeatures = [
                  ...(overlayOptions.enabledFeatures as Feature[]),
                  Feature.DisabledSend,
                ];

                overlay.current?.setOverlayOptions(newOptions);
              }}
              data-qa="set-configuration-disable-send"
            >
              Disable send
            </button>
            <button
              className="button w-full"
              onClick={() => {
                const newOptions = {
                  ...overlayOptions,
                  hostDomain: window.location.origin,
                };

                newOptions.enabledFeatures = [
                  ...(overlayOptions.enabledFeatures as Feature[]),
                  Feature.DisabledPlaybackControls,
                ];

                overlay.current?.setOverlayOptions(newOptions);
              }}
              data-qa="set-configuration-disable-playback-controls"
            >
              Disable playback controls
            </button>
          </div>
        </details>
      </div>
    </div>
  );
};
