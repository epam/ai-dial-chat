import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
} from '@epam/ai-dial-chat-hooks';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getExternalService,
  listExternalServices,
  signInExternalService,
  signOutExternalService,
} from '../external-services';

const APP_ID = 'applications/public/dial_scheduler__1.0.0';
const SERVICE_ID = 'dial-native';
const URL = `/api/v1/external-services/${encodeURIComponent(APP_ID)}/${SERVICE_ID}`;

const mockResponse = (body: unknown) => {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('external-service generated client adapter', () => {
  it('lists the services of an application with their OAuth client settings using an encoded application id', async () => {
    const services = [
      {
        id: 'gitlab-oauth',
        displayName: 'GitLab',
        authenticationType: ExternalServiceAuthType.OAuth,
        clientId: 'client',
        authorizationEndpoint: 'https://gitlab.example.com/oauth/authorize',
        scopesSupported: ['read_repository'],
      },
    ];
    const fetchMock = mockResponse(services);

    expect(await listExternalServices(APP_ID)).toEqual(services);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/v1/external-services/${encodeURIComponent(APP_ID)}`,
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('reads DIAL_NATIVE metadata using an encoded application id', async () => {
    const metadata = {
      displayName: 'DIAL',
      authenticationType: ExternalServiceAuthType.DialNative,
    };
    const fetchMock = mockResponse(metadata);

    expect(await getExternalService(APP_ID, SERVICE_ID)).toEqual(metadata);
    expect(fetchMock).toHaveBeenCalledWith(
      URL,
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('preserves a declined offline consent for API-key sign-in', async () => {
    const fetchMock = mockResponse({ success: true });
    const body = {
      credentialsLevel: ExternalServiceCredentialsLevel.User,
      authenticationType: ExternalServiceAuthType.ApiKey,
      apiKey: 'test-key',
      offlineUsageConsent: false,
    } as const;

    expect(await signInExternalService(APP_ID, SERVICE_ID, body)).toEqual({
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${URL}/signin`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  it('sends API-key credential revocation', async () => {
    const fetchMock = mockResponse({ success: true });
    const body = {
      credentialsLevel: ExternalServiceCredentialsLevel.User,
      authenticationType: ExternalServiceAuthType.ApiKey,
    } as const;

    expect(await signOutExternalService(APP_ID, SERVICE_ID, body)).toEqual({
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `${URL}/signout`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });
});
