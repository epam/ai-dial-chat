import config from '../../config/chat.playwright.config';
import { DebugAuth } from '../core/debugAuth';
import { stateFilePath } from '../core/dialFixtures';

import test from '@/src/core/baseFixtures';

// Calculate required users: workers * 3 (main + additional + second additional) + admin
const numWorkers = +config.workers!;
const usernames = process.env.E2E_USERNAME!.split(',').slice(0, numWorkers * 3);

// Add admin user if configured
if (process.env.E2E_ADMIN) {
  usernames.push(process.env.E2E_ADMIN);
}

// Generate authentication tests for each user
usernames.forEach((username, index) => {
  test(`Debug authenticate user: ${username}`, async ({ request }) => {
    const baseUrl = config.use?.baseURL || 'http://localhost:3000';
    const debugAuth = new DebugAuth(request, baseUrl);

    try {
      const authData = await debugAuth.authenticateAndSaveState(
        username,
        process.env.E2E_PASSWORD!,
        stateFilePath(index),
      );

      // Store bucket and related data in environment variables
      process.env[`BUCKET${index}`] =
        authData.bucketJson ?? JSON.stringify({ bucket: authData.bucket });

      // Store additional data for first worker only
      if (index < numWorkers) {
        process.env.MODELS = authData.models ?? '[]';
        process.env.THEMES = authData.themes ?? '[]';
        process.env.RECENT_MODELS = authData.recentModels ?? '[]';
      }
    } catch (error) {
      console.error(`Debug authentication failed for user ${username}:`, error);
      throw error;
    }
  });
});
