import { ToolsetAuthTypes, WithLogin } from '@epam/ai-dial-chat-hooks';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOOLSET_NAME,
  DEFAULT_TOOLSET_VERSION,
  ToolsetTransportType,
} from '../../constants/toolsets';
import type { ToolsetFormData } from '../../models/toolset-form';
import {
  getDefaultToolsetForm,
  getStorageSafeUniqueToolsetName,
  isToolsetAuthValid,
  isToolsetFormValid,
  isValidEndpointUrl,
  normalizeReturnedEndpointUrl,
} from '../toolsets';

const baseForm = (): ToolsetFormData => ({
  name: 'My toolset',
  version: '0.0.1',
  iconUrl: '',
  description: '',
  topics: [],
  otherLocales: [],
  endpoint: 'https://my-toolset.example.com/mcp',
  protocol: ToolsetTransportType.Http,
  allowedTools: [],
  auth: {
    authenticationType: ToolsetAuthTypes.None,
    withLogin: WithLogin.WithoutLogin,
    isLoggedIn: false,
  },
});

describe('getStorageSafeUniqueToolsetName', () => {
  it('returns the default name when no collision exists', () => {
    expect(
      getStorageSafeUniqueToolsetName({
        defaultName: 'New toolset',
        existingNames: ['Other'],
      }),
    ).toBe('New toolset');
  });

  it('appends a numeric suffix when the default name is taken', () => {
    expect(
      getStorageSafeUniqueToolsetName({
        defaultName: 'New toolset',
        existingNames: ['New toolset', 'New toolset 1'],
      }),
    ).toBe('New toolset 2');
  });
});

describe('getDefaultToolsetForm', () => {
  it('returns the default create-mode form state', () => {
    expect(getDefaultToolsetForm()).toEqual({
      name: DEFAULT_TOOLSET_NAME,
      version: DEFAULT_TOOLSET_VERSION,
      iconUrl: '',
      description: '',
      topics: [],
      otherLocales: [],
      endpoint: '',
      protocol: ToolsetTransportType.Http,
      allowedTools: [],
      auth: {
        authenticationType: ToolsetAuthTypes.None,
        withLogin: WithLogin.WithoutLogin,
        isLoggedIn: false,
      },
    });
  });

  it('derives a collision-free name from the existing toolset names', () => {
    const form = getDefaultToolsetForm([
      DEFAULT_TOOLSET_NAME,
      `${DEFAULT_TOOLSET_NAME} 1`,
    ]);
    expect(form.name).toBe(`${DEFAULT_TOOLSET_NAME} 2`);
  });
});

describe('isValidEndpointUrl', () => {
  it('accepts http(s) and sse URLs', () => {
    expect(isValidEndpointUrl('https://example.com/mcp')).toBe(true);
    expect(isValidEndpointUrl('http://example.com')).toBe(true);
    expect(isValidEndpointUrl('sse://example.com/stream')).toBe(true);
  });

  it('rejects an unsupported protocol', () => {
    expect(isValidEndpointUrl('ftp://example.com')).toBe(false);
  });

  it('rejects a URL with a trailing dot or double slash', () => {
    expect(isValidEndpointUrl('https://example.com.')).toBe(false);
    expect(isValidEndpointUrl('https://example.com//')).toBe(false);
  });

  it('rejects an unparseable value', () => {
    expect(isValidEndpointUrl('not a url')).toBe(false);
  });
});

describe('normalizeReturnedEndpointUrl', () => {
  it('repairs a single-slash URL scheme', () => {
    expect(normalizeReturnedEndpointUrl('https:/mcp.example.com')).toBe(
      'https://mcp.example.com',
    );
  });

  it('decodes percent-encoded URLs before repairing them', () => {
    expect(
      normalizeReturnedEndpointUrl('https%3A%2F%2Fmcp.example.com'),
    ).toBe('https://mcp.example.com');
  });

  it('returns the trimmed value unchanged when no repair produces a valid URL', () => {
    expect(normalizeReturnedEndpointUrl('  not a url  ')).toBe('not a url');
  });

  it('returns an already-valid URL unchanged', () => {
    expect(normalizeReturnedEndpointUrl('https://mcp.example.com')).toBe(
      'https://mcp.example.com',
    );
  });

  it('returns an empty string for a missing value', () => {
    expect(normalizeReturnedEndpointUrl(undefined)).toBe('');
  });
});

describe('isToolsetAuthValid', () => {
  it('requires both API key header and value for API-key login', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithLogin,
        isLoggedIn: false,
        keyHeader: 'X-API-Key',
        apiKey: '',
      }),
    ).toBe(false);
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithLogin,
        isLoggedIn: false,
        keyHeader: 'X-API-Key',
        apiKey: 'secret',
      }),
    ).toBe(true);
  });

  it('requires only the API key header for API-key without login', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithoutLogin,
        isLoggedIn: false,
        keyHeader: '',
      }),
    ).toBe(false);
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithoutLogin,
        isLoggedIn: false,
        keyHeader: 'X-API-Key',
        apiKey: '',
      }),
    ).toBe(true);
  });

  it('accepts any auth state once the user is logged in', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.ApiKey,
        withLogin: WithLogin.WithLogin,
        isLoggedIn: true,
        keyHeader: '',
        apiKey: '',
      }),
    ).toBe(true);
  });

  it('rejects invalid OAuth endpoint URLs when configured OAuth is selected, but allows them to be omitted', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }),
    ).toBe(true);
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client-id',
        clientSecret: 'client-secret',
        authorizationEndpoint: 'not a url',
        tokenEndpoint: 'https://auth.example.com/token',
      }),
    ).toBe(false);
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client-id',
        clientSecret: 'client-secret',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
      }),
    ).toBe(true);
  });

  it('requires a client secret for configured OAuth when creating a toolset', () => {
    expect(
      isToolsetAuthValid({
        authenticationType: ToolsetAuthTypes.OAuth,
        withLogin: WithLogin.WithConfig,
        isLoggedIn: false,
        clientId: 'client-id',
        clientSecret: '',
        authorizationEndpoint: 'https://auth.example.com/authorize',
        tokenEndpoint: 'https://auth.example.com/token',
      }),
    ).toBe(false);
  });

  it('does not require a client secret for configured OAuth when editing an existing toolset (the server redacts and preserves it)', () => {
    expect(
      isToolsetAuthValid(
        {
          authenticationType: ToolsetAuthTypes.OAuth,
          withLogin: WithLogin.WithConfig,
          isLoggedIn: false,
          clientId: 'client-id',
          clientSecret: '',
          authorizationEndpoint: 'https://auth.example.com/authorize',
          tokenEndpoint: 'https://auth.example.com/token',
        },
        true,
      ),
    ).toBe(true);
  });
});

describe('isToolsetFormValid', () => {
  it('accepts a complete form with no auth requirements', () => {
    expect(isToolsetFormValid(baseForm())).toBe(true);
  });

  it('requires a name and a valid endpoint URL', () => {
    const form = baseForm();
    form.name = '';
    expect(isToolsetFormValid(form)).toBe(false);

    form.name = 'My toolset';
    form.endpoint = '';
    expect(isToolsetFormValid(form)).toBe(false);

    form.endpoint = 'not a url';
    expect(isToolsetFormValid(form)).toBe(false);
  });

  it('requires API key fields when API-key login is selected', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.ApiKey,
      withLogin: WithLogin.WithLogin,
      isLoggedIn: false,
      keyHeader: 'X-API-Key',
      apiKey: '',
    };

    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.apiKey = 'secret';
    expect(isToolsetFormValid(form)).toBe(true);
  });

  it('requires the API key header when API-key without login is selected', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.ApiKey,
      withLogin: WithLogin.WithoutLogin,
      isLoggedIn: false,
      keyHeader: '',
    };

    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.keyHeader = 'X-API-Key';
    expect(isToolsetFormValid(form)).toBe(true);
  });

  it('requires a client id and secret when configured OAuth is selected, but not the endpoints', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithConfig,
      isLoggedIn: false,
      clientId: 'client-id',
      clientSecret: '',
    };

    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.clientSecret = 'client-secret';
    expect(isToolsetFormValid(form)).toBe(true);

    form.auth.authorizationEndpoint = 'https://auth.example.com/authorize';
    form.auth.tokenEndpoint = 'https://auth.example.com/token';
    expect(isToolsetFormValid(form)).toBe(true);
  });

  it('does not require a client secret for configured OAuth when editing an existing toolset', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithConfig,
      isLoggedIn: false,
      clientId: 'client-id',
      clientSecret: '',
      authorizationEndpoint: 'https://auth.example.com/authorize',
      tokenEndpoint: 'https://auth.example.com/token',
    };

    expect(isToolsetFormValid(form)).toBe(false);
    expect(isToolsetFormValid(form, true)).toBe(true);
  });

  it('requires valid OAuth endpoint URLs when they are provided', () => {
    const form = baseForm();
    form.auth = {
      authenticationType: ToolsetAuthTypes.OAuth,
      withLogin: WithLogin.WithConfig,
      isLoggedIn: false,
      clientId: 'client-id',
      clientSecret: 'client-secret',
      authorizationEndpoint: 'not a url',
      tokenEndpoint: 'https://auth.example.com/token',
    };

    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.authorizationEndpoint = 'https://auth.example.com/authorize';
    form.auth.tokenEndpoint = 'not a url';
    expect(isToolsetFormValid(form)).toBe(false);

    form.auth.tokenEndpoint = 'https://auth.example.com/token';
    expect(isToolsetFormValid(form)).toBe(true);
  });
});
