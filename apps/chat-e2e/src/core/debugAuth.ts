import { AuthApiHelper } from '../testData/api/authApiHelper';
import { AuthUtils } from '../utils/authUtils';

import { BucketApiHelper } from '@/src/testData/api/bucketApiHelper';
import { DataApiHelper } from '@/src/testData/api/dataApiHelper';
import { APIRequestContext, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface AuthTokens {
  sessionToken: string;
  csrfToken: string;
  bucket: string;
  bucketJson?: string;
  models?: string;
  themes?: string;
  recentModels?: string;
  appSchemas?: string;
}

export class DebugAuth {
  private bucketAPI: BucketApiHelper;
  private dataAPI: DataApiHelper;
  private authApiHelper: AuthApiHelper;

  constructor(
    private readonly request: APIRequestContext,
    private readonly baseUrl: string,
  ) {
    this.bucketAPI = new BucketApiHelper(request);
    this.dataAPI = new DataApiHelper(request);
    this.authApiHelper = new AuthApiHelper(request);
  }

  /**
   * Performs API-based authentication flow mimicking the performance framework
   */
  async authenticate(username: string, password: string): Promise<AuthTokens> {
    try {
      // Step 1: Get CSRF token
      const { csrfToken, urlCsrfToken } = await this.authApiHelper.getCsrfToken(
        this.baseUrl,
      );

      // Step 2: Get Auth0 dynamic parameters and CSRF token
      const { urlParams: dynamicParams, auth0Csrf } =
        await this.authApiHelper.getAuth0DynamicParams(
          this.baseUrl,
          urlCsrfToken,
        );

      // Step 3: Submit credentials to Auth0
      const authParams = await this.authApiHelper.submitCredentials(
        username,
        password,
        dynamicParams,
        auth0Csrf,
      );

      // Step 4: Complete authentication flow
      const sessionToken =
        await this.authApiHelper.completeAuthFlow(authParams);

      // Step 5: Fetch user data
      const { bucket, bucketJson } = await this.bucketAPI.getBucket();
      const additionalData = await this.dataAPI.fetchAdditionalData();

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

  /**
   * Authenticates and saves the storage state to a file
   */
  async authenticateAndSaveState(
    username: string,
    password: string,
    statePath: string,
  ): Promise<AuthTokens> {
    const authTokens = await this.authenticate(username, password);
    const storageState = AuthUtils.createStorageState(authTokens, this.baseUrl);

    const dir = path.dirname(statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(statePath, JSON.stringify(storageState, null, 2));
    return authTokens;
  }

  /**
   * Authenticates multiple users in parallel and saves their storage states
   */
  static async authenticateAllUsersInParallel(
    userCredentials: {
      username: string;
      password: string;
      statePath: string;
      index: number;
    }[],
    baseUrl: string,
    maxRetries = 3,
  ): Promise<{ index: number; authTokens: AuthTokens }[]> {
    const authPromises = userCredentials.map(
      async ({ username, password, statePath, index }) => {
        let lastError: unknown;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          // Create a fresh request context for each attempt to avoid cookie conflicts
          const requestContext = await request.newContext({
            baseURL: baseUrl,
          });
          const debugAuth = new DebugAuth(requestContext, baseUrl);

          try {
            const authTokens = await debugAuth.authenticateAndSaveState(
              username,
              password,
              statePath,
            );
            await requestContext.dispose();
            return { index, authTokens };
          } catch (error) {
            await requestContext.dispose();
            lastError = error;
            if (attempt < maxRetries) {
              const delayMs = 2000 * attempt;
               
              console.warn(
                `Auth attempt ${attempt}/${maxRetries} failed for ${username}: ${error}. Retrying in ${delayMs}ms...`,
              );
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }
        }

        throw new Error(
          `Authentication failed for user ${username} (index ${index}) after ${maxRetries} attempts: ${lastError}`,
        );
      },
    );

    return Promise.all(authPromises);
  }
}
