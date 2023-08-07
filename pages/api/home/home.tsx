import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useQuery } from 'react-query';

import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import Head from 'next/head';

import { useCreateReducer } from '@/hooks/useCreateReducer';

import useErrorService from '@/services/errorService';
import useApiService from '@/services/useApiService';

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
  OpenAIEntityAddon,
  OpenAIEntityModel,
  OpenAIEntityModelID,
  OpenAIEntityModels,
  defaultModelLimits,
  fallbackModelID,
} from '@/types/openai';
import { Prompt } from '@/types/prompt';

import { Chat } from '@/components/Chat/Chat';
import { Chatbar } from '@/components/Chatbar/Chatbar';
import Header from '@/components/Header/Header';
import { UserMobile } from '@/components/Header/UserMobile';
import Promptbar from '@/components/Promptbar';

import packageJSON from '../../../package.json';
import { authOptions } from '../auth/[...nextauth]';
import HomeContext from './home.context';
import { HomeInitialState, initialState } from './home.state';

import { v4 as uuidv4 } from 'uuid';

interface Props {
  serverSideApiKeyIsSet: boolean;
  serverSidePluginKeysSet: boolean;
  usePluginKeys: boolean;
  appName: string;
  footerHtmlMessage: string;
  enabledFeatures: Feature[];
  isIframe: boolean;
  modelIconMapping: string;
  authDisabled: boolean;
  defaultModelId: OpenAIEntityModelID;
}

const Home = ({
  serverSideApiKeyIsSet,
  serverSidePluginKeysSet,
  usePluginKeys,
  appName,
  footerHtmlMessage,
  enabledFeatures,
  isIframe,
  modelIconMapping,
  defaultModelId,
  authDisabled,
}: Props) => {
  const session = useSession();

  const enabledFeaturesSet = new Set(enabledFeatures);
  const { t } = useTranslation('chat');
  const { getModels, getAddons } = useApiService();
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
      defaultModelId: clientDefaultModelId,
      models,
      modelsMap,
      isProfileOpen,
    },
    dispatch,
  } = contextValue;

  const { data: modelsData, error: modelsError } = useQuery(
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
    { enabled: true, refetchOnMount: false, staleTime: 60000 },
  );

  useEffect(() => {
    if (modelsData) {
      // TODO: get rid of models array to use faster map
      dispatch({ field: 'models', value: modelsData });
      dispatch({
        field: 'modelsMap',
        value: (modelsData as any as OpenAIEntityModel[]).reduce(
          (acc, model) => {
            acc[model.id] = model;

            return acc;
          },
          {} as Record<string, OpenAIEntityModel>,
        ),
      });

      const defaultModelId = (modelsData as any as OpenAIEntityModel[]).find(
        (model) => model.isDefault,
      )?.id;

      dispatch({ field: 'defaultModelId', value: defaultModelId });
    }
  }, [modelsData, dispatch]);

  useEffect(() => {
    dispatch({ field: 'modelError', value: getModelsError(modelsError) });
  }, [dispatch, modelsError, getModelsError]);

  const { data: addonsData, error: addonsError } = useQuery(
    ['GetAddons', apiKey, serverSideApiKeyIsSet],
    ({ signal }) => {
      if (!apiKey && !serverSideApiKeyIsSet) return null;

      return getAddons(
        {
          key: apiKey,
        },
        signal,
      );
    },
    { enabled: true, refetchOnMount: false, staleTime: 60000 },
  );

  useEffect(() => {
    if (addonsData) {
      dispatch({ field: 'addons', value: addonsData });

      dispatch({
        field: 'addonsMap',
        value: (addonsData as any as OpenAIEntityAddon[]).reduce(
          (acc, addon) => {
            acc[addon.id] = addon;

            return acc;
          },
          {} as Record<string, OpenAIEntityAddon>,
        ),
      });
    }
  }, [addonsData, dispatch]);

  useEffect(() => {
    dispatch({ field: 'addonError', value: getModelsError(addonsError) });
  }, [dispatch, addonsError, getModelsError]);

  // FETCH MODELS ----------------------------------------------

  const handleSelectConversation = (conversation: Conversation) => {
    const newSelectedIds = [conversation.id];
    dispatch({
      field: 'selectedConversationIds',
      value: newSelectedIds,
    });

    dispatch({
      field: 'isCompareMode',
      value: false,
    });

    saveSelectedConversationIds(newSelectedIds);
  };

  const handleSelectConversations = (conversations: Conversation[]) => {
    const newSelectedIds = Array.from(
      new Set(conversations.map(({ id }) => id)),
    );
    dispatch({
      field: 'selectedConversationIds',
      value: newSelectedIds,
    });

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

  const updateAllConversationsStore = (
    updatedConversations: Conversation[],
  ) => {
    dispatch({ field: 'conversations', value: updatedConversations });

    saveConversations(updatedConversations);
  };

  const addNewConversationToStore = (newConversations: Conversation[]) => {
    const updatedConversations = [...conversations, ...newConversations];
    const ids = newConversations.map(({ id }) => id);
    updateAllConversationsStore(updatedConversations);

    dispatch({
      field: 'selectedConversationIds',
      value: ids,
    });
    dispatch({
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
    dispatch({ field: 'loading', value: false });

    return newConversation;
  };

  const handleNewConversations = (
    name = DEFAULT_CONVERSATION_NAME,
    count = 2,
  ): Conversation[] | undefined => {
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
    dispatch({ field: 'loading', value: false });

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

    dispatch({ field: 'conversations', value: allConversation });

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
      dispatch({ field: 'showChatbar', value: false });
    }
  }, [selectedConversationIds]);

  useEffect(() => {
    defaultModelId &&
      dispatch({
        field: 'defaultModelId',
        value: defaultModelId,
      });
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

    footerHtmlMessage &&
      dispatch({
        field: 'footerHtmlMessage',
        value: footerHtmlMessage,
      });
    enabledFeaturesSet &&
      dispatch({
        field: 'enabledFeatures',
        value: enabledFeaturesSet,
      });
    isIframe &&
      dispatch({
        field: 'isIframe',
        value: isIframe,
      });
    modelIconMapping &&
      dispatch({
        field: 'modelIconMapping',
        value: modelIconMapping,
      });
  }, [
    defaultModelId,
    modelIconMapping,
    serverSideApiKeyIsSet,
    serverSidePluginKeysSet,
    usePluginKeys,
    footerHtmlMessage,
    enabledFeatures,
  ]);

  // ON LOAD --------------------------------------------

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

      dispatch({
        field: 'selectedConversationIds',
        value: [newConversation.id],
      });

      updateAllConversationsStore(updatedConversations);
      saveSelectedConversationIds([newConversation.id]);
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
        <div className="grid h-full min-h-[100px] w-full place-items-center text-[#123123]">
          <button
            onClick={handleIframeAuth}
            className="appearance-none rounded-lg border-gray-200 bg-[#343541] p-3 text-gray-200"
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
                <Header />
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

  let serverSidePluginKeysSet = false;

  const googleApiKey = process.env.GOOGLE_API_KEY;
  const googleCSEId = process.env.GOOGLE_CSE_ID;

  if (googleApiKey && googleCSEId) {
    serverSidePluginKeysSet = true;
  }

  const updatedFooterHTMLMessage = (
    process.env.FOOTER_HTML_MESSAGE ?? ''
  ).replace('%%VERSION%%', packageJSON.version);

  let modelIconMap: Record<string, string> = {};
  if (process.env.MODEL_ICON_MAPPING) {
    modelIconMap = process.env.MODEL_ICON_MAPPING.split(',').reduce<
      Record<string, string>
    >((acc, modelIcon) => {
      const [modelId, iconClass] = modelIcon.split('=');

      acc[modelId] = iconClass;

      return acc;
    }, {});
  }

  return {
    props: {
      serverSideApiKeyIsSet: !!process.env.OPENAI_API_KEY,
      usePluginKeys: !!process.env.NEXT_PUBLIC_ENABLE_PLUGIN_KEYS,
      serverSidePluginKeysSet,
      appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'Chatbot UI',
      modelIconMapping: modelIconMap,
      footerHtmlMessage: updatedFooterHTMLMessage,
      enabledFeatures: (process.env.ENABLED_FEATURES || '').split(','),
      isIframe,
      defaultModelId: process.env.DEFAULT_MODEL || fallbackModelID,
      authDisabled: process.env.AUTH_DISABLED === 'true',
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
