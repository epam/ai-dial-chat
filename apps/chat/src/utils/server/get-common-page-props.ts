import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import { pages } from '@/src/utils/auth/auth-pages';
import { isAuthDisabled } from '@/src/utils/auth/auth-providers';
import { isServerSessionValid } from '@/src/utils/auth/session';

import { StorageType } from '@/src/types/storage';
import { Translation } from '@/src/types/translation';

import { SettingsState } from '@/src/store/settings/settings.types';

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
import { parseCommaSeparatedList } from '../app/common';

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

  let session = null;
  if (
    !Object.values(pages).some((page) => page && resolvedUrl?.includes(page))
  ) {
    session = await getServerSession(req, res, authOptions);
    if (!isServerSessionValid(session)) {
      let callbackUrl: string | undefined;
      if (req.url) {
        const url = new URL(
          req.url,
          `${req.headers['x-forwarded-proto']}://${req.headers.host}`,
        );
        url.searchParams.delete('callbackUrl');
        callbackUrl = url.toString();
      }
      return {
        redirect: {
          permanent: false,
          destination: `/api/auth/signin${req.url ? `?callbackUrl=${encodeURIComponent(callbackUrl ?? '/')}` : ''}`,
        },
      };
    }
  }

  const customRenderers =
    process.env.CUSTOM_VISUALIZERS &&
    JSON.parse(process.env.CUSTOM_VISUALIZERS);

  const isIsolatedView = params?.has(ISOLATED_MODEL_QUERY_PARAM);

  const settings: SettingsState = {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'AI Dial',
    codeWarning: process.env.CODE_GENERATION_WARNING ?? '',
    defaultRecentModelsIds: parseCommaSeparatedList(
      process.env.RECENT_MODELS_IDS,
    ),
    defaultRecentAddonsIds: parseCommaSeparatedList(
      process.env.RECENT_ADDONS_IDS,
    ),
    defaultModelId: process.env.DEFAULT_MODEL ?? FALLBACK_MODEL_ID,
    defaultAssistantSubmodelId:
      process.env.NEXT_PUBLIC_DEFAULT_ASSISTANT_SUB_MODEL ??
      FALLBACK_ASSISTANT_SUBMODEL_ID,
    codeEditorPythonVersions: parseCommaSeparatedList(
      process.env.CODE_EDITOR_PYTHON_VERSIONS,
      ['python3.9', 'python3.10', 'python3.11', 'python3.12'],
    ),
    enabledFeatures: (
      parseCommaSeparatedList(process.env.ENABLED_FEATURES) as Feature[]
    )
      .filter((feature) =>
        isIsolatedView ? !disabledFeaturesForIsolatedView.has(feature) : true,
      )
      .concat(isIsolatedView ? hiddenFeaturesForIsolatedView : []),
    widgetsSchemaIds: parseCommaSeparatedList(
      process.env.WIDGETS_SCHEMA_IDS,
      [],
    ),
    publicationFilters: parseCommaSeparatedList(
      process.env.PUBLICATION_FILTERS,
      ['title', 'role', 'dial_roles'],
    ),
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
    topics: parseCommaSeparatedList(
      process.env.TOPICS ??
        'Business,Development,User Experience,Analysis,SQL,SDLC,Talk-To-Your-Data,RAG,Text Generation,Image Generation,Image Recognition',
    ),
    quickAppsHost: process.env.QUICK_APPS_HOST || DEFAULT_QUICK_APPS_HOST,
    quickAppsModel: process.env.QUICK_APPS_MODEL || DEFAULT_QUICK_APPS_MODEL,
    quickAppsSchemaId:
      process.env.QUICK_APPS_SCHEMA_ID || DEFAULT_QUICK_APPS_SCHEMA_ID,
    dialApiHost: process.env.DIAL_API_HOST || '',
    defaultSystemPrompt: process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT || '',
    providerId: session?.providerId ?? null,
  };

  if (isIsolatedView) {
    settings.isolatedModelId = params?.get(ISOLATED_MODEL_QUERY_PARAM) || '';
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
