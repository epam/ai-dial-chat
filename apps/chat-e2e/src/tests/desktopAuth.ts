import config from '../../config/chat.playwright.config';
import { stateFilePath } from '../core/dialFixtures';

import test from '@/src/core/baseFixtures';
import { API } from '@/src/testData';

const usernames = process.env
  .E2E_USERNAME!.split(',')
  .slice(0, +config.workers!);

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
