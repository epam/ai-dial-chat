import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

import { parseCommaSeparatedList } from '@/src/utils/app/common';
import { authOptions } from '@/src/utils/auth/auth-options';
import { pages } from '@/src/utils/auth/auth-pages';
import { isAuthDisabled } from '@/src/utils/auth/auth-providers';
import { isServerSessionValid } from '@/src/utils/auth/session';

import { StorageType } from '@/src/types/storage';
import { Translation } from '@/src/types/translation';

import { SettingsState } from '@/src/store/settings/settings.types';

import {
  ACTION_QUERY_PARAM,
  CONVERSATION_QUERY_PARAM,
  ISOLATED_MODEL_QUERY_PARAM,
} from '@/src/constants/chat';
import { DEFAULT_MODEL_ID } from '@/src/constants/default-server-settings';
import { resolveResourceMaxSegmentBytes } from '@/src/constants/default-ui-settings';
import { DEFAULT_EXTERNAL_APPS_SCHEMA_ID } from '@/src/constants/external-apps';
import {
  DEFAULT_QUICK_APPS_HOST,
  DEFAULT_QUICK_APPS_MODEL,
  DEFAULT_QUICK_APPS_SCHEMA_ID,
} from '@/src/constants/quick-apps';
import { HeadersNames } from '@/src/constants/server';

import { safeParseJSON } from '../json';
import {
  cleanHeaderDirectives,
  getFrameContentSecurityPolicyDirectives,
} from './headers-helpers';

import packageJSON from '@/../../package.json';
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
  const requestCSPHeaders = req.headers[HeadersNames.CONTENT_SECURITY_POLICY];

  const [cspHeader, nonce] = getFrameContentSecurityPolicyDirectives();

  const cspHeaders = `${requestCSPHeaders ? requestCSPHeaders : cspHeader}`;

  const contentSecurityPolicyHeaderValue = cleanHeaderDirectives(cspHeaders);

  res.setHeader('x-nonce', nonce);
  res.setHeader(
    HeadersNames.CONTENT_SECURITY_POLICY,
    contentSecurityPolicyHeaderValue,
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

  const applicationVisualizers =
    process.env.APPLICATION_VISUALIZERS &&
    JSON.parse(process.env.APPLICATION_VISUALIZERS);

  const isIsolatedView = params?.has(ISOLATED_MODEL_QUERY_PARAM);
  const isPreselectedConversation = params?.has(CONVERSATION_QUERY_PARAM);
  const isPreselectedAction = params?.has(ACTION_QUERY_PARAM);
  const enabledFeaturesData = process.env.ENABLED_FEATURES_DATA
    ? safeParseJSON(
        process.env.ENABLED_FEATURES_DATA?.replaceAll('\\"', '"'),
        'Error when parsing ENABLED_FEATURES_DATA',
        console,
      )
    : [];

  const settings: SettingsState = {
    appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'DIAL',
    codeWarning: process.env.CODE_GENERATION_WARNING ?? '',
    defaultRecentModelsIds: parseCommaSeparatedList(
      process.env.RECENT_MODELS_IDS,
    ),
    defaultModelReference: DEFAULT_MODEL_ID,
    isOptimisticLoadEnabled: process.env.ENABLE_OPTIMISTIC_LOAD === 'true',
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
    enabledFeaturesData,
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
    applicationVisualizers: applicationVisualizers || {},
    allowVisualizerSendMessages: !!process.env.ALLOW_VISUALIZER_SEND_MESSAGES,
    topics: parseCommaSeparatedList(
      process.env.TOPICS ??
        'Business,Development,User Experience,Analysis,SQL,SDLC,Talk-To-Your-Data,RAG,Text Generation,Image Generation,Image Recognition',
    ),
    hiddenEntityTag: process.env.HIDDEN_ENTITY_TAG ?? '',
    quickAppsHost: process.env.QUICK_APPS_HOST || DEFAULT_QUICK_APPS_HOST,
    quickAppsModel: process.env.QUICK_APPS_MODEL || DEFAULT_QUICK_APPS_MODEL,
    quickAppsSchemaId:
      process.env.QUICK_APPS_SCHEMA_ID || DEFAULT_QUICK_APPS_SCHEMA_ID,
    externalAppsSchemaId:
      process.env.EXTERNAL_APPS_SCHEMA_ID || DEFAULT_EXTERNAL_APPS_SCHEMA_ID,
    dialApiHost: process.env.DIAL_API_HOST || '',
    dialCoreExternalUrl: process.env.DIAL_CORE_EXTERNAL_URL || '',
    defaultSystemPrompt: process.env.NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT || '',
    asrModelId: process.env.ASR_MODEL || null,
    audioTypesDefaultOrder: parseCommaSeparatedList(
      process.env.AUDIO_TYPES_DEFAULT_ORDER,
      [],
    ),
    providerId: session?.providerId ?? null,
    attachmentsSettings: {
      expandedTypes: parseCommaSeparatedList(
        process.env.ATTACHMENT_TYPES_EXPANDED,
        [],
      ),
      borderlessTypes: parseCommaSeparatedList(
        process.env.ATTACHMENT_TYPES_BORDERLESS,
        [],
      ),
      withoutTitleTypes: parseCommaSeparatedList(
        process.env.ATTACHMENT_TYPES_WITHOUT_TITLE,
        [],
      ),
    },
    stageContentLimit: parseFloat(
      process.env.NEXT_PUBLIC_STAGE_CONTENT_LIMIT || '40',
    ),
    resourceMaxSegmentBytes: resolveResourceMaxSegmentBytes(
      process.env.NEXT_PUBLIC_RESOURCE_MAX_SEGMENT_BYTES,
    ),
  };

  if (isIsolatedView) {
    settings.isolatedModelId = params?.get(ISOLATED_MODEL_QUERY_PARAM) || '';
  }

  if (isPreselectedConversation) {
    settings.preselectedConversationId =
      params?.get(CONVERSATION_QUERY_PARAM) || '';
  }

  if (isPreselectedAction) {
    settings.preselectedAction = params?.get(ACTION_QUERY_PARAM) || '';
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
