import {
  AppConfigApi,
  ApplicationsApi,
  AuthApi,
  Configuration,
  ConversationsApi,
  DeploymentsApi,
  FilesApi,
  Middleware,
  ModelsApi,
  RateApi,
  ToolsetsApi,
  UserConfigApi,
} from '@epam/chat-api-client';
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

const csrfTokenAtDispatch = new WeakMap<RequestInit, string | null>();

const csrfMiddleware: Middleware = {
  pre: async (context) => {
    const token = getCsrfToken();
    if (context.init.method !== 'GET' && token !== null) {
      const headers = new Headers(context.init.headers);
      headers.set('X-CSRF-Token', token);
      const init = {
        ...context.init,
        headers,
      };
      csrfTokenAtDispatch.set(init, token);

      return {
        ...context,
        init,
      };
    }
    csrfTokenAtDispatch.set(context.init, token);
    return context;
  },
  post: async (context) => {
    const rotated = context.response.headers.get('x-csrf-token');
    if (rotated) setCsrfToken(rotated);
    return context.response;
  },
};

const isInvalidCsrfResponse = async (response: Response): Promise<boolean> => {
  if (response.status !== 403) {
    return false;
  }

  try {
    return isInvalidCsrfErrorBody(await response.clone().text());
  } catch {
    return false;
  }
};

const readResponseBody = async (response: Response): Promise<string> => {
  try {
    return await response.clone().text();
  } catch {
    return '';
  }
};

const retryWithFreshCsrf = async (
  context: MiddlewarePostContext,
): Promise<Response | undefined> => {
  const dispatchToken = csrfTokenAtDispatch.get(context.init) ?? null;
  if (getCsrfToken() !== dispatchToken) {
    return undefined;
  }

  const refreshed = await refreshCsrfToken();
  if (refreshed.status === CsrfRefreshStatus.Unauthorized) {
    notifyUnauthorized(ApiEndpoints.AUTH_ME);
    throw new UnauthorizedError(ApiEndpoints.AUTH_ME);
  }
  if (refreshed.status !== CsrfRefreshStatus.Ok) {
    return undefined;
  }

  const headers = new Headers(context.init.headers);
  if (context.init.method !== 'GET') {
    headers.set('X-CSRF-Token', refreshed.token);
  }

  return fetch(context.url, {
    ...context.init,
    headers,
  });
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

  if (await isInvalidCsrfResponse(response)) {
    notifyUnauthorized(context.url);
    throw new UnauthorizedError(context.url);
  }

  if (!response.ok) {
    const errorBody = await readResponseBody(response);
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
    if (await isInvalidCsrfResponse(context.response)) {
      const retryResponse = await retryWithFreshCsrf(context);
      if (retryResponse) {
        return handleRetryResponse(context, retryResponse);
      }
      throw new Error(`CSRF refresh failed for ${context.url}`);
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
