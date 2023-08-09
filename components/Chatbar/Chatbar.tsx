import { IconFolderPlus, IconPlus, IconScale } from '@tabler/icons-react';
import { useContext, useEffect } from 'react';
import { toast } from 'react-hot-toast';

import { useTranslation } from 'next-i18next';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/utils/app/const';
import {
  saveConversations,
  saveSelectedConversationIds,
} from '@/utils/app/conversation';
import { saveFolders } from '@/utils/app/folders';
import {
  CleanDataResponse,
  exportConversation,
  exportConversations,
  importData,
} from '@/utils/app/importExport';

import { Conversation, Replay } from '@/types/chat';
import { SupportedExportFormats } from '@/types/export';
import { OpenAIEntityModelID, OpenAIEntityModels } from '@/types/openai';

import HomeContext from '@/pages/api/home/home.context';

import { ChatFolders } from './components/ChatFolders';
import { ChatbarSettings } from './components/ChatbarSettings';
import { Conversations } from './components/Conversations';

import Sidebar from '../Sidebar';
import ChatbarContext from './Chatbar.context';
import { ChatbarInitialState, initialState } from './Chatbar.state';

import { errorsMessages } from '@/constants/errors';
import { v4 as uuidv4 } from 'uuid';

export const Chatbar = () => {
  const { t } = useTranslation('sidebar');

  const chatBarContextValue = useCreateReducer<ChatbarInitialState>({
    initialState,
  });

  const {
    state: {
      conversations,
      showChatbar,
      defaultModelId,
      folders,
      messageIsStreaming,
    },
    dispatch: homeDispatch,
    handleCreateFolder,
    handleNewConversation,
    handleNewConversations,
    handleSelectConversations,
    handleUpdateConversation,
  } = useContext(HomeContext);

  const {
    state: { searchTerm, filteredConversations },
    dispatch: chatDispatch,
  } = chatBarContextValue;

  const defaultReplay: Replay = {
    isReplay: false,
    replayUserMessagesStack: [],
    activeReplayIndex: 0,
  };

  const chatFolders = folders.filter(({ type }) => type === 'chat');

  const handleExportConversations = () => {
    exportConversations();
  };

  const handleExportConversation = (conversationId: string) => {
    exportConversation(conversationId);
  };

  const handleImportConversations = (data: SupportedExportFormats) => {
    const { history, folders, prompts, isError }: CleanDataResponse =
      importData(data);
    if (isError) {
      toast.error(t(errorsMessages.unsupportedDataFormat));
    } else {
      homeDispatch({ field: 'conversations', value: history });
      homeDispatch({
        field: 'selectedConversationIds',
        value: [history[history.length - 1].id],
      });
      homeDispatch({
        field: 'isCompareMode',
        value: false,
      });
      homeDispatch({ field: 'folders', value: folders });
      homeDispatch({ field: 'prompts', value: prompts });
    }
  };

  const handleClearConversations = () => {
    const newConversation: Conversation = {
      id: uuidv4(),
      name: t(DEFAULT_CONVERSATION_NAME),
      messages: [],
      model: OpenAIEntityModels[defaultModelId || OpenAIEntityModelID.GPT_3_5],
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: DEFAULT_TEMPERATURE,
      folderId: null,
      replay: defaultReplay,
      selectedAddons:
        OpenAIEntityModels[defaultModelId || OpenAIEntityModelID.GPT_3_5]
          .selectedAddons ?? [],
    };

    const newConversations: Conversation[] = [newConversation];
    const newSelectedConversationIds: string[] = [newConversation.id];

    homeDispatch({
      field: 'selectedConversationIds',
      value: newSelectedConversationIds,
    });
    homeDispatch({
      field: 'isCompareMode',
      value: false,
    });
    defaultModelId &&
      homeDispatch({
        field: 'conversations',
        value: newConversations,
      });

    localStorage.removeItem('conversationHistory');

    const updatedFolders = folders.filter((f) => f.type !== 'chat');

    homeDispatch({ field: 'folders', value: updatedFolders });
    saveConversations(newConversations);
    saveFolders(updatedFolders);
    saveSelectedConversationIds(newSelectedConversationIds);
  };

  const handleDeleteConversation = (conversation: Conversation) => {
    const updatedConversations = conversations.filter(
      (c) => c.id !== conversation.id,
    );

    homeDispatch({ field: 'conversations', value: updatedConversations });
    chatDispatch({ field: 'searchTerm', value: '' });
    saveConversations(updatedConversations);

    if (updatedConversations.length > 0) {
      homeDispatch({
        field: 'selectedConversationIds',
        value: [updatedConversations[updatedConversations.length - 1].id],
      });

      saveSelectedConversationIds([
        updatedConversations[updatedConversations.length - 1].id,
      ]);
    } else {
      const newConversation: Conversation = {
        id: uuidv4(),
        name: t(DEFAULT_CONVERSATION_NAME),
        messages: [],
        model:
          OpenAIEntityModels[defaultModelId || OpenAIEntityModelID.GPT_3_5],
        prompt: DEFAULT_SYSTEM_PROMPT,
        temperature: DEFAULT_TEMPERATURE,
        folderId: null,
        replay: defaultReplay,
        selectedAddons:
          OpenAIEntityModels[defaultModelId || OpenAIEntityModelID.GPT_3_5]
            .selectedAddons ?? [],
      };

      defaultModelId &&
        homeDispatch({
          field: 'conversations',
          value: [newConversation],
        });
      homeDispatch({
        field: 'selectedConversationIds',
        value: [newConversation.id],
      });
      localStorage.removeItem('selectedConversationIds');
      saveConversations([newConversation]);
      saveSelectedConversationIds([newConversation.id]);
    }
    homeDispatch({
      field: 'isCompareMode',
      value: false,
    });
  };

  const handleDrop = (e: any) => {
    if (e.dataTransfer) {
      const conversation = JSON.parse(e.dataTransfer.getData('conversation'));
      const conversationWithDate: Conversation = {
        ...conversation,
        lastActivityDate: conversation.lastActivityDate,
      };
      handleUpdateConversation(conversationWithDate, {
        key: 'folderId',
        value: 0,
      });
      chatDispatch({ field: 'searchTerm', value: '' });
      e.target.style.background = 'none';
    }
  };
  const handleToggleCompare = () => {
    const newConversations = handleNewConversations(
      DEFAULT_CONVERSATION_NAME,
      2,
    );
    if (!newConversations) {
      return;
    }

    handleSelectConversations(newConversations);
    homeDispatch({
      field: 'isCompareMode',
      value: true,
    });
  };

  useEffect(() => {
    if (searchTerm) {
      chatDispatch({
        field: 'filteredConversations',
        value: conversations.filter((conversation) => {
          const searchable =
            conversation.name.toLocaleLowerCase() +
            ' ' +
            conversation.messages.map((message) => message.content).join(' ');
          return searchable.toLowerCase().includes(searchTerm.toLowerCase());
        }),
      });
    } else {
      chatDispatch({
        field: 'filteredConversations',
        value: conversations,
      });
    }
  }, [searchTerm, conversations]);

  const actionsBlock = (
    <div className="flex items-center gap-2">
      <button
        className={`flex shrink-0 grow cursor-pointer select-none items-center gap-3 rounded-md border border-white/20 p-3 transition-colors duration-200 hover:bg-gray-500/10 disabled:cursor-not-allowed`}
        onClick={() => {
          handleNewConversation();
          chatDispatch({ field: 'searchTerm', value: '' });
        }}
        disabled={!!messageIsStreaming}
      >
        <IconPlus size={16} />
        {t('New chat')}
      </button>

      <button
        className="flex h-full shrink-0 cursor-pointer items-center gap-3 rounded-md border border-white/20 p-3 text-sm transition-colors duration-200 hover:bg-gray-500/10 disabled:cursor-not-allowed"
        onClick={handleToggleCompare}
        disabled={!!messageIsStreaming}
      >
        <IconScale size={16} />
      </button>
      <button
        className="flex h-full shrink-0 cursor-pointer items-center gap-3 rounded-md border border-white/20 p-3 text-sm transition-colors duration-200 hover:bg-gray-500/10"
        onClick={() => handleCreateFolder(t('New folder'), 'chat')}
      >
        <IconFolderPlus size={16} />
      </button>
    </div>
  );

  return (
    <ChatbarContext.Provider
      value={{
        ...chatBarContextValue,
        handleDeleteConversation,
        handleClearConversations,
        handleImportConversations,
        handleExportConversations,
        handleExportConversation,
      }}
    >
      <Sidebar<Conversation>
        side={'left'}
        actionButtons={actionsBlock}
        isOpen={showChatbar}
        itemComponent={<Conversations conversations={filteredConversations} />}
        folderComponent={<ChatFolders searchTerm={searchTerm} />}
        folders={chatFolders}
        items={filteredConversations}
        searchTerm={searchTerm}
        handleSearchTerm={(searchTerm: string) =>
          chatDispatch({ field: 'searchTerm', value: searchTerm })
        }
        handleDrop={handleDrop}
        footerComponent={<ChatbarSettings />}
      />
    </ChatbarContext.Provider>
  );
};
