import { useEffect, useRef, useState } from 'react';
import { useQuery } from 'react-query';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import useErrorService from '@/services/errorService';
import useApiService from '@/services/useApiService';

import {
  cleanConversationHistory,
  cleanSelectedConversation,
} from '@/utils/app/clean';
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_TEMPERATURE } from '@/utils/app/const';
import {
  saveConversations,
  saveSelectedConversationIds,
  updateConversation,
} from '@/utils/app/conversation';
import { saveFolders } from '@/utils/app/folders';
import { savePrompts } from '@/utils/app/prompts';
import { getSettings } from '@/utils/app/settings';

import { Conversation, Message, Replay } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { FolderInterface, FolderType } from '@/types/folder';
import { OpenAIModelID, OpenAIModels, fallbackModelID } from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import { Navbar } from '@/components/Mobile/Navbar';
import Promptbar from '@/components/Promptbar';

import { authOptions } from '../auth/[...nextauth]';
import HomeContext from './home.context';
import { HomeInitialState, initialState } from './home.state';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  serverSideApiKeyIsSet: boolean;
  serverSidePluginKeysSet: boolean;
  usePluginKeys: boolean;
  defaultModelId: OpenAIModelID;
  isShowFooter: boolean;
  isShowRequestApiKey: boolean;
  isShowReportAnIssue: boolean;
  appName: string;
  footerHtmlMessage: string;
  requestApiKeyHtmlMessage: string;
  reportAnIssueHtmlMessage: string;
}

const Home = ({
  serverSideApiKeyIsSet,
  serverSidePluginKeysSet,
  usePluginKeys,
  defaultModelId,
  appName,
  isShowFooter,
  isShowRequestApiKey,
  isShowReportAnIssue,
  footerHtmlMessage,
  requestApiKeyHtmlMessage,
  reportAnIssueHtmlMessage,
}: Props) => {
  const { t } = useTranslation('chat');
  const { getModels } = useApiService();
  const { getModelsError } = useErrorService();
  const [selectedConversationNames, setSelectedConversationNames] = useState<
    string[]
  >([]);

  const contextValue = useCreateReducer<HomeInitialState>({
    initialState,
  });

  const {
    state: {
      apiKey,
      lightMode,
      folders,
      conversations,
      selectedConversationIds,
      prompts,
      temperature,
    },
    dispatch,
  } = contextValue;

  const stopConversationRef = useRef<boolean>(false);

  const { data, error, refetch } = useQuery(
    ['GetModels', apiKey, serverSideApiKeyIsSet],
    ({ signal }) => {
      if (!apiKey && !serverSideApiKeyIsSet) return null;

      return getModels(
        {
          key: apiKey,
        },
        signal,
      );
    },
    { enabled: true, refetchOnMount: false },
  );

  useEffect(() => {
    if (data) dispatch({ field: 'models', value: data });
  }, [data, dispatch]);

  useEffect(() => {
    dispatch({ field: 'modelError', value: getModelsError(error) });
  }, [dispatch, error, getModelsError]);

  // FETCH MODELS ----------------------------------------------

  const handleSelectConversation = (
    conversation: Conversation,
    isMultiple?: boolean,
  ) => {
    const newSelectedIds = isMultiple
      ? Array.from(new Set([...selectedConversationIds, conversation.id]))
      : [conversation.id];
    dispatch({
      field: 'selectedConversationIds',
      value: newSelectedIds,
    });

    if (!isMultiple) {
      dispatch({
        field: 'isCompareMode',
        value: false,
      });
    }

    saveSelectedConversationIds(newSelectedIds);
  };

  // FOLDER OPERATIONS  --------------------------------------------

  const handleCreateFolder = (name: string, type: FolderType) => {
    const newFolder: FolderInterface = {
      id: uuidv4(),
      name,
      type,
    };

    const updatedFolders = [...folders, newFolder];

    dispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders);
  };

  const handleDeleteFolder = (folderId: string) => {
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    dispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders);

    const updatedConversations: Conversation[] = conversations.map((c) => {
      if (c.folderId === folderId) {
        return {
          ...c,
          folderId: null,
        };
      }

      return c;
    });

    dispatch({ field: 'conversations', value: updatedConversations });
    saveConversations(updatedConversations);

    const updatedPrompts: Prompt[] = prompts.map((p) => {
      if (p.folderId === folderId) {
        return {
          ...p,
          folderId: null,
        };
      }

      return p;
    });

    dispatch({ field: 'prompts', value: updatedPrompts });
    savePrompts(updatedPrompts);
  };

  const handleUpdateFolder = (folderId: string, name: string) => {
    const updatedFolders = folders.map((f) => {
      if (f.id === folderId) {
        return {
          ...f,
          name,
        };
      }

      return f;
    });

    dispatch({ field: 'folders', value: updatedFolders });

    saveFolders(updatedFolders);
  };

  // CONVERSATION OPERATIONS  --------------------------------------------

  const handleNewConversation = (
    name = 'New Conversation',
    replayUserMessagesStack?: Message[],
  ) => {
    const lastConversation = conversations[conversations.length - 1];

    const newReplay: Replay = {
      isReplay: !!replayUserMessagesStack,
      replayUserMessagesStack: replayUserMessagesStack ?? [],
      activeReplayIndex: 0,
    };

    const newConversation: Conversation = {
      id: uuidv4(),
      name: t(name),
      messages: [],
      model: lastConversation?.model || {
        id: OpenAIModels[defaultModelId].id,
        name: OpenAIModels[defaultModelId].name,
        maxLength: OpenAIModels[defaultModelId].maxLength,
        tokenLimit: OpenAIModels[defaultModelId].tokenLimit,
      },
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
      folderId: null,
      replay: newReplay,
    };

    const updatedConversations = [...conversations, newConversation];

    dispatch({
      field: 'selectedConversationIds',
      value: [newConversation.id],
    });
    dispatch({
      field: 'isCompareMode',
      value: false,
    });
    dispatch({ field: 'conversations', value: updatedConversations });

    saveSelectedConversationIds([newConversation.id]);
    saveConversations(updatedConversations);

    dispatch({ field: 'loading', value: false });
  };

  const handleUpdateConversation = (
    conversation: Conversation,
    data: KeyValuePair,
    localConversations?: Conversation[],
  ): Conversation[] => {
    const updatedConversation = {
      ...conversation,
      [data.key]: data.value,
    };

    const allConversation = updateConversation(
      updatedConversation,
      localConversations || conversations,
    );

    dispatch({ field: 'conversations', value: allConversation });

    return allConversation;
  };

  // EFFECTS  --------------------------------------------

  useEffect(() => {
    if (window.innerWidth < 640) {
      dispatch({ field: 'showChatbar', value: false });
    }
  }, [selectedConversationIds]);

  useEffect(() => {
    defaultModelId &&
      dispatch({ field: 'defaultModelId', value: defaultModelId });
    serverSideApiKeyIsSet &&
      dispatch({
        field: 'serverSideApiKeyIsSet',
        value: serverSideApiKeyIsSet,
      });
    serverSidePluginKeysSet &&
      dispatch({
        field: 'serverSidePluginKeysSet',
        value: serverSidePluginKeysSet,
      });

    usePluginKeys &&
      dispatch({
        field: 'usePluginKeys',
        value: usePluginKeys,
      });
    isShowFooter &&
      dispatch({
        field: 'isShowFooter',
        value: isShowFooter,
      });
    isShowReportAnIssue &&
      dispatch({
        field: 'isShowReportAnIssue',
        value: isShowReportAnIssue,
      });
    isShowRequestApiKey &&
      dispatch({
        field: 'isShowRequestApiKey',
        value: isShowRequestApiKey,
      });

    footerHtmlMessage &&
      dispatch({
        field: 'footerHtmlMessage',
        value: footerHtmlMessage,
      });
    requestApiKeyHtmlMessage &&
      dispatch({
        field: 'requestApiKeyHtmlMessage',
        value: requestApiKeyHtmlMessage,
      });
    reportAnIssueHtmlMessage &&
      dispatch({
        field: 'reportAnIssueHtmlMessage',
        value: reportAnIssueHtmlMessage,
      });
  }, [
    defaultModelId,
    serverSideApiKeyIsSet,
    serverSidePluginKeysSet,
    usePluginKeys,
    isShowFooter,
    isShowReportAnIssue,
    isShowRequestApiKey,
    footerHtmlMessage,
    requestApiKeyHtmlMessage,
    reportAnIssueHtmlMessage,
  ]);

  // ON LOAD --------------------------------------------

  useEffect(() => {
    const settings = getSettings();
    if (settings.theme) {
      dispatch({
        field: 'lightMode',
        value: settings.theme,
      });
    }

    const apiKey = localStorage.getItem('apiKey');

    if (serverSideApiKeyIsSet) {
      dispatch({ field: 'apiKey', value: '' });

      localStorage.removeItem('apiKey');
    } else if (apiKey) {
      dispatch({ field: 'apiKey', value: apiKey });
    }

    if (window.innerWidth < 640) {
      dispatch({ field: 'showChatbar', value: false });
      dispatch({ field: 'showPromptbar', value: false });
    }

    const showChatbar = localStorage.getItem('showChatbar');
    if (showChatbar) {
      dispatch({ field: 'showChatbar', value: showChatbar === 'true' });
    }

    const showPromptbar = localStorage.getItem('showPromptbar');
    if (showPromptbar) {
      dispatch({ field: 'showPromptbar', value: showPromptbar === 'true' });
    }

    const folders = localStorage.getItem('folders');
    if (folders) {
      dispatch({ field: 'folders', value: JSON.parse(folders) });
    }

    const prompts = localStorage.getItem('prompts');
    if (prompts) {
      dispatch({ field: 'prompts', value: JSON.parse(prompts) });
    }

    const conversationHistory = localStorage.getItem('conversationHistory');
    let cleanedConversationHistory: Conversation[] = [];
    if (conversationHistory) {
      const parsedConversationHistory: Conversation[] =
        JSON.parse(conversationHistory);
      cleanedConversationHistory = cleanConversationHistory(
        parsedConversationHistory,
      );

      dispatch({ field: 'conversations', value: cleanedConversationHistory });
    }

    const selectedConversationIds = localStorage.getItem(
      'selectedConversationIds',
    );
    const parsedSelectedConversationsIds: string[] = JSON.parse(
      selectedConversationIds || '[]',
    );
    const filteredSelectedConversationIds =
      parsedSelectedConversationsIds.filter((convId) =>
        cleanedConversationHistory.some((conv) => conv.id === convId),
      );
    if (
      filteredSelectedConversationIds?.length > 0 &&
      cleanedConversationHistory.length > 0
    ) {
      dispatch({
        field: 'selectedConversationIds',
        value: filteredSelectedConversationIds,
      });

      if (filteredSelectedConversationIds.length > 1) {
        dispatch({
          field: 'isCompareMode',
          value: true,
        });
      }
    } else {
      const lastConversation =
        cleanedConversationHistory[conversations.length - 1];
      const newConversation = {
        id: uuidv4(),
        name: t('New Conversation'),
        messages: [],
        model: OpenAIModels[defaultModelId],
        prompt: DEFAULT_SYSTEM_PROMPT,
        temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
        folderId: null,
      };
      dispatch({
        field: 'selectedConversationIds',
        value: [newConversation.id],
      });
      dispatch({
        field: 'conversations',
        value: [...cleanedConversationHistory, newConversation],
      });
    }
  }, [
    defaultModelId,
    dispatch,
    serverSideApiKeyIsSet,
    serverSidePluginKeysSet,
    usePluginKeys,
  ]);

  useEffect(() => {
    if (selectedConversationIds.length > 0) {
      setSelectedConversationNames(
        conversations
          .filter((conv) => selectedConversationIds.includes(conv.id))
          .map((conv) => conv.name),
      );
    }
  }, [selectedConversationIds, conversations]);

  return (
    <HomeContext.Provider
      value={{
        ...contextValue,
        handleNewConversation,
        handleCreateFolder,
        handleDeleteFolder,
        handleUpdateFolder,
        handleSelectConversation,
        handleUpdateConversation,
      }}
    >
      <Head>
        <title>{appName}</title>
        <meta name="description" content="ChatGPT but better." />
        <meta
          name="viewport"
          content="height=device-height ,width=device-width, initial-scale=1, user-scalable=no"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {selectedConversationNames.length > 0 && (
        <main
          className={`flex h-screen w-screen flex-col text-sm text-white dark:text-white ${lightMode}`}
        >
          <div className="fixed top-0 w-full sm:hidden">
            <Navbar
              selectedConversationNames={selectedConversationNames}
              onNewConversation={handleNewConversation}
            />
          </div>

          <div className="flex h-full w-full pt-[48px] sm:pt-0">
            <Chatbar />

            <div className="flex flex-1">
              <Chat
                stopConversationRef={stopConversationRef}
                appName={appName}
              />
            </div>

            <Promptbar />
          </div>
        </main>
      )}
    </HomeContext.Provider>
  );
};
export default Home;

export const getServerSideProps: GetServerSideProps = async ({
  locale,
  req,
  res,
}) => {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return {
      redirect: {
        permanent: false,
        destination: '/api/auth/signin',
      },
    };
  }

  const defaultModelId =
    (process.env.DEFAULT_MODEL &&
      Object.values(OpenAIModelID).includes(
        process.env.DEFAULT_MODEL as OpenAIModelID,
      ) &&
      process.env.DEFAULT_MODEL) ||
    fallbackModelID;

  let serverSidePluginKeysSet = false;

  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleCSEId = process.env.GOOGLE_CSE_ID;

  if (googleApiKey && googleCSEId) {
    serverSidePluginKeysSet = true;
  }

  return {
    props: {
      serverSideApiKeyIsSet: !!process.env.OPENAI_API_KEY,
      usePluginKeys: !!process.env.NEXT_PUBLIC_ENABLE_PLUGIN_KEYS,
      defaultModelId,
      serverSidePluginKeysSet,
      appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Chatbot UI',

      // Footer variables
      isShowFooter: process.env.SHOW_FOOTER === 'true',
      isShowRequestApiKey: process.env.SHOW_REQUEST_API_KEY === 'true',
      isShowReportAnIssue: process.env.SHOW_REPORT_AN_ISSUE === 'true',
      footerHtmlMessage: process.env.FOOTER_HTML_MESSAGE ?? '',
      requestApiKeyHtmlMessage: process.env.REQUEST_API_KEY_HTML_MESSAGE ?? '',
      reportAnIssueHtmlMessage: process.env.REPORT_AN_ISSUE_HTML_MESSAGE ?? '',
      ...(await serverSideTranslations(locale ?? 'en', [
        'common',
        'chat',
        'sidebar',
        'markdown',
        'promptbar',
        'settings',
      ])),
    },
  };
};
