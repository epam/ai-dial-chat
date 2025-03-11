import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import { pages } from '@/src/utils/auth/auth-pages';
import {
  DEFAULT_PROVIDER,
  isAuthDisabled,
} from '@/src/utils/auth/auth-providers';
import { isServerSessionValid } from '@/src/utils/auth/session';

import { StorageType } from '@/src/types/storage';
import { Translation } from '@/src/types/translation';

import { SettingsState } from '@/src/store/settings/settings.reducers';

import { ISOLATED_MODEL_QUERY_PARAM } from '@/src/constants/chat';
import {
  FALLBACK_ASSISTANT_SUBMODEL_ID,
  FALLBACK_MODEL_ID,
} from '@/src/constants/default-ui-settings';
import {
  DEFAULT_QUICK_APPS_HOST,
  DEFAULT_QUICK_APPS_MODEL,
  DEFAULT_QUICK_APPS_SCHEMA_ID,
} from '@/src/constants/quick-apps';

import { authOptions } from '@/src/pages/api/auth/[...nextauth]';

// eslint-disable-next-line @nx/enforce-module-boundaries
import packageJSON from '../../../../../package.json';

import { Feature } from '@epam/ai-dial-shared';
import { URL, URLSearchParams } from 'url';

const disabledFeaturesForIsolatedView = new Set([
  Feature.ConversationsSection,
  Feature.PromptsSection,
  Feature.MessageTemplates,
]);

const hiddenFeaturesForIsolatedView = [
  Feature.HideNewConversation,
  Feature.HideEmptyChatChangeAgent,
  Feature.DisallowChangeAgent,
  Feature.HideTopContextMenu,
];

export const getCommonPageProps: GetServerSideProps = async ({
  locale,
  req,
  res,
  resolvedUrl,
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

  let params: URLSearchParams | undefined;
  if (req.url) {
    params = new URL(req.url, `http://${req.headers.host}`).searchParams;
  }

  if (
    !Object.values(pages).some((page) => page && resolvedUrl?.includes(page))
  ) {
    const session = await getServerSession(req, res, authOptions);
    if (!isServerSessionValid(session)) {
      return {
        redirect: {
          permanent: false,
          destination: `/api/auth/signin${params?.size ? `?callbackUrl=/?${params.toString()}` : ''}`,
        },
      };
    }
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
          ? !disabledFeaturesForIsolatedView.has(feature)
          : true,
      )
      .concat(
        params?.has(ISOLATED_MODEL_QUERY_PARAM)
          ? hiddenFeaturesForIsolatedView
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
    quickAppsHost: process.env.QUICK_APPS_HOST || DEFAULT_QUICK_APPS_HOST,
    quickAppsModel: process.env.QUICK_APPS_MODEL || DEFAULT_QUICK_APPS_MODEL,
    quickAppsSchemaId:
      process.env.QUICK_APPS_SCHEMA_ID || DEFAULT_QUICK_APPS_SCHEMA_ID,
    dialApiHost: process.env.DIAL_API_HOST || '',
    defaultSystemPrompt: process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT || '',
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
      defaultAuthProvider: DEFAULT_PROVIDER,
    },
  };
};
