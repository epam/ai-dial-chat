import config from '../../config/chat.playwright.config';
import { stateFilePath } from '../core/dialFixtures';

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
  test(`Authenticate user: ${usernames[i]}`, async ({
    page,
    providerLogin,
  }, testInfo) => {
    const retrievedResponses = await providerLogin.login(
      testInfo,
      usernames[i],
      process.env.E2E_PASSWORD!,
      i < +config.workers!,
    );
    process.env['BUCKET' + i] = retrievedResponses.get(API.bucketHost);
    await page.context().storageState({ path: stateFilePath(i) });
  });
}
