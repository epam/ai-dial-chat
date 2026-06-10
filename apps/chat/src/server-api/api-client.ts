import {
  ApplicationsApi,
  AuthApi,
  Configuration,
  ConversationsApi,
  DeploymentsApi,
  FilesApi,
  Middleware,
  ModelsApi,
  RateApi,
  UserConfigApi,
} from '@epam/chat-api-client';
import {
  UnauthorizedError,
  getCsrfToken,
  notifyUnauthorized,
  setCsrfToken,
} from './base';

const csrfMiddleware: Middleware = {
  pre: async (context) => {
    const token = getCsrfToken();
    if (context.init.method !== 'GET' && token !== null) {
      const headers = new Headers(context.init.headers);
      headers.set('X-CSRF-Token', token);

      return {
        ...context,
        init: {
          ...context.init,
          headers,
        },
      };
    }
    return context;
  },
  post: async (context) => {
    const rotated = context.response.headers.get('x-csrf-token');
    if (rotated) setCsrfToken(rotated);
    return context.response;
  },
};

const unauthorizedMiddleware: Middleware = {
  post: async (context) => {
    if (context.response.status === 401) {
      notifyUnauthorized(context.url);
      throw new UnauthorizedError(context.url);
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
export const deploymentsApi = new DeploymentsApi(config);
export const filesApi = new FilesApi(config);
export const modelsApi = new ModelsApi(config);
export const conversationsApi = new ConversationsApi(config);
export const userConfigApi = new UserConfigApi(config);
export const authApi = new AuthApi(config);
export const rateApi = new RateApi(config);
