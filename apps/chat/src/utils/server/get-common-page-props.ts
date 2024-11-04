import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import { isAuthDisabled } from '@/src/utils/auth/auth-providers';
import { isServerSessionValid } from '@/src/utils/auth/session';

import { StorageType } from '@/src/types/storage';
import { Translation } from '@/src/types/translation';

import { SettingsState } from '@/src/store/settings/settings.reducers';

import { ISOLATED_MODEL_QUERY_PARAM } from '@/src/constants/chat';
import {
  FALLBACK_ASSISTANT_SUBMODEL_ID,
  FALLBACK_MODEL_ID,
} from '@/src/constants/default-ui-settings';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

// eslint-disable-next-line @nx/enforce-module-boundaries
import packageJSON from '../../../../../package.json';

import { Feature } from '@epam/ai-dial-shared';
import { URL } from 'url';

const hiddenFeaturesForIsolatedView = new Set([
  Feature.ConversationsSection,
  Feature.PromptsSection,
  Feature.EmptyChatSettings,
  Feature.TopChatModelSettings,
]);

export const getCommonPageProps: GetServerSideProps = async ({
  locale,
  req,
  res,
}) => {
  const ancestorsDirective = process.env.ALLOWED_IFRAME_ORIGINS
    ? 'frame-ancestors ' + process.env.ALLOWED_IFRAME_ORIGINS
    : 'frame-ancestors none';

  const frameSrcDirective = process.env.ALLOWED_IFRAME_SOURCES
    ? 'frame-src ' + process.env.ALLOWED_IFRAME_SOURCES
    : 'frame-src none';

  res.setHeader(
    'Content-Security-Policy',
    ancestorsDirective + '; ' + frameSrcDirective,
  );

  const session = await getServerSession(req, res, authOptions);
  let params: URLSearchParams | undefined;
  if (req.url) {
    params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  }
  if (!isServerSessionValid(session)) {
    return {
      redirect: {
        permanent: false,
        destination: `api/auth/signin${params?.size ? `?callbackUrl=/?${params.toString()}` : ''}`,
      },
    };
  }

  const customRenderers =
    process.env.CUSTOM_VISUALIZERS &&
    JSON.parse(process.env.CUSTOM_VISUALIZERS);

  const settings: SettingsState = {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'AI Dial',
    codeWarning: process.env.CODE_GENERATION_WARNING ?? '',
    defaultRecentModelsIds:
      (process.env.RECENT_MODELS_IDS &&
        process.env.RECENT_MODELS_IDS.split(',')) ||
      [],
    defaultRecentAddonsIds:
      (process.env.RECENT_ADDONS_IDS &&
        process.env.RECENT_ADDONS_IDS.split(',')) ||
      [],
    defaultModelId: process.env.DEFAULT_MODEL ?? FALLBACK_MODEL_ID,
    defaultAssistantSubmodelId:
      process.env.NEXT_PUBLIC_DEFAULT_ASSISTANT_SUB_MODEL ??
      FALLBACK_ASSISTANT_SUBMODEL_ID,
    codeEditorPythonVersions: process.env.CODE_EDITOR_PYTHON_VERSIONS?.split(
      ',',
    ) ?? ['python3.9', 'python3.10', 'python3.11', 'python3.12'],
    enabledFeatures: (
      (process.env.ENABLED_FEATURES || '').split(',') as Feature[]
    )
      .filter((feature) =>
        params?.has(ISOLATED_MODEL_QUERY_PARAM)
          ? !hiddenFeaturesForIsolatedView.has(feature)
          : true,
      )
      .concat(
        params?.has(ISOLATED_MODEL_QUERY_PARAM)
          ? Feature.HideNewConversation
          : [],
      ),
    publicationFilters: (
      process.env.PUBLICATION_FILTERS || 'title,role,dial_roles'
    ).split(','),
    isOverlay: process.env.IS_IFRAME === 'true' || false,
    footerHtmlMessage: (process.env.FOOTER_HTML_MESSAGE ?? '').replace(
      '%%VERSION%%',
      packageJSON.version,
    ),
    isAuthDisabled,
    storageType: Object.values(StorageType).includes(
      process.env.STORAGE_TYPE as StorageType,
    )
      ? (process.env.STORAGE_TYPE as StorageType)
      : StorageType.API,
    announcement: process.env.ANNOUNCEMENT_HTML_MESSAGE || '',
    themesHostDefined: !!process.env.THEMES_CONFIG_HOST,
    customRenderers: customRenderers || [],
    allowVisualizerSendMessages: !!process.env.ALLOW_VISUALIZER_SEND_MESSAGES,
    topics: (
      process.env.TOPICS ??
      'Business,Development,User Experience,Analysis,SQL,SDLC,Talk-To-Your-Data,RAG,Text Generation,Image Generation,Image Recognition'
    ).split(','),
  };

  if (params?.has(ISOLATED_MODEL_QUERY_PARAM)) {
    settings.isolatedModelId = params.get(ISOLATED_MODEL_QUERY_PARAM) || '';
  }

  return {
    props: {
      appName: settings.appName,
      initialState: {
        settings,
      },
      ...(await serverSideTranslations(
        locale ?? 'en',
        Object.values(Translation),
      )),
    },
  };
};
