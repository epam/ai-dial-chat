import { BasePage } from '../ui/pages/basePage';
import { LoginPage } from '../ui/pages/loginPage';

import { Chat } from '../ui/webElements/chat';
import { ChatBar } from '../ui/webElements/chatBar';
import { PromptBar } from '../ui/webElements/promptBar';

import { test as base } from '@playwright/test';

const test = base.extend<{
  basePage: BasePage;
  loginPage: LoginPage;
  chatBar: ChatBar;
  promptBar: PromptBar;
  chat: Chat;
}>({
  basePage: async ({ page }, use) => {
    const basePage = new BasePage(page);
    await use(basePage);
  },
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
  chatBar: async ({ page }, use) => {
    const chatBar = new ChatBar(page);
    await use(chatBar);
  },
  promptBar: async ({ page }, use) => {
    const promptBar = new PromptBar(page);
    await use(promptBar);
  },
  chat: async ({ page }, use) => {
    const chat = new Chat(page);
    await use(chat);
  },
});

export default test;
