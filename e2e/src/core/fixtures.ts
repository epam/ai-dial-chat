import { DialHomePage } from '../ui/pages';
import { LoginPage } from '../ui/pages';
import { Chat, Conversation, ConversationSettings } from '../ui/webElements';
import { ChatBar } from '../ui/webElements';
import { PromptBar } from '../ui/webElements';

import { test as base } from '@playwright/test';

const test = base.extend<
  {
    dialHomePage: DialHomePage;
    loginPage: LoginPage;
    chatBar: ChatBar;
    promptBar: PromptBar;
    chat: Chat;
    conversation: Conversation;
    conversationSettings: ConversationSettings;
  },
  { workerStorageState: string }
>({
  dialHomePage: async ({ page }, use) => {
    const dialHomePage = new DialHomePage(page);
    await use(dialHomePage);
  },
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },
  chatBar: async ({ dialHomePage }, use) => {
    const chatBar = dialHomePage.getChatBar();
    await use(chatBar);
  },
  promptBar: async ({ dialHomePage }, use) => {
    const promptBar = dialHomePage.getPromptBar();
    await use(promptBar);
  },
  chat: async ({ dialHomePage }, use) => {
    const chat = dialHomePage.getChat();
    await use(chat);
  },
  conversation: async ({ chatBar }, use) => {
    const conversation = chatBar.getConversations();
    await use(conversation);
  },
  conversationSettings: async ({ chat }, use) => {
    const conversationSettings = chat.getConversationSettings();
    await use(conversationSettings);
  },
});

export default test;
