import { BaseApiHelper } from './baseApiHelper';

import { APIRequestContext } from '@playwright/test';
import he from 'he';

interface Auth0Config {
  host: string;
  clientId: string;
  tenant: string;
  connection: string;
  audience?: string;
  intstate?: string;
}

interface Auth0Params {
  wa: string;
  wresult: string;
  wctx: string;
}

export class AuthApiHelper extends BaseApiHelper {
  constructor(request: APIRequestContext) {
    super(request);
  }

  public async getCsrfToken(baseUrl: string): Promise<{
    csrfToken: string;
    urlCsrfToken: string;
  }> {
    const response = await this.request.get(`${baseUrl}/api/auth/signin`);
    if (response.status() !== 200) {
      throw new Error(`Failed to get sign-in page: ${response.status()}`);
    }

    const storage = await this.request.storageState();
    const csrfCookie = storage.cookies.find(
      (c) => c.name === 'next-auth.csrf-token',
    );
    if (!csrfCookie) {
      throw new Error('CSRF token cookie not found after GET /api/auth/signin');
    }

    const csrfToken = csrfCookie.value;
    const pipeIndex = csrfToken.indexOf('%7C');
    const urlCsrfToken =
      pipeIndex > -1 ? csrfToken.substring(0, pipeIndex) : csrfToken;

    return { csrfToken, urlCsrfToken };
  }

  public async getAuth0DynamicParams(
    baseUrl: string,
    urlCsrfToken: string,
  ): Promise<{ urlParams: URLSearchParams; auth0Csrf: string }> {
    // Use callback URL - preserve localhost if AUTH_CALLBACK_URL_OVERRIDE is localhost
    const callbackOverride = process.env.AUTH_CALLBACK_URL_OVERRIDE;
    const callbackUrl =
      callbackOverride && callbackOverride.includes('localhost')
        ? baseUrl
        : (callbackOverride ?? baseUrl);

    const formData = new URLSearchParams({
      csrfToken: urlCsrfToken,
      callbackUrl: callbackUrl,
    });

    const response = await this.request.post(
      `${baseUrl}/api/auth/signin/auth0`,
      {
        data: formData.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
      },
    );

    if (response.status() !== 302) {
      throw new Error(
        `Expected 302 from /api/auth/signin/auth0, got ${response.status()}`,
      );
    }

    const location = response.headers()['location'];
    if (!location) {
      throw new Error(
        'No Location header in redirect from /api/auth/signin/auth0',
      );
    }

    // Follow redirect to get dynamic parameters
    const loginPageResponse = await this.request.get(location);
    if (loginPageResponse.status() !== 200) {
      throw new Error(
        `Failed to GET Auth0 login page: ${loginPageResponse.status()}`,
      );
    }

    // Extract _csrf token from Auth0 login page HTML
    const html = await loginPageResponse.text();
    const csrfMatch = html.match(/name="_csrf"[^>]*value="([^"]+)"/);
    const auth0Csrf = csrfMatch ? csrfMatch[1] : '';

    return {
      urlParams: new URL(loginPageResponse.url()).searchParams,
      auth0Csrf,
    };
  }

  public getAuth0Config(): Auth0Config {
    const host = process.env.AUTH_AUTH0_HOST || process.env.AUTH_HOST;
    const clientId =
      process.env.AUTH_AUTH0_CLIENT_ID || process.env.AUTH_CLIENT_ID;
    const tenant = process.env.AUTH_TENANT || process.env.AUTH0_TENANT;
    const connection =
      process.env.AUTH_CONNECTION || process.env.AUTH0_CONNECTION;

    if (!host || !clientId || !tenant || !connection) {
      throw new Error(
        'Missing Auth0 configuration. Required: AUTH_AUTH0_HOST/AUTH_HOST, ' +
          'AUTH_AUTH0_CLIENT_ID/AUTH_CLIENT_ID, AUTH_TENANT/AUTH0_TENANT, ' +
          'AUTH_CONNECTION/AUTH0_CONNECTION',
      );
    }

    return {
      host,
      clientId,
      tenant,
      connection,
      audience: process.env.AUTH_AUTH0_AUDIENCE || process.env.AUTH0_AUDIENCE,
      intstate: process.env.AUTH0_INTSTATE,
    };
  }

  public async submitCredentials(
    username: string,
    password: string,
    dynamicParams: URLSearchParams,
    auth0Csrf: string,
  ): Promise<Auth0Params> {
    const config = this.getAuth0Config();

    // Get redirect_uri - use AUTH_CALLBACK_URL_OVERRIDE if different from localhost
    const originalRedirectUri = dynamicParams.get('redirect_uri') ?? '';
    const callbackOverride = process.env.AUTH_CALLBACK_URL_OVERRIDE;
    const redirectUri =
      callbackOverride && !callbackOverride.includes('localhost')
        ? originalRedirectUri.replace('http://localhost:3000', callbackOverride)
        : originalRedirectUri;

    // Build JSON payload matching Auth0 Lock format (from HAR analysis)
    const jsonPayload = {
      client_id: config.clientId,
      redirect_uri: redirectUri,
      tenant: config.tenant,
      response_type: dynamicParams.get('response_type') ?? 'code',
      scope:
        dynamicParams.get('scope') ?? 'openid email profile offline_access',
      state: dynamicParams.get('state') ?? '',
      connection: config.connection,
      username,
      password,
      popup_options: {},
      sso: true,
      _intstate: config.intstate ?? 'deprecated',
      _csrf: auth0Csrf,
      audience: config.audience ?? '',
      code_challenge_method:
        dynamicParams.get('code_challenge_method') ?? 'S256',
      code_challenge: dynamicParams.get('code_challenge') ?? '',
      protocol: dynamicParams.get('protocol') ?? 'oauth2',
    };

    // Build auth0-client header (Auth0 Lock library identifier)
    const auth0ClientInfo = {
      name: 'lock.js-ulp',
      version: '13.2.0',
    };
    const auth0ClientHeader = Buffer.from(
      JSON.stringify(auth0ClientInfo),
    ).toString('base64');

    // Submit credentials as JSON (matching browser behavior)
    const response = await this.request.post(
      `${config.host}/usernamepassword/login`,
      {
        data: JSON.stringify(jsonPayload),
        headers: {
          'Content-Type': 'application/json',
          'auth0-client': auth0ClientHeader,
        },
      },
    );

    if (response.status() !== 200) {
      throw new Error(
        `Failed to submit credentials: ${response.status()} - ${await response.text()}`,
      );
    }

    // Extract SAML parameters from response HTML
    const html = await response.text();
    const params = this.extractSamlParams(html);

    return {
      wa: params.wa,
      wresult: params.wresult,
      wctx: he.decode(params.wctx),
    };
  }

  private extractSamlParams(html: string): {
    wa: string;
    wresult: string;
    wctx: string;
  } {
    const patterns = {
      wa: /name="wa"[\s\S]*?value="([^"]*?)"/,
      wresult: /name="wresult"[\s\S]*?value="([^"]*?)"/,
      wctx: /name="wctx"[\s\S]*?value="([^"]*?)"/,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {};
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = html.match(pattern);
      if (!match) {
        throw new Error(`Failed to extract SAML parameter: ${key}`);
      }
      params[key] = match[1];
    }

    return params;
  }

  public async completeAuthFlow(authParams: Auth0Params): Promise<string> {
    const config = this.getAuth0Config();

    const formData = new URLSearchParams({
      wa: authParams.wa,
      wresult: authParams.wresult,
      wctx: authParams.wctx,
    });

    // Step 1: POST to /login/callback -> redirect to /authorize/resume
    const callbackResponse = await this.request.post(
      `${config.host}/login/callback`,
      {
        data: formData.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        maxRedirects: 0,
      },
    );

    const resumeLocation = this.getRedirectLocation(
      callbackResponse,
      '/login/callback',
      302,
    );
    const resumeUrl = new URL(resumeLocation, config.host).toString();

    // Step 2: GET /authorize/resume -> redirect to /api/auth/callback/auth0 or /decision
    const resumeResponse = await this.request.get(resumeUrl, {
      maxRedirects: 0,
    });

    let appCallbackLocation = this.getRedirectLocation(
      resumeResponse,
      '/authorize/resume',
      302,
    );

    // Handle /decision consent redirect (for first-time users or new scopes)
    if (appCallbackLocation.includes('/decision')) {
      const decisionUrl = new URL(appCallbackLocation, config.host);
      const decisionState = decisionUrl.searchParams.get('state') || '';

      // POST consent approval to /decision
      const consentFormData = new URLSearchParams();
      consentFormData.append('state', decisionState);
      consentFormData.append('audience', config.audience || '');
      // Add standard scopes as array notation (scope[]=value)
      ['openid', 'profile', 'email'].forEach((scope) => {
        consentFormData.append('scope[]', scope);
      });

      const consentResponse = await this.request.post(
        `${config.host}/decision`,
        {
          data: consentFormData.toString(),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          maxRedirects: 0,
        },
      );

      if (consentResponse.status() !== 302) {
        throw new Error(
          `Expected 302 from POST /decision, got ${consentResponse.status()}`,
        );
      }

      // POST /decision redirects to /authorize/resume again
      const resumeAfterConsentLocation = this.getRedirectLocation(
        consentResponse,
        'POST /decision',
        302,
      );

      const resumeAfterConsentUrl = new URL(
        resumeAfterConsentLocation,
        config.host,
      ).toString();

      const resumeAfterConsentResponse = await this.request.get(
        resumeAfterConsentUrl,
        { maxRedirects: 0 },
      );

      if (resumeAfterConsentResponse.status() !== 302) {
        throw new Error(
          `Expected 302 from /authorize/resume after consent, got ${resumeAfterConsentResponse.status()}`,
        );
      }

      appCallbackLocation = this.getRedirectLocation(
        resumeAfterConsentResponse,
        '/authorize/resume after consent',
        302,
      );
    }

    // Step 3: GET /api/auth/callback/auth0 -> sets session cookie
    const appCallbackResponse = await this.request.get(appCallbackLocation, {
      maxRedirects: 0,
    });

    if (appCallbackResponse.status() !== 302) {
      throw new Error(
        `Expected 302 from /api/auth/callback/auth0, got ${appCallbackResponse.status()}`,
      );
    }

    // Extract session token from cookies
    const storage = await this.request.storageState();
    const sessionCookie = storage.cookies.find(
      (c) =>
        c.name === 'next-auth.session-token' ||
        c.name === '__Secure-next-auth.session-token',
    );

    if (!sessionCookie) {
      throw new Error('Session token cookie not found after authentication');
    }

    return sessionCookie.value;
  }

  private getRedirectLocation(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response: any,
    endpoint: string,
    expectedStatus: number,
  ): string {
    if (response.status() !== expectedStatus) {
      throw new Error(
        `Expected ${expectedStatus} from ${endpoint}, got ${response.status()}`,
      );
    }

    const location = response.headers()['location'];
    if (!location) {
      throw new Error(`No Location header from ${endpoint}`);
    }

    return location;
  }
}
