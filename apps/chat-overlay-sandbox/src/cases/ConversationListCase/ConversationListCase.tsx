import { ChatOverlay } from '@epam/ai-dial-chat-overlay';
import {
  ChangeEvent,
  FC,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import EventLog from '../../components/EventLog/EventLog';
import MissingEnvNotice from '../../components/MissingEnvNotice/MissingEnvNotice';
import { getChatOverlayHost } from '../../env';

interface ConversationListControlsProps {
  title: string;
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
  title,
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

  const handleConversationIdSelect = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    setConversationId(event.target.value);
  };

  return (
    <section className="conversation-list-controls">
      <h2>{title}</h2>
      <div className="conversation-list-controls__groups">
        <fieldset className="conversation-list-controls__group">
          <legend>Read</legend>
          <div className="conversation-list-controls__actions">
            <button
              type="button"
              onClick={onGetConversations}
              disabled={!isReady}
            >
              Get conversations
            </button>
            <button
              type="button"
              onClick={onGetSelectedConversations}
              disabled={!isReady}
            >
              Get selected conversations
            </button>
            <button type="button" onClick={onRefreshList} disabled={!isReady}>
              Refresh list
            </button>
            <button
              type="button"
              onClick={onCreateLocalConversation}
              disabled={!isReady}
            >
              Create local conversation
            </button>
          </div>
        </fieldset>
        <fieldset className="conversation-list-controls__group">
          <legend>Create persisted</legend>
          <div className="conversation-list-controls__fields">
            <label>
              Deployment id (optional){' '}
              <input
                value={deploymentId}
                onChange={(event) => setDeploymentId(event.target.value)}
              />
            </label>
            <label>
              First message (optional){' '}
              <input
                value={firstMessage}
                onChange={(event) => setFirstMessage(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => onCreateConversation(deploymentId, firstMessage)}
              disabled={!isReady}
            >
              Create conversation
            </button>
          </div>
        </fieldset>
        <fieldset className="conversation-list-controls__group conversation-list-controls__group--wide">
          <legend>Mutate by id</legend>
          <div className="conversation-list-controls__fields conversation-list-controls__fields--mutate">
            <label>
              Conversation id{' '}
              <select
                value={conversationId}
                onChange={handleConversationIdSelect}
              >
                <option value="">— select from last Get conversations —</option>
                {conversations.map((conversation) => (
                  <option
                    key={conversation.id}
                    value={conversation.id}
                    title={conversation.id}
                  >
                    {getConversationSelectorLabel(conversation)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Conversation id override
              <input
                placeholder="or type an id"
                value={conversationId}
                onChange={(event) => setConversationId(event.target.value)}
              />
            </label>
            <label>
              New conversation name
              <input
                placeholder="new name"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
            </label>
            <div className="conversation-list-controls__actions conversation-list-controls__actions--mutate">
              <button
                type="button"
                onClick={() => onSelectConversation(conversationId)}
                disabled={!isReady || !conversationId}
              >
                Select conversation by id
              </button>
              <button
                type="button"
                onClick={() => onRenameConversation(conversationId, newName)}
                disabled={!isReady || !conversationId}
              >
                Rename conversation by id
              </button>
              <button
                type="button"
                onClick={() => onDeleteConversation(conversationId)}
                disabled={!isReady || !conversationId}
              >
                Delete conversation by id
              </button>
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
    <div className="conversation-list-case">
      <h1>Conversation-list methods case</h1>
      <ConversationListControls
        title="ChatOverlay"
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
      <div ref={directRootRef} className="conversation-list-case__overlay" />
      <EventLog entries={directLog} onClear={() => setDirectLog([])} />
    </div>
  );
};

export default memo(ConversationListCase);
