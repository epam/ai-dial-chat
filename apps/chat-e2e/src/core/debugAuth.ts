import { APIRequestContext } from '@playwright/test';
import { API } from '@/src/testData';

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
    formData.append('callbackUrl', this.baseUrl);

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
    const authHost = process.env.AUTH_AUTH0_HOST!;
    // Correctly reference the full env var name as loaded from .env files
    const clientId = process.env.AUTH_AUTH0_CLIENT_ID!;
    const tenant = process.env.AUTH_TENANT!;
    const connection = process.env.AUTH_CONNECTION!;
    const audience = process.env.AUTH_AUTH0_AUDIENCE!;
    const intstate = process.env.AUTH0_INTSTATE!;

    console.log('Auth0 Host for submission:', authHost);

    if (!authHost || !clientId) {
      throw new Error('Missing critical Auth0 configuration: AUTH0_HOST and AUTH_AUTH0_CLIENT_ID must be defined in your environment.');
    }

    const formData = new URLSearchParams();

    // Static params from config
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
    formData.append('redirect_uri', dynamicParams.get('redirect_uri') ?? '');
    formData.append('response_type', dynamicParams.get('response_type') ?? '');
    formData.append('scope', dynamicParams.get('scope') ?? '');
    formData.append('state', dynamicParams.get('state') ?? '');
    formData.append('code_challenge_method', dynamicParams.get('code_challenge_method') ?? '');
    formData.append('code_challenge', dynamicParams.get('code_challenge') ?? '');
    formData.append('protocol', dynamicParams.get('protocol') ?? '');

    const submissionUrl = `${authHost}/usernamepassword/login`;
    console.log('Submitting credentials to:', submissionUrl);
    // console.log('Form data:', formData.toString()); // Uncomment for extreme debugging

    const response = await this.request.post(submissionUrl, {
      data: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.status() !== 200) {
      throw new Error(`Failed to submit credentials: ${response.status()}`);
    }

    const responseText = await response.text();

    // Use a robust regex that handles newlines and complex characters inside the value attribute,
    // compatible with older JS targets by using [\s\S] instead of the /s flag.
    const waMatch = responseText.match(/name="wa"\s+value="([^"]*?)"/);
    const wresultMatch = responseText.match(/name="wresult"[\s\S]*?value="([^"]*?)"/);
    const wctxMatch = responseText.match(/name="wctx"\s+value="([^"]*?)"/);

    if (!waMatch || !wresultMatch || !wctxMatch) {
      throw new Error('Failed to extract SAML parameters from Auth0 response');
    }

    return {
      wa: waMatch[1],
      wresult: wresultMatch[1],
      wctx: wctxMatch[1],
    };
  }

  private async finalizeAuthAndGetSessionToken(authParams: any): Promise<string> {
    const authHost = process.env.AUTH_AUTH0_HOST;

    const formData = new URLSearchParams();
    formData.append('wa', authParams.wa);
    formData.append('wresult', authParams.wresult);
    formData.append('wctx', authParams.wctx);

    const response = await this.request.post(`${authHost}/login/callback`, {
      data: formData.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (response.status() !== 302) {
      throw new Error(`Failed to finalize authentication: ${response.status()}`);
    }

    // Reflect performance auth: read the session token from the cookie jar.
    const storage = await this.request.storageState();
    const sessionCookie = storage.cookies.find((c) => c.name === 'next-auth.session-token');
    if (!sessionCookie) {
      throw new Error('Session token cookie (next-auth.session-token) not available after POST /login/callback');
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
