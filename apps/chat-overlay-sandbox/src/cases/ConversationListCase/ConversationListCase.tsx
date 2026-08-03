import { ChatOverlay } from '@epam/ai-dial-chat-overlay';
import {
  DialDangerButton,
  DialInput,
  DialNeutralButton,
  DialSelectField,
} from '@epam/ai-dial-ui-kit';
import { FC, memo, useCallback, useEffect, useRef, useState } from 'react';
import EventLog from '../../components/EventLog/EventLog';
import MissingEnvNotice from '../../components/MissingEnvNotice/MissingEnvNotice';
import { getChatOverlayHost } from '../../env';

interface ConversationListControlsProps {
  isReady: boolean;
  conversations: ConversationSelectorOption[];
  onGetConversations: () => void;
  onGetSelectedConversations: () => void;
  onRefreshList: () => void;
  onCreateConversation: (deploymentId: string, firstMessage: string) => void;
  onCreateLocalConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (id: string, newName: string) => void;
  onDeleteConversation: (id: string) => void;
}

interface ConversationSelectorOption {
  id: string;
  title: string;
}

const getConversationSelectorLabel = ({
  id,
  title,
}: ConversationSelectorOption): string => title.trim() || id;

/** Control panel for exercising the conversation-list methods against one visible overlay. */
const ConversationListControls: FC<ConversationListControlsProps> = ({
  isReady,
  conversations,
  onGetConversations,
  onGetSelectedConversations,
  onRefreshList,
  onCreateConversation,
  onCreateLocalConversation,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
}) => {
  const [deploymentId, setDeploymentId] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [conversationId, setConversationId] = useState('');
  const [newName, setNewName] = useState('');

  return (
    <section className="mb-4 max-w-[960px]">
      <div className="grid grid-cols-1 gap-3 desktop:grid-cols-2">
        <fieldset className="m-0 min-w-0 rounded-lg border border-secondary px-3 py-3">
          <legend className="px-1 font-semibold">Read</legend>
          <div className="flex flex-wrap gap-2 [&>*]:min-h-11 [&>*]:min-w-[160px] [&>*]:flex-1">
            <DialNeutralButton
              type="button"
              label="Get conversations"
              onClick={onGetConversations}
              disabled={!isReady}
            />
            <DialNeutralButton
              type="button"
              label="Get selected conversations"
              onClick={onGetSelectedConversations}
              disabled={!isReady}
            />
            <DialNeutralButton
              type="button"
              label="Refresh list"
              onClick={onRefreshList}
              disabled={!isReady}
            />
            <DialNeutralButton
              type="button"
              label="Create local conversation"
              onClick={onCreateLocalConversation}
              disabled={!isReady}
            />
          </div>
        </fieldset>
        <fieldset className="m-0 min-w-0 rounded-lg border border-secondary px-3 py-3">
          <legend className="px-1 font-semibold">Create persisted</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-end gap-2.5">
            <DialInput
              id="deployment-id"
              className="min-h-11"
              labelProps={{ label: 'Deployment id (optional)' }}
              value={deploymentId}
              onChange={(value) => setDeploymentId(value ?? '')}
            />
            <DialInput
              id="first-message"
              className="min-h-11"
              labelProps={{ label: 'First message (optional)' }}
              value={firstMessage}
              onChange={(value) => setFirstMessage(value ?? '')}
            />
            <DialNeutralButton
              className="min-h-11 w-full"
              type="button"
              label="Create conversation"
              onClick={() => onCreateConversation(deploymentId, firstMessage)}
              disabled={!isReady}
            />
          </div>
        </fieldset>
        <fieldset className="m-0 min-w-0 rounded-lg border border-secondary px-3 py-3 desktop:col-span-2">
          <legend className="px-1 font-semibold">Mutate by id</legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] items-end gap-2.5">
            <DialSelectField
              id="conversation-id-select"
              label="Conversation id"
              selectClassName="min-h-11 w-full"
              placeholder="— select from last Get conversations —"
              value={conversationId}
              options={conversations.map((conversation) => ({
                value: conversation.id,
                label: getConversationSelectorLabel(conversation),
              }))}
              onChange={(value) => setConversationId(value as string)}
            />
            <DialInput
              id="conversation-id-override"
              className="min-h-11"
              labelProps={{ label: 'Conversation id override' }}
              placeholder="or type an id"
              value={conversationId}
              onChange={(value) => setConversationId(value ?? '')}
            />
            <DialInput
              id="new-conversation-name"
              className="min-h-11"
              labelProps={{ label: 'New conversation name' }}
              placeholder="new name"
              value={newName}
              onChange={(value) => setNewName(value ?? '')}
            />
            <div className="col-span-full flex flex-wrap gap-2 self-end [&>*]:min-h-11 [&>*]:min-w-24 [&>*]:flex-1">
              <DialNeutralButton
                type="button"
                label="Select conversation by id"
                onClick={() => onSelectConversation(conversationId)}
                disabled={!isReady || !conversationId}
              />
              <DialNeutralButton
                type="button"
                label="Rename conversation by id"
                onClick={() => onRenameConversation(conversationId, newName)}
                disabled={!isReady || !conversationId}
              />
              <DialDangerButton
                type="button"
                label="Delete conversation by id"
                onClick={() => onDeleteConversation(conversationId)}
                disabled={!isReady || !conversationId}
              />
            </div>
          </div>
        </fieldset>
      </div>
    </section>
  );
};

/**
 * Sandbox case demonstrating all seven conversation-list methods
 * (`getConversations`, `getSelectedConversations`, `selectConversation`,
 * `createConversation`, `createLocalConversation`, `deleteConversation`,
 * `renameConversation`) through a direct `ChatOverlay` instance.
 */
const ConversationListCase: FC = () => {
  const host = getChatOverlayHost();

  const directRootRef = useRef<HTMLDivElement | null>(null);
  const directOverlayRef = useRef<ChatOverlay | null>(null);
  const [isDirectReady, setIsDirectReady] = useState(false);
  const [directLog, setDirectLog] = useState<string[]>([]);
  const [directConversations, setDirectConversations] = useState<
    ConversationSelectorOption[]
  >([]);

  const appendDirectLog = useCallback((line: string) => {
    setDirectLog((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()} ${line}`,
    ]);
  }, []);

  useEffect(() => {
    if (!host || !directRootRef.current) return;
    let isActive = true;
    setIsDirectReady(false);

    const overlay = new ChatOverlay(directRootRef.current, { domain: host });
    directOverlayRef.current = overlay;

    overlay
      .ready()
      .then(() => {
        if (isActive) setIsDirectReady(true);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      overlay.destroy();
      directOverlayRef.current = null;
      setIsDirectReady(false);
    };
  }, [host]);

  const handleDirectGetConversations = useCallback(async () => {
    const response = await directOverlayRef.current?.getConversations();
    appendDirectLog(`getConversations -> ${JSON.stringify(response)}`);
    if (response) {
      setDirectConversations(
        response.conversations.map(({ id, title }) => ({ id, title })),
      );
    }
  }, [appendDirectLog]);

  const handleDirectGetSelectedConversations = useCallback(async () => {
    const response = await directOverlayRef.current?.getSelectedConversations();
    appendDirectLog(`getSelectedConversations -> ${JSON.stringify(response)}`);
  }, [appendDirectLog]);

  const handleDirectCreateConversation = useCallback(
    async (deploymentId: string, firstMessage: string) => {
      const response = await directOverlayRef.current?.createConversation({
        deploymentId: deploymentId || undefined,
        firstMessage: firstMessage || undefined,
      });
      appendDirectLog(`createConversation -> ${JSON.stringify(response)}`);
    },
    [appendDirectLog],
  );

  const handleDirectCreateLocalConversation = useCallback(async () => {
    const response = await directOverlayRef.current?.createLocalConversation();
    appendDirectLog(`createLocalConversation -> ${JSON.stringify(response)}`);
  }, [appendDirectLog]);

  const handleDirectSelectConversation = useCallback(
    async (id: string) => {
      const response = await directOverlayRef.current?.selectConversation(id);
      appendDirectLog(
        `selectConversation(${id}) -> ${JSON.stringify(response)}`,
      );
    },
    [appendDirectLog],
  );

  const handleDirectRenameConversation = useCallback(
    async (id: string, newName: string) => {
      const response = await directOverlayRef.current?.renameConversation(
        id,
        newName,
      );
      appendDirectLog(
        `renameConversation(${id}, ${newName}) -> ${JSON.stringify(response)}`,
      );
    },
    [appendDirectLog],
  );

  const handleDirectDeleteConversation = useCallback(
    async (id: string) => {
      const response = await directOverlayRef.current?.deleteConversation(id);
      appendDirectLog(
        `deleteConversation(${id}) -> ${JSON.stringify(response)}`,
      );
    },
    [appendDirectLog],
  );

  if (!host) {
    return <MissingEnvNotice />;
  }

  return (
    <div className="max-w-[960px] pb-6">
      <h1 className="text-3xl font-bold">Conversation-list methods case</h1>
      <ConversationListControls
        isReady={isDirectReady}
        conversations={directConversations}
        onGetConversations={() => void handleDirectGetConversations()}
        onGetSelectedConversations={() =>
          void handleDirectGetSelectedConversations()
        }
        onRefreshList={() => void handleDirectGetConversations()}
        onCreateConversation={(deploymentId, firstMessage) =>
          void handleDirectCreateConversation(deploymentId, firstMessage)
        }
        onCreateLocalConversation={() =>
          void handleDirectCreateLocalConversation()
        }
        onSelectConversation={(id) => void handleDirectSelectConversation(id)}
        onRenameConversation={(id, newName) =>
          void handleDirectRenameConversation(id, newName)
        }
        onDeleteConversation={(id) => void handleDirectDeleteConversation(id)}
      />
      <div
        ref={directRootRef}
        className="relative my-4 h-[min(600px,78dvh)] w-[min(100%,380px)] desktop:h-[600px]"
      />
      <EventLog entries={directLog} onClear={() => setDirectLog([])} />
    </div>
  );
};

export default memo(ConversationListCase);
