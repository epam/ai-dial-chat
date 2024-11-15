import config from '../../config/chat.playwright.config';
import { stateFilePath } from '../core/dialFixtures';

import test from '@/src/core/baseFixtures';
import { API } from '@/src/testData';

//number of users should be equal to number of playwright workers, 2 additional users are required to test sharing feature
const usernames = process.env
  .E2E_USERNAME!.split(',')
  .slice(0, +config.workers! + 2);
//admin user to test publishing feature is required
usernames.push(process.env.E2E_ADMIN!);

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
