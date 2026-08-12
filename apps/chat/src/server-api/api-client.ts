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
  Middleware,
  ModelsApi,
  PublishApi,
  RateApi,
  ScheduledTasksApi,
  ShareApi,
  ToolsetsApi,
  UserConfigApi,
} from '@epam/ai-dial-chat-api-client';
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

type MiddlewarePostContext = Parameters<NonNullable<Middleware['post']>>[0];

const csrfMiddleware: Middleware = {
  pre: async (context) => {
    const token = getCsrfToken();
    if (context.init.method === 'GET' || token === null) {
      return context;
    }
    const headers = new Headers(context.init.headers);
    headers.set('X-CSRF-Token', token);
    return {
      ...context,
      init: {
        ...context.init,
        headers,
      },
    };
  },
  post: async (context) => {
    const rotated = context.response.headers.get('x-csrf-token');
    if (rotated) setCsrfToken(rotated);
    return context.response;
  },
};

const readResponseBody = async (response: Response): Promise<string> => {
  try {
    return await response.clone().text();
  } catch {
    return '';
  }
};

/*
 * The runtime threads the exact `init` object built in `csrfMiddleware.pre`
 * through to `post`, so the token actually sent can be read back from it.
 */
const getDispatchCsrfToken = (init: RequestInit): string | null =>
  new Headers(init.headers).get('X-CSRF-Token');

const fetchWithCsrfToken = (
  context: MiddlewarePostContext,
  token: string,
): Promise<Response> => {
  const headers = new Headers(context.init.headers);
  if (context.init.method !== 'GET') {
    headers.set('X-CSRF-Token', token);
  }
  return fetch(context.url, {
    ...context.init,
    headers,
  });
};

const retryWithFreshCsrf = async (
  context: MiddlewarePostContext,
): Promise<Response> => {
  const dispatchToken = getDispatchCsrfToken(context.init);
  const currentToken = getCsrfToken();

  if (currentToken !== null && currentToken !== dispatchToken) {
    // A concurrent request already refreshed the token; reuse it.
    return fetchWithCsrfToken(context, currentToken);
  }

  const refreshed = await refreshCsrfToken();
  if (refreshed.status === CsrfRefreshStatus.Unauthorized) {
    notifyUnauthorized(ApiEndpoints.AUTH_ME);
    throw new UnauthorizedError(ApiEndpoints.AUTH_ME);
  }
  if (refreshed.status !== CsrfRefreshStatus.Ok) {
    throw new Error(`CSRF refresh failed for ${context.url}`);
  }

  return fetchWithCsrfToken(context, refreshed.token);
};

const handleRetryResponse = async (
  context: MiddlewarePostContext,
  response: Response,
): Promise<Response> => {
  const rotated = response.headers.get('x-csrf-token');
  if (rotated) {
    setCsrfToken(rotated);
  }

  if (response.status === 401) {
    notifyUnauthorized(context.url);
    throw new UnauthorizedError(context.url);
  }

  if (!response.ok) {
    const errorBody = await readResponseBody(response);
    if (response.status === 403 && isInvalidCsrfErrorBody(errorBody)) {
      notifyUnauthorized(context.url);
      throw new UnauthorizedError(context.url);
    }
    throw new Error(
      `Request failed with status ${response.status} for ${context.init.method ?? 'GET'} ${context.url}: ${errorBody}`,
    );
  }

  return response;
};

const unauthorizedMiddleware: Middleware = {
  post: async (context) => {
    if (context.response.status === 401) {
      notifyUnauthorized(context.url);
      throw new UnauthorizedError(context.url);
    }
    if (context.response.status === 403) {
      const body = await readResponseBody(context.response);
      if (isInvalidCsrfErrorBody(body)) {
        const retryResponse = await retryWithFreshCsrf(context);
        return handleRetryResponse(context, retryResponse);
      }
    }
    return context.response;
  },
};

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
export const filesApi = new FilesApi(config);
export const modelsApi = new ModelsApi(config);
export const conversationsApi = new ConversationsApi(config);
export const userConfigApi = new UserConfigApi(config);
export const authApi = new AuthApi(config);
export const rateApi = new RateApi(config);
export const toolsetsApi = new ToolsetsApi(config);
export const shareApi = new ShareApi(config);
export const publishApi = new PublishApi(config);
export const clientChannelApi = new ClientChannelApi(config);
export const scheduledTasksApi = new ScheduledTasksApi(config);
export const healthApi = new HealthApi(config);
