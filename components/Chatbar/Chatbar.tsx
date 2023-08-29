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

import { useAppSelector } from '@/store/hooks';
import { ModelsSelectors } from '@/store/models/models.reducers';

import HomeContext from '@/pages/api/home/home.context';

import { ChatFolders } from './components/ChatFolders';
import { ChatbarSettings } from './components/ChatbarSettings';
import { Conversations } from './components/Conversations';

import PlusIcon from '../../public/images/icons/plus-large.svg';
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
      folders,
      messageIsStreaming,
      selectedConversationIds,
    },
    dispatch: homeDispatch,
    handleNewConversation,
    handleUpdateConversation,
  } = useContext(HomeContext);

  const defaultModelId = useAppSelector(ModelsSelectors.selectDefaultModelId);

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
      lastActivityDate: Date.now(),
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
      if (selectedConversationIds.includes(conversation.id)) {
        homeDispatch({
          field: 'selectedConversationIds',
          value: [updatedConversations[updatedConversations.length - 1].id],
        });

        saveSelectedConversationIds([
          updatedConversations[updatedConversations.length - 1].id,
        ]);
      }
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
    }
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
    <button
      className={`flex shrink-0 cursor-pointer select-none items-center gap-3 p-5 transition-colors duration-200 hover:bg-green/15 disabled:cursor-not-allowed`}
      onClick={() => {
        handleNewConversation();
        chatDispatch({ field: 'searchTerm', value: '' });
      }}
      disabled={!!messageIsStreaming}
    >
      <PlusIcon className="text-gray-500" width={18} height={18} />
      {t('New conversation')}
    </button>
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
        featureType="chat"
        side={'left'}
        actionButtons={actionsBlock}
        isOpen={showChatbar}
        itemComponent={<Conversations conversations={filteredConversations} />}
        folderComponent={<ChatFolders searchTerm={searchTerm} />}
        folders={chatFolders}
        items={conversations}
        filteredItems={filteredConversations}
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
