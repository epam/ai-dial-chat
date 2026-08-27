import {
  AppConfigApi,
  ApplicationsApi,
  AuthApi,
  ClientChannelApi,
  Configuration,
  ConversationsApi,
  DeploymentsApi,
  FilesApi,
  HealthApi,
  ModelsApi,
  OfflineCredentialsApi,
  PromptsApi,
  PublishApi,
  RateApi,
  ScheduledTasksApi,
  ShareApi,
  SkillsApi,
  ToolsetsApi,
  UserApi,
  UserConfigApi,
} from '@epam/ai-dial-chat-api-client';
import type { Middleware } from '@epam/ai-dial-chat-api-client';
import {
  createCsrfMiddleware,
  createUnauthorizedMiddleware,
  type CsrfRefreshOutcome,
} from '@epam/ai-dial-chat-hooks';
import {
  ApiEndpoints,
  CsrfRefreshStatus,
  UnauthorizedError,
  getCsrfToken,
  isInvalidCsrfErrorBody,
  notifyUnauthorized,
  refreshCsrfToken,
  setCsrfToken,
} from './base';

const csrfMiddleware = createCsrfMiddleware({ getCsrfToken, setCsrfToken });

/*
 * Adapts `base.ts`'s enum-based `CsrfRefreshResult` to the factory's
 * plain-literal `CsrfRefreshOutcome`, so `libs/chat-hooks` never needs to
 * import an app-owned enum.
 */
const refreshCsrfTokenOutcome = async (): Promise<CsrfRefreshOutcome> => {
  const result = await refreshCsrfToken();
  if (result.status === CsrfRefreshStatus.Ok) {
    return { status: 'ok', token: result.token };
  }
  return {
    status:
      result.status === CsrfRefreshStatus.Unauthorized
        ? 'unauthorized'
        : 'failed',
  };
};

const unauthorizedMiddleware = createUnauthorizedMiddleware({
  notifyUnauthorized,
  refreshCsrfToken: refreshCsrfTokenOutcome,
  refreshUnauthorizedUrl: ApiEndpoints.AUTH_ME,
  isInvalidCsrfErrorBody,
  getCsrfToken,
  setCsrfToken,
  createUnauthorizedError: (url) => new UnauthorizedError(url),
});

const telemetryMiddleware: Middleware = {
  post: async (context) => {
    console.info(
      `[api] ${context.init.method ?? 'GET'} ${context.url} → ${context.response.status}`,
    );
    return context.response;
  },
};

export const createApiConfiguration = (): Configuration =>
  new Configuration({
    basePath: '',
    credentials: 'include',
    middleware: [csrfMiddleware, unauthorizedMiddleware, telemetryMiddleware],
  });

const config = createApiConfiguration();

export const applicationsApi = new ApplicationsApi(config);
export const appConfigApi = new AppConfigApi(config);
export const deploymentsApi = new DeploymentsApi(config);
export const userApi = new UserApi(config);
export const filesApi = new FilesApi(config);
export const modelsApi = new ModelsApi(config);
export const conversationsApi = new ConversationsApi(config);
export const userConfigApi = new UserConfigApi(config);
export const authApi = new AuthApi(config);
export const rateApi = new RateApi(config);
export const toolsetsApi = new ToolsetsApi(config);
export const shareApi = new ShareApi(config);
export const skillsApi = new SkillsApi(config);
export const publishApi = new PublishApi(config);
export const promptsApi = new PromptsApi(config);
export const clientChannelApi = new ClientChannelApi(config);
export const scheduledTasksApi = new ScheduledTasksApi(config);
export const offlineCredentialsApi = new OfflineCredentialsApi(config);
export const healthApi = new HealthApi(config);
