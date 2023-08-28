import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import { AuthWindowLocationLike } from '@/utils/app/auth/authWindowLocationLike';
import { delay } from '@/utils/app/auth/delay';
import { timeoutAsync } from '@/utils/app/auth/timeoutAsync';
import { cleanConversationHistory } from '@/utils/app/clean';
import {
  DEFAULT_CONVERSATION_NAME,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TEMPERATURE,
} from '@/utils/app/const';
import {
  saveConversations,
  saveSelectedConversationIds,
  updateConversation,
} from '@/utils/app/conversation';
import { saveFolders } from '@/utils/app/folders';
import { savePrompts } from '@/utils/app/prompts';
import { getSettings } from '@/utils/app/settings';

import { Conversation, Replay } from '@/types/chat';
import { KeyValuePair } from '@/types/data';
import { Feature } from '@/types/features';
import { FolderInterface, FolderType } from '@/types/folder';
import {
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
  defaultModelLimits,
  fallbackModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { getAddons, initRecentAddons } from '@/store/addons/addons.reducers';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  getModels,
  initRecentModels,
  selectDefaultModelId,
  selectModels,
  selectModelsMap,
  setDefaultModelId,
  updateRecentModels,
} from '@/store/models/models.reducers';

import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import Header from '@/components/Header/Header';
import { UserMobile } from '@/components/Header/User/UserMobile';
import Promptbar from '@/components/Promptbar';

import packageJSON from '../../../package.json';
import { authOptions } from '../auth/[...nextauth]';
import HomeContext from './home.context';
import { HomeInitialState, initialState } from './home.state';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  appName: string;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
  isIframe: boolean;
  authDisabled: boolean;
  defaultModelId: OpenAIEntityModelID;
  defaultRecentModelsIds: string[];
  defaultRecentAddonsIds: string[];
}

const Home = ({
  appName,
  footerHtmlMessage,
  enabledFeatures,
  isIframe,
  defaultModelId,
  authDisabled,
  defaultRecentModelsIds,
  defaultRecentAddonsIds,
}: Props) => {
  const session = useSession();

  const enabledFeaturesSet = new Set(enabledFeatures);
  const { t } = useTranslation('chat');
  const [selectedConversationNames, setSelectedConversationNames] = useState<
    string[]
  >([]);

  const dispatch = useAppDispatch();
  const clientDefaultModelId = useAppSelector(selectDefaultModelId);
  const models = useAppSelector(selectModels);
  const modelsMap = useAppSelector(selectModelsMap);

  const contextValue = useCreateReducer<HomeInitialState>({
    initialState,
  });

  const {
    state: {
      lightMode,
      folders,
      conversations,
      selectedConversationIds,
      prompts,
      isProfileOpen,
    },
    dispatch: oldDispatch,
  } = contextValue;

  // FETCH MODELS ----------------------------------------------

  const handleSelectConversation = (conversation: Conversation) => {
    const newSelectedIds = [conversation.id];
    oldDispatch({
      field: 'selectedConversationIds',
      value: newSelectedIds,
    });

    oldDispatch({
      field: 'isCompareMode',
      value: false,
    });

    saveSelectedConversationIds(newSelectedIds);
  };

  const handleSelectConversations = (conversations: Conversation[]) => {
    const newSelectedIds = Array.from(
      new Set(conversations.map(({ id }) => id)),
    );
    oldDispatch({
      field: 'selectedConversationIds',
      value: newSelectedIds,
    });

    saveSelectedConversationIds(newSelectedIds);
  };

  // FOLDER OPERATIONS  --------------------------------------------

  const handleCreateFolder = (
    name: string,
    type: FolderType,
  ): FolderInterface => {
    const newFolder: FolderInterface = {
      id: uuidv4(),
      name,
      type,
    };

    const updatedFolders = [...folders, newFolder];

    oldDispatch({ field: 'folders', value: updatedFolders });
    saveFolders(updatedFolders);
    return newFolder;
  };

  const handleDeleteFolder = (folderId: string) => {
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    oldDispatch({ field: 'folders', value: updatedFolders });
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

    oldDispatch({ field: 'conversations', value: updatedConversations });
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

    oldDispatch({ field: 'prompts', value: updatedPrompts });
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

    oldDispatch({ field: 'folders', value: updatedFolders });

    saveFolders(updatedFolders);
  };

  // CONVERSATION OPERATIONS  --------------------------------------------

  const updateAllConversationsStore = (
    updatedConversations: Conversation[],
  ) => {
    oldDispatch({ field: 'conversations', value: updatedConversations });

    saveConversations(updatedConversations);
  };

  const addNewConversationToStore = (newConversations: Conversation[]) => {
    const updatedConversations = [...conversations, ...newConversations];
    const ids = newConversations.map(({ id }) => id);
    updateAllConversationsStore(updatedConversations);

    oldDispatch({
      field: 'selectedConversationIds',
      value: ids,
    });
    oldDispatch({
      field: 'isCompareMode',
      value: false,
    });

    saveSelectedConversationIds(ids);
  };

  const defaultReplay: Replay = {
    isReplay: false,
    replayUserMessagesStack: [],
    activeReplayIndex: 0,
  };
  const handleNewConversation = (
    name = DEFAULT_CONVERSATION_NAME,
  ): Conversation | undefined => {
    dispatch(getModels());
    dispatch(getAddons());

    if (!clientDefaultModelId) {
      return;
    }

    const lastConversation = conversations[conversations.length - 1];
    const model = modelsMap[clientDefaultModelId] || models[0];

    if (!model) {
      return;
    }

    const newConversation: Conversation = {
      id: uuidv4(),
      name: t(name),
      messages: [],
      model: {
        id: model.id,
        name: model.name,
        maxLength: model.maxLength ?? defaultModelLimits.maxLength,
        requestLimit: model.requestLimit ?? defaultModelLimits.requestLimit,
        type: model.type,
      },
      prompt: DEFAULT_SYSTEM_PROMPT,
      temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
      folderId: null,
      replay: defaultReplay,
      selectedAddons: model.selectedAddons ?? [],
      lastActivityDate: Date.now(),
    };

    addNewConversationToStore([newConversation]);
    oldDispatch({ field: 'loading', value: false });

    dispatch(updateRecentModels({ modelId: newConversation.model.id }));

    return newConversation;
  };

  const handleNewConversations = (
    name = DEFAULT_CONVERSATION_NAME,
    count = 2,
  ): Conversation[] | undefined => {
    dispatch(getModels());
    dispatch(getAddons());
    if (!clientDefaultModelId) {
      return;
    }
    const lastConversation = conversations[conversations.length - 1];
    const model = modelsMap[clientDefaultModelId] || models[0];

    if (!model) {
      return;
    }
    const newConversations = [];
    for (let i = 0; i < count; i++) {
      const newConversation: Conversation = {
        id: uuidv4(),
        name: t(name),
        messages: [],
        model: {
          id: model.id,
          name: model.name,
          maxLength: model.maxLength ?? defaultModelLimits.maxLength,
          requestLimit: model.requestLimit ?? defaultModelLimits.requestLimit,
          type: model.type,
        },
        prompt: DEFAULT_SYSTEM_PROMPT,
        temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
        folderId: null,
        replay: defaultReplay,
        selectedAddons: model.selectedAddons ?? [],
        lastActivityDate: Date.now(),
      };
      newConversations.push(newConversation);
    }

    addNewConversationToStore(newConversations);
    oldDispatch({ field: 'loading', value: false });

    return newConversations;
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

    oldDispatch({ field: 'conversations', value: allConversation });

    return allConversation;
  };

  const handleNewReplayConversation = (conversation: Conversation) => {
    const newConversationName = `[Replay] ${conversation.name}`;

    const userMessages = conversation.messages.filter(
      ({ role }) => role === 'user',
    );
    const newConversation: Conversation = {
      ...conversation,
      id: uuidv4(),
      name: newConversationName,
      messages: [],

      replay: {
        isReplay: true,
        replayUserMessagesStack: userMessages,
        activeReplayIndex: 0,
      },
    };

    addNewConversationToStore([newConversation]);
  };

  // EFFECTS  --------------------------------------------

  useEffect(() => {
    if (window.innerWidth < 640) {
      oldDispatch({ field: 'showChatbar', value: false });
    }
  }, [selectedConversationIds]);

  // ON LOAD --------------------------------------------

  useEffect(() => {
    defaultModelId && dispatch(setDefaultModelId({ defaultModelId }));
    footerHtmlMessage &&
      oldDispatch({
        field: 'footerHtmlMessage',
        value: footerHtmlMessage,
      });
    enabledFeaturesSet &&
      oldDispatch({
        field: 'enabledFeatures',
        value: enabledFeaturesSet,
      });
    isIframe &&
      oldDispatch({
        field: 'isIframe',
        value: isIframe,
      });
    defaultRecentModelsIds &&
      dispatch(
        initRecentModels({
          defaultRecentModelsIds,
          localStorageRecentModelsIds: JSON.parse(
            localStorage.getItem('recentModelsIds') || '[]',
          ),
        }),
      );
    defaultRecentAddonsIds &&
      dispatch(
        initRecentAddons({
          defaultRecentAddonsIds,
          localStorageRecentAddonsIds: JSON.parse(
            localStorage.getItem('recentAddonsIds') || '[]',
          ),
        }),
      );

    dispatch(getModels());
    dispatch(getAddons());
  }, []);

  const handleIframeAuth = async () => {
    const timeout = 30 * 1000;
    let complete = false;
    await Promise.race([
      timeoutAsync(timeout),
      (async () => {
        const authWindowLocation = new AuthWindowLocationLike(
          '/api/auth/signin',
        );

        await authWindowLocation.ready; // ready after redirects
        const t = Math.max(100, timeout / 1000);
        // wait for redirection to back
        while (!complete) {
          try {
            if (authWindowLocation.href === window.location.href) {
              complete = true;
              authWindowLocation.destroy();
              break;
            }
          } catch {
            // Do nothing
          }
          await delay(t);
        }
        window.location.reload();

        return;
      })(),
    ]);
  };

  useEffect(() => {
    // Hack for ios 100vh issue
    const handleSetProperVHPoints = () => {
      document.documentElement.style.setProperty(
        '--vh',
        window.innerHeight * 0.01 + 'px',
      );
    };
    handleSetProperVHPoints();
    window.addEventListener('resize', handleSetProperVHPoints);

    const settings = getSettings();
    if (settings.theme) {
      oldDispatch({
        field: 'lightMode',
        value: settings.theme,
      });
    }

    if (window.innerWidth < 640) {
      oldDispatch({ field: 'showChatbar', value: false });
      oldDispatch({ field: 'showPromptbar', value: false });
    }

    const showChatbar = localStorage.getItem('showChatbar');
    if (showChatbar) {
      oldDispatch({ field: 'showChatbar', value: showChatbar === 'true' });
    }

    const showPromptbar = localStorage.getItem('showPromptbar');
    if (showPromptbar) {
      oldDispatch({ field: 'showPromptbar', value: showPromptbar === 'true' });
    }

    const folders = localStorage.getItem('folders');
    if (folders) {
      oldDispatch({ field: 'folders', value: JSON.parse(folders) });
    }

    const prompts = localStorage.getItem('prompts');
    if (prompts) {
      oldDispatch({ field: 'prompts', value: JSON.parse(prompts) });
    }

    const conversationHistory = localStorage.getItem('conversationHistory');
    let cleanedConversationHistory: Conversation[] = [];
    if (conversationHistory) {
      const parsedConversationHistory: Conversation[] =
        JSON.parse(conversationHistory);
      cleanedConversationHistory = cleanConversationHistory(
        parsedConversationHistory,
      );

      oldDispatch({
        field: 'conversations',
        value: cleanedConversationHistory,
      });
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
      oldDispatch({
        field: 'selectedConversationIds',
        value: filteredSelectedConversationIds,
      });

      if (filteredSelectedConversationIds.length > 1) {
        oldDispatch({
          field: 'isCompareMode',
          value: true,
        });
      }
    } else {
      const lastConversation =
        cleanedConversationHistory[conversations.length - 1];
      const defaultModel: OpenAIEntityModel =
        OpenAIEntityModels[defaultModelId];

      const newConversation: Conversation = {
        id: uuidv4(),
        name: t(DEFAULT_CONVERSATION_NAME),
        messages: [],
        model: defaultModel,
        prompt: DEFAULT_SYSTEM_PROMPT,
        temperature: lastConversation?.temperature ?? DEFAULT_TEMPERATURE,
        folderId: null,
        replay: defaultReplay,
        selectedAddons: OpenAIEntityModels[defaultModelId].selectedAddons ?? [],
        lastActivityDate: Date.now(),
      };

      const updatedConversations: Conversation[] =
        cleanedConversationHistory.concat(newConversation);

      oldDispatch({
        field: 'selectedConversationIds',
        value: [newConversation.id],
      });

      updateAllConversationsStore(updatedConversations);
      saveSelectedConversationIds([newConversation.id]);
    }
  }, []);

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
        handleNewConversations,
        handleCreateFolder,
        handleDeleteFolder,
        handleUpdateFolder,
        handleSelectConversation,
        handleSelectConversations,
        handleUpdateConversation,
        handleNewReplayConversation,
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

      {isIframe && !authDisabled && session.status !== 'authenticated' ? (
        <div className="grid h-full min-h-[100px] w-full place-items-center bg-gray-900 text-sm text-gray-200 ">
          <button
            onClick={handleIframeAuth}
            className="appearance-none rounded-lg border-gray-600 p-3 hover:bg-gray-600"
          >
            {t('Login')}
          </button>
        </div>
      ) : (
        selectedConversationNames.length > 0 && (
          <main className={`${lightMode} `}>
            <div
              className={`theme-main flex h-screen w-screen flex-col bg-gray-300 text-sm text-gray-800 dark:bg-gray-900 dark:text-gray-200`}
              id="theme-main"
            >
              <div className={`flex h-full w-full flex-col sm:pt-0`}>
                {enabledFeaturesSet.has('header') && <Header />}
                <div className="flex w-full grow overflow-auto">
                  {enabledFeaturesSet.has('conversations-section') && (
                    <Chatbar />
                  )}

                  <div className="flex flex-1">
                    <Chat appName={appName} />
                  </div>

                  {enabledFeaturesSet.has('prompts-section') && <Promptbar />}
                  {isProfileOpen && <UserMobile />}
                </div>
              </div>
            </div>
          </main>
        )
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
  const isIframe = process.env.IS_IFRAME === 'true' || false;
  res.setHeader(
    'Content-Security-Policy',
    process.env.ALLOWED_IFRAME_ORIGINS
      ? 'frame-ancestors ' + process.env.ALLOWED_IFRAME_ORIGINS
      : 'frame-ancestors none',
  );
  const session = await getServerSession(req, res, authOptions);
  if (!isIframe && process.env.AUTH_DISABLED !== 'true' && !session) {
    return {
      redirect: {
        permanent: false,
        destination: '/api/auth/signin',
      },
    };
  }

  const updatedFooterHTMLMessage = (
    process.env.FOOTER_HTML_MESSAGE ?? ''
  ).replace('%%VERSION%%', packageJSON.version);

  return {
    props: {
      appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Chatbot UI',
      footerHtmlMessage: updatedFooterHTMLMessage,
      enabledFeatures: (process.env.ENABLED_FEATURES || '').split(','),
      isIframe,
      defaultModelId: process.env.DEFAULT_MODEL || fallbackModelID,
      authDisabled: process.env.AUTH_DISABLED === 'true',
      defaultRecentModelsIds:
        (process.env.RECENT_MODELS_IDS &&
          process.env.RECENT_MODELS_IDS.split(',')) ||
        [],
      defaultRecentAddonsIds:
        (process.env.RECENT_ADDONS_IDS &&
          process.env.RECENT_ADDONS_IDS.split(',')) ||
        [],
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
