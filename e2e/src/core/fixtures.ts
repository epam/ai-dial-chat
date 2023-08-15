import { LocalStorageManager } from '../core/localStorageManager ';
import { DialHomePage } from '../ui/pages';
import { LoginPage } from '../ui/pages';
import {
  Chat,
  ChatMessages,
  ConversationSettings,
  Conversations,
  EntitySelector,
  RecentEntities,
  SendMessage,
} from '../ui/webElements';
import { ChatBar } from '../ui/webElements';
import { PromptBar } from '../ui/webElements';

import { ConversationData } from '@/e2e/src/testData';
import { Addons } from '@/e2e/src/ui/webElements/addons';
import { AddonsDialog } from '@/e2e/src/ui/webElements/addonsDialog';
import { DropdownMenu } from '@/e2e/src/ui/webElements/dropdownMenu';
import { EntitySettings } from '@/e2e/src/ui/webElements/entitySettings';
import { FolderConversations } from '@/e2e/src/ui/webElements/folderConversations';
import { ModelSelector } from '@/e2e/src/ui/webElements/modelSelector';
import { TemperatureSlider } from '@/e2e/src/ui/webElements/temperatureSlider';
import { test as base } from '@playwright/test';

const test = base.extend<
  {
    dialHomePage: DialHomePage;
    loginPage: LoginPage;
    chatBar: ChatBar;
    promptBar: PromptBar;
    chat: Chat;
    chatMessages: ChatMessages;
    sendMessage: SendMessage;
    conversations: Conversations;
    folderConversations: FolderConversations;
    conversationSettings: ConversationSettings;
    talkToSelector: EntitySelector;
    recentEntities: RecentEntities;
    entitySettings: EntitySettings;
    modelSelector: ModelSelector;
    temperatureSlider: TemperatureSlider;
    addons: Addons;
    addonsDialog: AddonsDialog;
    conversationData: ConversationData;
    localStorageManager: LocalStorageManager;
    conversationDropdownMenu: DropdownMenu;
    folderDropdownMenu: DropdownMenu;
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
  chatMessages: async ({ chat }, use) => {
    const chatMessages = chat.getChatMessages();
    await use(chatMessages);
  },
  sendMessage: async ({ chat }, use) => {
    const sendMessage = chat.getSendMessage();
    await use(sendMessage);
  },
  conversations: async ({ chatBar }, use) => {
    const conversation = chatBar.getConversations();
    await use(conversation);
  },
  folderConversations: async ({ chatBar }, use) => {
    const folderConversations = chatBar.getFolderConversations();
    await use(folderConversations);
  },
  conversationSettings: async ({ chat }, use) => {
    const conversationSettings = chat.getConversationSettings();
    await use(conversationSettings);
  },
  talkToSelector: async ({ conversationSettings }, use) => {
    const talkToSelector = conversationSettings.getTalkToSelector();
    await use(talkToSelector);
  },
  recentEntities: async ({ talkToSelector }, use) => {
    const recentEntities = talkToSelector.getRecentEntities();
    await use(recentEntities);
  },
  entitySettings: async ({ conversationSettings }, use) => {
    const entitySettings = conversationSettings.getEntitySettings();
    await use(entitySettings);
  },
  temperatureSlider: async ({ entitySettings }, use) => {
    const temperatureSlider = entitySettings.getTemperatureSlider();
    await use(temperatureSlider);
  },
  addons: async ({ entitySettings }, use) => {
    const addons = entitySettings.getAddons();
    await use(addons);
  },
  addonsDialog: async ({ addons }, use) => {
    const addonsDialog = addons.getAddonsDialog();
    await use(addonsDialog);
  },
  modelSelector: async ({ entitySettings }, use) => {
    const modelSelector = entitySettings.getModelSelector();
    await use(modelSelector);
  },
  conversationDropdownMenu: async ({ conversations }, use) => {
    const conversationDropdownMenu = conversations.getDropdownMenu();
    await use(conversationDropdownMenu);
  },
  folderDropdownMenu: async ({ folderConversations }, use) => {
    const folderDropdownMenu = folderConversations.getDropdownMenu();
    await use(folderDropdownMenu);
  },
  // eslint-disable-next-line no-empty-pattern
  conversationData: async ({}, use) => {
    const conversationData = new ConversationData();
    await use(conversationData);
  },
  localStorageManager: async ({ page }, use) => {
    const localStorageManager = new LocalStorageManager(page);
    await use(localStorageManager);
  },
});

export default test;
