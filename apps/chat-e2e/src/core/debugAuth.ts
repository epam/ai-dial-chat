import { APIRequestContext } from '@playwright/test';
import { API } from '@/src/testData';
import he from 'he';

export interface AuthTokens {
  sessionToken: string;
  csrfToken: string;
  bucket: string;
  /**
   * Raw JSON body of the bucket API response.
   * This is used to populate process.env['BUCKET{index}'] exactly as the UI-auth flow does.
   */
  bucketJson?: string;
  models?: string;
  addons?: string;
  themes?: string;
  recentAddons?: string;
  recentModels?: string;
}

export class DebugAuth {
  private request: APIRequestContext;
  private baseUrl: string;

  constructor(request: APIRequestContext, baseUrl: string) {
    this.request = request;
    this.baseUrl = baseUrl;
  }

  /**
   * Performs API-based authentication similar to the performance framework
   * This bypasses UI interaction and directly calls the authentication endpoints
   */
  async authenticate(username: string, password: string): Promise<AuthTokens> {
    try {
      // Step 1: Get the sign-in page and CSRF token
      const { csrfToken, urlCsrfToken } = await this.getSignInPageAndCsrfToken();

      // Step 2: Get Auth0 dynamic parameters by making the /signin/auth0 request
      const dynamicParams = await this.getAuth0DynamicParams(urlCsrfToken);

      // Step 3: Submit user credentials to Auth0
      const authParams = await this.submitUserCredentials(
        username,
        password,
        dynamicParams,
      );

      // Step 4: Finalize authentication and get session token
      const sessionToken = await this.finalizeAuthAndGetSessionToken(authParams);

      // Step 5: Get bucket information
      const { bucket, bucketJson } = await this.getBucket();

      // Step 6: Get additional required data (models, addons, themes)
      const additionalData = await this.getAdditionalData();

      return {
        sessionToken,
        csrfToken,
        bucket,
        bucketJson,
        ...additionalData,
      };
    } catch (error) {
      throw new Error(`Debug authentication failed: ${error}`);
    }
  }

  private async getSignInPageAndCsrfToken(): Promise<{ csrfToken: string; urlCsrfToken: string }> {
    // Reflect performance auth flow: request the sign-in page,
    // then read the CSRF token from the cookie jar (not from headers).
    const response = await this.request.get(`${this.baseUrl}/api/auth/signin`);
    if (response.status() !== 200) {
      throw new Error(`Failed to get sign-in page: ${response.status()}`);
    }

    const storage = await this.request.storageState();
    const csrfCookie = storage.cookies.find((c) => c.name === 'next-auth.csrf-token');
    if (!csrfCookie) {
      throw new Error('CSRF token cookie (next-auth.csrf-token) not available after GET /api/auth/signin');
    }

    const csrfToken = csrfCookie.value;
    const pipeIndex = csrfToken.indexOf('%7C');
    const urlCsrfToken = pipeIndex > -1 ? csrfToken.substring(0, pipeIndex) : csrfToken;

    return { csrfToken, urlCsrfToken };
  }

  private async getAuth0DynamicParams(urlCsrfToken: string): Promise<URLSearchParams> {
    // Step 1: Post to our app's auth0 endpoint to get the redirect to Auth0
    const formData = new URLSearchParams();
    formData.append('csrfToken', urlCsrfToken);
    // Hardcode the callback to the staging URL, which is allowed in Auth0 config.
    // This will generate the correct `redirect_uri` for the subsequent steps.
    formData.append('callbackUrl', 'https://dev-dial-chat.staging.deltixhub.io');

    const redirectResponse = await this.request.post(`${this.baseUrl}/api/auth/signin/auth0`, {
      data: formData.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0, // Do not follow redirects automatically
    });

    if (redirectResponse.status() !== 302) {
      throw new Error(`Expected a 302 redirect from /api/auth/signin/auth0, but got ${redirectResponse.status()}`);
    }

    const location = redirectResponse.headers()['location'];
    if (!location) {
      throw new Error('No Location header found in the redirect response from /api/auth/signin/auth0');
    }

    // Step 2: Follow the redirect by making a GET request to the Auth0 /login URL
    const loginPageResponse = await this.request.get(location);
    if (loginPageResponse.status() !== 200) {
        throw new Error(`Failed to GET the Auth0 login page. Status: ${loginPageResponse.status()}`);
    }

    // The final URL of this request contains the dynamic parameters we need
    const finalUrl = loginPageResponse.url();
    try {
      return new URL(finalUrl).searchParams;
    } catch {
      throw new Error(`Invalid final URL after following redirect: ${finalUrl}`);
    }
  }

  private async submitUserCredentials(
    username: string,
    password: string,
    dynamicParams: URLSearchParams,
  ): Promise<any> {
    // Get auth configuration from environment variables, with fallbacks
    // This mirrors the Java implementation's AuthConfig and SecretsConfig classes
    const authHost = process.env.AUTH_AUTH0_HOST || process.env.AUTH_HOST;
    const clientId = process.env.AUTH_AUTH0_CLIENT_ID || process.env.AUTH_CLIENT_ID;
    const tenant = process.env.AUTH_TENANT || process.env.AUTH0_TENANT;
    const connection = process.env.AUTH_CONNECTION || process.env.AUTH0_CONNECTION;
    const audience = process.env.AUTH_AUTH0_AUDIENCE || process.env.AUTH0_AUDIENCE;
    const intstate = process.env.AUTH0_INTSTATE;

    if (!authHost || !clientId || !tenant || !connection) {
      throw new Error(
        'Missing critical Auth0 configuration. Required environment variables:' +
        ' AUTH_AUTH0_HOST/AUTH_HOST, AUTH_AUTH0_CLIENT_ID/AUTH_CLIENT_ID,' +
        ' AUTH_TENANT/AUTH0_TENANT, AUTH_CONNECTION/AUTH0_CONNECTION'
      );
    }

    const formData = new URLSearchParams();

    // Static params from config - mirrors Java implementation in Authenticate.java
    formData.append('client_id', clientId);
    formData.append('tenant', tenant);
    formData.append('connection', connection);
    if (audience) formData.append('audience', audience);
    if (intstate) formData.append('intstate', intstate);

    // Credentials
    formData.append('password', password);
    formData.append('username', username);
    formData.append('sso', 'true');

    // Dynamic params from previous request (mirroring AuthUtil.java)
    // These are extracted from the dynamicParams which come from the URL
    const redirectUri = dynamicParams.get('redirect_uri') ?? '';
    const correctedRedirectUri = redirectUri.replace('http://localhost:3000', 'https://dev-dial-chat.staging.deltixhub.io');
    formData.append('redirect_uri', correctedRedirectUri);
    formData.append('response_type', dynamicParams.get('response_type') ?? '');
    formData.append('scope', dynamicParams.get('scope') ?? '');
    formData.append('state', dynamicParams.get('state') ?? '');
    formData.append('code_challenge_method', dynamicParams.get('code_challenge_method') ?? '');
    formData.append('code_challenge', dynamicParams.get('code_challenge') ?? '');
    formData.append('protocol', dynamicParams.get('protocol') ?? '');
    // Also add client parameter from Java implementation if present
    const client = dynamicParams.get('client');
    if (client) formData.append('client', client);

    const submissionUrl = `${authHost}/usernamepassword/login`;

    const response = await this.request.post(submissionUrl, {
      data: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.status() !== 200) {
      throw new Error(`Failed to submit credentials: ${response.status()} - ${await response.text()}`);
    }

    const responseText = await response.text();

    // Extract SAML parameters from the response using CSS-selector like approach
    // This mirrors the Java implementation in Authenticate.java which uses CSS selectors
    // Use robust regex patterns that handle various HTML formats including line breaks and whitespace
    // Auth params we need to extract: wa, wresult, wctx
    const waMatch = responseText.match(/name="wa"[\s\S]*?value="([^"]*?)"/);
    const wresultMatch = responseText.match(/name="wresult"[\s\S]*?value="([^"]*?)"/);
    const wctxMatch = responseText.match(/name="wctx"[\s\S]*?value="([^"]*?)"/);

    if (!waMatch || !wresultMatch || !wctxMatch) {
      console.error('Debug - Auth0 response:', responseText);
      throw new Error('Failed to extract SAML parameters from Auth0 response');
    }

    return {
      wa: waMatch[1],
      wresult: wresultMatch[1],
      wctx: he.decode(wctxMatch[1]),
    };
  }

  private async finalizeAuthAndGetSessionToken(authParams: any): Promise<string> {
    const authHost = process.env.AUTH_AUTH0_HOST || process.env.AUTH_HOST;
    if (!authHost) {
      throw new Error('Missing AUTH_AUTH0_HOST or AUTH_HOST environment variable');
    }

    const formData = new URLSearchParams();
    formData.append('wa', authParams.wa);
    formData.append('wresult', authParams.wresult);
    formData.append('wctx', authParams.wctx);

    // Step 1: POST to /login/callback, get redirect to /authorize/resume
    const callbackResponse = await this.request.post(`${authHost}/login/callback`, {
      data: formData.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      maxRedirects: 0,
    });

    if (callbackResponse.status() !== 302) {
      throw new Error(`Expected a 302 from /login/callback, got ${callbackResponse.status()}`);
    }
    const resumeLocation = callbackResponse.headers()['location'];
    if (!resumeLocation) {
      throw new Error('No Location header from /login/callback');
    }
    const resumeUrl = new URL(resumeLocation, authHost).toString();

    // Step 2: GET /authorize/resume, get redirect to /api/auth/callback/auth0
    const resumeResponse = await this.request.get(resumeUrl, { maxRedirects: 0 });

    if (resumeResponse.status() !== 302) {
      throw new Error(`Expected a 302 from /authorize/resume, got ${resumeResponse.status()}`);
    }
    const appCallbackLocation = resumeResponse.headers()['location'];
    if (!appCallbackLocation) {
      throw new Error('No Location header from /authorize/resume');
    }

    // Step 3: GET /api/auth/callback/auth0. This request sets the session cookie and redirects to the home page.
    const appCallbackResponse = await this.request.get(appCallbackLocation, { maxRedirects: 0 });

    if (appCallbackResponse.status() !== 302) {
      throw new Error(`Expected a 302 from /api/auth/callback/auth0, got ${appCallbackResponse.status()}`);
    }

    // The session token is set by the previous request. Now we can retrieve it from the context.
    const storage = await this.request.storageState();
    const sessionCookie = storage.cookies.find(
      (c) => c.name === 'next-auth.session-token' || c.name === '__Secure-next-auth.session-token'
    );

    if (!sessionCookie) {
      throw new Error('Session token cookie not found after final auth callback step.');
    }

    return sessionCookie.value;
  }

  private async getBucket(): Promise<{ bucket: string; bucketJson: string }> {
    const response = await this.request.get(`${this.baseUrl}${API.bucketHost}`);
    if (response.status() !== 200) {
      throw new Error(`Failed to get bucket: ${response.status()}`);
    }

    const bucketJson = await response.text();
    let bucket: string;
    try {
      const parsed = JSON.parse(bucketJson) as { bucket: string };
      bucket = parsed.bucket;
    } catch {
      throw new Error('Bucket response is not valid JSON');
    }
    return { bucket, bucketJson };
  }

  private async getAdditionalData(): Promise<Partial<AuthTokens>> {
    const additionalData: Partial<AuthTokens> = {};

    try {
      // Get models
      const modelsResponse = await this.request.get(`${this.baseUrl}${API.modelsHost}`);
      if (modelsResponse.status() === 200) {
        additionalData.models = await modelsResponse.text();
      }
    } catch (error) {
      console.warn('Failed to get models data:', error);
    }

    try {
      // Get addons
      const addonsResponse = await this.request.get(`${this.baseUrl}${API.addonsHost}`);
      if (addonsResponse.status() === 200) {
        additionalData.addons = await addonsResponse.text();
      }
    } catch (error) {
      console.warn('Failed to get addons data:', error);
    }

    try {
      // Get themes
      const themesResponse = await this.request.get(`${this.baseUrl}${API.themesListingHost}`);
      if (themesResponse.status() === 200) {
        additionalData.themes = await themesResponse.text();
      }
    } catch (error) {
      console.warn('Failed to get themes data:', error);
    }

    return additionalData;
  }

  /**
   * Creates a storage state object that can be used with Playwright's storageState
   */
  static createStorageState(authTokens: AuthTokens, baseUrl: string): any {
    return {
      cookies: [
        {
          name: 'next-auth.session-token',
          value: authTokens.sessionToken,
          domain: new URL(baseUrl).hostname,
          path: '/',
          expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          httpOnly: true,
          secure: baseUrl.startsWith('https'),
          sameSite: 'Lax',
        },
        {
          name: 'next-auth.csrf-token',
          value: authTokens.csrfToken,
          domain: new URL(baseUrl).hostname,
          path: '/',
          expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
          httpOnly: true,
          secure: baseUrl.startsWith('https'),
          sameSite: 'Lax',
        },
      ],
      origins: [
        {
          origin: baseUrl,
          localStorage: [
            {
              name: 'bucket',
              value: authTokens.bucket,
            },
            ...(authTokens.models ? [{ name: 'models', value: authTokens.models }] : []),
            ...(authTokens.addons ? [{ name: 'addons', value: authTokens.addons }] : []),
            ...(authTokens.themes ? [{ name: 'themes', value: authTokens.themes }] : []),
            ...(authTokens.recentAddons ? [{ name: 'recentAddons', value: authTokens.recentAddons }] : []),
            ...(authTokens.recentModels ? [{ name: 'recentModels', value: authTokens.recentModels }] : []),
          ],
        },
      ],
    };
  }
}
