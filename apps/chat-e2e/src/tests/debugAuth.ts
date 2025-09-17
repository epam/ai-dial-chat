import config from '../../config/chat.playwright.config';
import { stateFilePath } from '../core/dialFixtures';
import { DebugAuth } from '../core/debugAuth';

import test from '@/src/core/baseFixtures';
import { API } from '@/src/testData';

// Number of users needed: numWorkers * 3 (main + additional + second additional) + 1 (admin)
const usernames = process.env
  .E2E_USERNAME!.split(',')
  .slice(0, +config.workers! * 3);

//admin user to test publishing feature is required
if (process.env.E2E_ADMIN) {
  usernames.push(process.env.E2E_ADMIN);
}

// Main User: stateFilePath(testInfo.parallelIndex)
// Additional User: stateFilePath(testInfo.parallelIndex + numWorkers)
// Second Additional User: stateFilePath(testInfo.parallelIndex + 2 * numWorkers)
// Admin User: stateFilePath(3 * numWorkers) (assuming admin is always the last user)
for (let i = 0; i < usernames.length; i++) {
  test(`Debug authenticate user: ${usernames[i]}`, async ({
    request,
  }, testInfo) => {
    const baseUrl = config.use?.baseURL || 'http://localhost:3000';
    const debugAuth = new DebugAuth(request, baseUrl);
    try {
      const { bucket, bucketJson, models, addons, themes, recentAddons, recentModels } =
        await debugAuth.authenticateAndSaveState(
          usernames[i],
          process.env.E2E_PASSWORD!,
          stateFilePath(i),
        );

      // Set environment variables for bucket and other data
      process.env[`BUCKET${i}`] = bucketJson ?? JSON.stringify({ bucket });
      if (i < +config.workers!) {
        process.env.MODELS = models ?? '[]';
        process.env.ADDONS = addons ?? '[]';
        process.env.THEMES = themes ?? '[]';
        process.env.RECENT_ADDONS = recentAddons ?? '[]';
        process.env.RECENT_MODELS = recentModels ?? '[]';
      }

      console.log(`Debug authentication successful for user ${usernames[i]} (index ${i})`);
      console.log(`Storage state saved to: ${stateFilePath(i)}`);
      console.log(`Bucket: ${bucket}`);
    } catch (error) {
      console.error(`Debug authentication failed for user ${usernames[i]}:`, error);
      throw error;
    }
  });
}
