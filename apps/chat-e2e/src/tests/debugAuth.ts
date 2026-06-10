import config from '../../config/chat.playwright.config';
import { DebugAuth } from '../core/debugAuth';
import { stateFilePath } from '../core/dialFixtures';
import { writeModelsFile } from '../core/testPaths';

import test from '@/src/core/baseFixtures';

// Calculate required users: workers * 3 (main + additional + second additional) + admin
const numWorkers = +config.workers!;
const usernames = process.env.E2E_USERNAME!.split(',').slice(0, numWorkers * 3);

// Add admin user if configured
if (process.env.E2E_ADMIN) {
  usernames.push(process.env.E2E_ADMIN);
}

// Authenticate all users in parallel
test('Debug authenticate all users in parallel', async () => {
  const baseUrl = config.use?.baseURL || 'http://localhost:3000';

  // Prepare user credentials for parallel authentication
  const userCredentials = usernames.map((username, index) => ({
    username,
    password: process.env.E2E_PASSWORD!,
    statePath: stateFilePath(index),
    index,
  }));

  try {
    // Authenticate all users in parallel
    const results = await DebugAuth.authenticateAllUsersInParallel(
      userCredentials,
      baseUrl,
    );

    // Process results and set environment variables
    results.forEach(({ index, authTokens }) => {
      const username = usernames[index];
      // eslint-disable-next-line no-console
      console.log(`Debug authentication was successful for: ${username}`);

      // Store bucket and related data in environment variables
      process.env[`BUCKET${index}`] =
        authTokens.bucketJson ?? JSON.stringify({ bucket: authTokens.bucket });

      // Store additional data for first worker only
      if (index < numWorkers) {
        writeModelsFile(authTokens.models ?? '[]');
        process.env.THEMES = authTokens.themes ?? '[]';
        process.env.APP_SCHEMAS = authTokens.appSchemas ?? '[]';
        process.env.RECENT_MODELS = authTokens.recentModels ?? '[]';
      }
    });
  } catch (error) {
    console.error('Parallel authentication failed:', error);
    throw error;
  }
});
