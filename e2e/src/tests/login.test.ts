import test from '../core/fixtures';

import { expect } from '@playwright/test';

test.only('Chat login', async ({
  basePage,
  loginPage,
  chatBar,
  promptBar,
  chat,
}) => {
  await basePage.openHomePage();
  await loginPage.loginToChatBot();
  await chatBar.waitForState();
  await promptBar.waitForState();
  await chat.waitForState();

  expect(await chatBar.isVisible(), 'ChatBar is visible').toBeTruthy();
  expect(await promptBar.isVisible(), 'PromptBar is visible').toBeTruthy();
  expect(await chat.isVisible(), 'Chat is visible').toBeTruthy();
});
