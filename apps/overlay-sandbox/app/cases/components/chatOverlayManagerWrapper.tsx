'use client';

import { BackToButton } from './backToSelectOverlayMode';

import {
  ChatOverlayManager,
  ChatOverlayManagerOptions,
  Feature,
  OverlayConversation,
  OverlayEvents,
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
  const [importedConversation, setImportedConversation] = useState('');
  const [conversations, setConversations] = useState<OverlayConversation[]>([]);
  const [conversationNewName, setConversationNewName] = useState('');

  const [messageIndex, setMessageIndex] = useState(0);
  const [inputContent, setInputContent] = useState('');

  const handleDisplayInformation = useCallback((textToShow: string) => {
    dialogRef.current?.showModal();

    setDialogInfo(textToShow);
  }, []);

  const handleRefreshConversations = useCallback(async () => {
    const convs = await overlayManager.current?.getConversations(
      overlayManagerOptions.id,
    );
    setConversations(convs?.conversations ?? []);
  }, [overlayManagerOptions.id]);

  const handleDeleteConversation = useCallback(async () => {
    await overlayManager.current?.deleteConversation(
      overlayManagerOptions.id,
      conversationIdInputValue,
    );
  }, [conversationIdInputValue, overlayManagerOptions.id]);

  const handleDeleteMessage = useCallback(async () => {
    const result = await overlayManager.current?.deleteMessage(
      overlayManagerOptions.id,
      messageIndex,
    );
    handleDisplayInformation(JSON.stringify(result?.messages, null, 2));
  }, [messageIndex, handleDisplayInformation, overlayManagerOptions.id]);

  const handleUpdateMessage = useCallback(async () => {
    const messages = (
      await overlayManager.current?.getMessages(overlayManagerOptions.id)
    )?.messages;

    if (!messages) {
      return;
    }

    const result = await overlayManager.current?.updateMessage(
      overlayManagerOptions.id,
      messageIndex,
      {
        ...messages[messageIndex],
        content: messages[messageIndex].content + '\n\nHello overlay!',
      },
    );
    handleDisplayInformation(JSON.stringify(result?.messages, null, 2));
  }, [overlayManagerOptions.id, messageIndex, handleDisplayInformation]);

  const handleSetInputContent = useCallback(async () => {
    await overlayManager.current?.setInputContent(
      overlayManagerOptions.id,
      inputContent,
    );
  }, [inputContent, overlayManagerOptions.id]);

  const handleCreatePlaybackConversation = useCallback(async () => {
    const replayResult =
      await overlayManager.current?.createPlaybackConversation(
        overlayManagerOptions.id,
        conversationIdInputValue,
      );

    handleDisplayInformation(
      JSON.stringify(replayResult?.conversation, null, 2),
    );
  }, [
    conversationIdInputValue,
    handleDisplayInformation,
    overlayManagerOptions.id,
  ]);

  const handleExportConversation = useCallback(async () => {
    const convObject = await overlayManager.current?.exportConversation(
      overlayManagerOptions.id,
      conversationIdInputValue,
    );

    handleDisplayInformation(JSON.stringify(convObject, null, 2));
  }, [
    conversationIdInputValue,
    handleDisplayInformation,
    overlayManagerOptions.id,
  ]);

  const handleImportConversation = useCallback(async () => {
    let parsedImportedConversation;
    try {
      parsedImportedConversation = JSON.parse(importedConversation);
    } catch (e) {
      console.warn('Invalid imported conversation', e);
      return;
    }
    const convObject = await overlayManager.current?.importConversation(
      overlayManagerOptions.id,
      parsedImportedConversation,
    );

    handleDisplayInformation(JSON.stringify(convObject, null, 2));
  }, [
    handleDisplayInformation,
    importedConversation,
    overlayManagerOptions.id,
  ]);

  const handleRenameConversation = useCallback(async () => {
    const replayResult = await overlayManager.current?.renameConversation(
      overlayManagerOptions.id,
      conversationIdInputValue,
      conversationNewName,
    );

    handleDisplayInformation(
      JSON.stringify(replayResult?.conversation, null, 2),
    );
  }, [
    conversationIdInputValue,
    conversationNewName,
    handleDisplayInformation,
    overlayManagerOptions.id,
  ]);

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
    const subEndGenerating = overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      '@DIAL_OVERLAY/GPT_END_GENERATING',
      () => console.info('END GENERATING'),
    );

    const subStartGenerating = overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      '@DIAL_OVERLAY/GPT_START_GENERATING',
      () => console.info('START GENERATING'),
    );

    const subSelectedConversationLoaded = overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      '@DIAL_OVERLAY/SELECTED_CONVERSATION_LOADED',
      async (info) => {
        console.info('Conversation selected - ');
        const { messages } = await overlayManager.current!.getMessages(
          overlayManagerOptions.id,
        );
        console.info('messages', messages);

        console.info(JSON.stringify(info, null, 2));
      },
    );
    const subConversationUpdated = overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      `@DIAL_OVERLAY/${OverlayEvents.conversationsUpdated}`,
      async () => {
        console.info('Conversations updated');
      },
    );
    const editMessageEvent = overlayManager.current?.subscribe(
      overlayManagerOptions.id,

      `@DIAL_OVERLAY/${OverlayEvents.editMessage}`,
      async (payload) => {
        console.info('Message edited', { payload });
      },
    );
    const regenerateLastMessageEvent = overlayManager.current?.subscribe(
      overlayManagerOptions.id,

      `@DIAL_OVERLAY/${OverlayEvents.regenerateMessage}`,
      async () => {
        console.info('Message regenerated');
      },
    );
    const deleteMessageEvent = overlayManager.current?.subscribe(
      overlayManagerOptions.id,

      `@DIAL_OVERLAY/${OverlayEvents.deleteMessage}`,
      async (payload) => {
        console.info('Message deleted', { payload });
      },
    );
    const subMessageCustomButton = overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      `@DIAL_OVERLAY/${OverlayEvents.messageCustomButton}`,
      async (info) => {
        console.info(
          'Custom message button event',
          JSON.stringify(info, null, 2),
        );
      },
    );
    const subPrevPlaybackMessage = overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      `@DIAL_OVERLAY/${OverlayEvents.prevPlaybackMessage}`,
      async (info) => {
        console.info(
          'Previous playback message',
          JSON.stringify(info, null, 2),
        );
      },
    );
    const subNextPlaybackMessage = overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      `@DIAL_OVERLAY/${OverlayEvents.nextPlaybackMessage}`,
      async (info) => {
        console.info('Next playback message', JSON.stringify(info, null, 2));
      },
    );
    const subStopGenerating = overlayManager.current?.subscribe(
      overlayManagerOptions.id,
      `@DIAL_OVERLAY/${OverlayEvents.stopGenerating}`,
      async () => {
        console.info('Stop generating by user');
      },
    );

    overlayManager.current
      ?.getMessages(overlayManagerOptions.id)
      .then((messages) => {
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
      subPrevPlaybackMessage,
      subNextPlaybackMessage,
      subStopGenerating,
    ];
    return () => {
      subs.forEach((sub) => {
        sub?.();
      });
    };
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

      <div className="flex max-w-[600px] flex-col gap-2">
        <BackToButton />
        <details open={true}>
          <summary>Chat actions</summary>

          <div className="grid grid-cols-2 gap-2">
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
                  placeholder="Imported conversation object"
                  value={messageIndex}
                  onChange={(e) => setMessageIndex(JSON.parse(e.target.value))}
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
                data-qa="get-messages"
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
                data-qa="get-conversations"
              >
                Get conversations
              </button>

              <button
                className="button"
                onClick={async () => {
                  const conversations =
                    await overlayManager.current?.getSelectedConversations(
                      overlayManagerOptions.id,
                    );

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
                    await overlayManager.current?.createLocalConversation(
                      overlayManagerOptions.id,
                    );

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
                    await overlayManager.current?.createConversation(
                      overlayManagerOptions.id,
                    );

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
                    await overlayManager.current?.createConversation(
                      overlayManagerOptions.id,
                      'test-inner-folder-root/test-inner-folder-child',
                    );

                  handleDisplayInformation(
                    JSON.stringify(conversation, null, 2),
                  );
                }}
              >
                Create conversation in inner folder
              </button>

              <button
                className="button"
                onClick={async () => {
                  const conversation =
                    await overlayManager.current?.stopSelectedPlaybackConversation(
                      overlayManagerOptions.id,
                    );

                  handleDisplayInformation(
                    JSON.stringify(conversation, null, 2),
                  );
                }}
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
        <details>
          <summary>Overlay configuration</summary>

          <div className="flex flex-col gap-1">
            <button
              className="button w-full"
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
            <button
              className="button w-full"
              onClick={() => {
                const newOptions = {
                  ...overlayManagerOptions,
                  hostDomain: window.location.origin,
                };

                newOptions.enabledFeatures = [
                  ...(overlayManagerOptions.enabledFeatures as Feature[]),
                  Feature.DisabledSend,
                ];

                overlayManager.current?.setOverlayOptions(
                  overlayManagerOptions.id,
                  newOptions,
                );
              }}
              data-qa="set-configuration-disable-send"
            >
              Disable send
            </button>
            <button
              className="button w-full"
              onClick={() => {
                const newOptions = {
                  ...overlayManagerOptions,
                  hostDomain: window.location.origin,
                };

                newOptions.enabledFeatures = [
                  ...(overlayManagerOptions.enabledFeatures as Feature[]),
                  Feature.DisabledPlaybackControls,
                ];

                overlayManager.current?.setOverlayOptions(
                  overlayManagerOptions.id,
                  newOptions,
                );
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
