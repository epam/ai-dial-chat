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
      // Perform API-based authentication
      const authTokens = await debugAuth.authenticate(
        usernames[i],
        process.env.E2E_PASSWORD!,
      );

      // Set environment variables for bucket and other data (store raw JSON to match BucketUtil expectations)
      process.env['BUCKET' + i] = authTokens.bucketJson ?? JSON.stringify({ bucket: authTokens.bucket });
      
      if (i < +config.workers!) {
        // Set additional environment variables for the first worker batch
        process.env.MODELS = authTokens.models ?? '[]';
        process.env.ADDONS = authTokens.addons ?? '[]';
        process.env.THEMES = authTokens.themes ?? '[]';
        process.env.RECENT_ADDONS = authTokens.recentAddons ?? '[]';
        process.env.RECENT_MODELS = authTokens.recentModels ?? '[]';
      }

      // Create storage state for Playwright
      const storageState = DebugAuth.createStorageState(authTokens, baseUrl);
      
      // Save storage state to file
      const fs = require('fs');
      const path = require('path');
      const stateFile = stateFilePath(i);
      
      // Ensure directory exists
      const dir = path.dirname(stateFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(stateFile, JSON.stringify(storageState, null, 2));
      
      console.log(`Debug authentication successful for user ${usernames[i]} (index ${i})`);
      console.log(`Storage state saved to: ${stateFile}`);
      console.log(`Bucket: ${authTokens.bucket}`);
      
    } catch (error) {
      console.error(`Debug authentication failed for user ${usernames[i]}:`, error);
      throw error;
    }
  });
}
