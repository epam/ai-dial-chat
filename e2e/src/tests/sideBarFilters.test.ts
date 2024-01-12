import { Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { Prompt } from '@/src/types/prompt';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedMessages,
  FilterMenuOptions,
  FolderConversation,
  FolderPrompt,
  ModelIds,
} from '@/e2e/src/testData';
import { expect } from '@playwright/test';

test('Filter "Shared by me" shows only shared chats', async ({
  dialHomePage,
  conversations,
  folderConversations,
  conversationData,
  localStorageManager,
  chatFilter,
  chatFilterDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1597');
  let nestedFolders: FolderInterface[];
  let nestedSharedConversations: Conversation[];
  let nestedConversations: Conversation[];
  let emptyFolder: FolderInterface;
  let folderConversation: FolderConversation;
  let sharedSingleConversation: Conversation;
  let singleConversation: Conversation;

  await test.step('Prepare nested folders and single shared and not shared conversations', async () => {
    nestedFolders = conversationData.prepareNestedFolder(3);
    conversationData.resetData();
    nestedSharedConversations =
      conversationData.prepareConversationsForNestedFolders(nestedFolders);
    nestedSharedConversations.map((c) => (c.isShared = true));
    conversationData.resetData();
    nestedConversations =
      conversationData.prepareConversationsForNestedFolders(nestedFolders);
    conversationData.resetData();
    emptyFolder = conversationData.prepareFolder();
    conversationData.resetData();
    folderConversation = conversationData.prepareFolderWithConversations(1);
    conversationData.resetData();
    sharedSingleConversation =
      conversationData.prepareDefaultSharedConversation();
    conversationData.resetData();
    singleConversation = conversationData.prepareDefaultConversation();

    await localStorageManager.setFolders(
      ...nestedFolders,
      emptyFolder,
      folderConversation.folders,
    );
    await localStorageManager.setOpenedFolders(
      ...nestedFolders,
      emptyFolder,
      folderConversation.folders,
    );
    await localStorageManager.setConversationHistory(
      ...nestedSharedConversations,
      ...nestedConversations,
      ...folderConversation.conversations,
      sharedSingleConversation,
      singleConversation,
    );
    await localStorageManager.setSelectedConversation(sharedSingleConversation);
  });

  await test.step('Open chat panel filter, check "Shared by me" option and verify only shared conversations and parent folders are shown', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatFilter.openFilterDropdownMenu();
    await chatFilterDropdownMenu.selectMenuOption(FilterMenuOptions.sharedByMe);

    const actualFilteredFolderConversations =
      await folderConversations.getFolderEntitiesCount(nestedFolders[0].name);
    const actualFilteredConversations =
      await conversations.getTodayConversations();
    expect
      .soft(
        actualFilteredFolderConversations + actualFilteredConversations.length,
        ExpectedMessages.conversationsCountIsValid,
      )
      .toBe(nestedSharedConversations.length + 1);

    const actualFilteredFoldersCount =
      await folderConversations.getFoldersCount();
    expect
      .soft(actualFilteredFoldersCount, ExpectedMessages.foldersCountIsValid)
      .toBe(nestedSharedConversations.length);
  });

  await test.step('Uncheck "Shared by me" option and verify all conversations and folders are shown', async () => {
    await chatFilterDropdownMenu.selectMenuOption(FilterMenuOptions.sharedByMe);

    let actualFolderConversationsCount =
      await folderConversations.getFolderEntitiesCount(nestedFolders[0].name);
    actualFolderConversationsCount +=
      await folderConversations.getFolderEntitiesCount(
        folderConversation.folders.name,
      );
    const actualConversations = await conversations.getTodayConversations();
    expect
      .soft(
        actualFolderConversationsCount + actualConversations.length,
        ExpectedMessages.conversationsCountIsValid,
      )
      .toBe(nestedConversations.length + nestedSharedConversations.length + 3);

    const actualFoldersCount = await folderConversations.getFoldersCount();
    expect
      .soft(actualFoldersCount, ExpectedMessages.foldersCountIsValid)
      .toBe(nestedSharedConversations.length + 2);
  });
});

test('Filter "Shared by me" stays checked if to search chats', async ({
  dialHomePage,
  conversations,
  conversationData,
  localStorageManager,
  chatFilter,
  chatFilterDropdownMenu,
  chatBarSearch,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1631');
  const testConversations: Conversation[] = [];
  const searchTerm = 'test';

  await test.step('Prepare 3 conversations with common name and share two of them', async () => {
    for (let i = 1; i <= 3; i++) {
      const conversation = conversationData.prepareDefaultConversation(
        ModelIds.GPT_3_5_TURBO,
        `${searchTerm}${i}`,
      );
      if (i !== 3) {
        conversation.isShared = true;
      }
      testConversations.push(conversation);
      conversationData.resetData();
    }
    await localStorageManager.setConversationHistory(...testConversations);
  });

  await test.step('Open chat panel filter, check "Shared by me" option, set search term and verify only matched shared conversations are shown', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await chatFilter.openFilterDropdownMenu();
    await chatFilterDropdownMenu.selectMenuOption(FilterMenuOptions.sharedByMe);
    await chatBarSearch.setSearchValue(searchTerm);

    const filteredConversations = await conversations.getTodayConversations();
    expect
      .soft(
        filteredConversations.length,
        ExpectedMessages.conversationsCountIsValid,
      )
      .toBe(2);
  });
});

test('Filter "Shared by me" shows only shared prompts', async ({
  dialHomePage,
  prompts,
  folderPrompts,
  promptData,
  localStorageManager,
  promptFilter,
  promptFilterDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1635');
  let nestedFolders: FolderInterface[];
  let nestedSharedPrompts: Prompt[];
  let nestedPrompts: Prompt[];
  let emptyFolder: FolderInterface;
  let folderPrompt: FolderPrompt;
  let sharedSinglePrompt: Prompt;
  let singlePrompt: Prompt;

  await test.step('Prepare nested folders and single shared and not shared prompts', async () => {
    nestedFolders = promptData.prepareNestedFolder(3);
    promptData.resetData();
    nestedSharedPrompts =
      promptData.preparePromptsForNestedFolders(nestedFolders);
    nestedSharedPrompts.map((p) => (p.isShared = true));
    promptData.resetData();
    nestedPrompts = promptData.preparePromptsForNestedFolders(nestedFolders);
    promptData.resetData();
    emptyFolder = promptData.prepareFolder();
    promptData.resetData();
    folderPrompt = promptData.preparePromptsInFolder(1);
    promptData.resetData();
    sharedSinglePrompt = promptData.prepareDefaultSharedPrompt();
    promptData.resetData();
    singlePrompt = promptData.prepareDefaultPrompt();

    await localStorageManager.setFolders(
      ...nestedFolders,
      emptyFolder,
      folderPrompt.folders,
    );
    await localStorageManager.setOpenedFolders(
      ...nestedFolders,
      emptyFolder,
      folderPrompt.folders,
    );
    await localStorageManager.setPrompts(
      ...nestedSharedPrompts,
      ...nestedPrompts,
      ...folderPrompt.prompts,
      sharedSinglePrompt,
      singlePrompt,
    );
  });

  await test.step('Open prompt panel filter, check "Shared by me" option and verify only shared prompts and parent folders are shown', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await promptFilter.openFilterDropdownMenu();
    await promptFilterDropdownMenu.selectMenuOption(
      FilterMenuOptions.sharedByMe,
    );

    const actualFilteredNestedFolderPromptsCount =
      await folderPrompts.getFolderEntitiesCount(nestedFolders[0].name);
    const actualFilteredSingleFolderPromptsCount =
      await folderPrompts.getFolderEntitiesCount(folderPrompt.folders.name);
    const actualFilteredPromptsCount = await prompts.getPromptsCount();
    expect
      .soft(
        actualFilteredNestedFolderPromptsCount +
          actualFilteredSingleFolderPromptsCount +
          actualFilteredPromptsCount,
        ExpectedMessages.promptsCountIsValid,
      )
      .toBe(nestedSharedPrompts.length + 1);

    const actualFilteredFoldersCount = await folderPrompts.getFoldersCount();
    expect
      .soft(actualFilteredFoldersCount, ExpectedMessages.foldersCountIsValid)
      .toBe(nestedSharedPrompts.length);
  });

  await test.step('Uncheck "Shared by me" option and verify all prompts and folders are shown', async () => {
    await promptFilterDropdownMenu.selectMenuOption(
      FilterMenuOptions.sharedByMe,
    );
    const actualFilteredNestedFolderPromptsCount =
      await folderPrompts.getFolderEntitiesCount(nestedFolders[0].name);
    const actualFilteredSingleFolderPromptsCount =
      await folderPrompts.getFolderEntitiesCount(folderPrompt.folders.name);
    const actualPromptsCount = await prompts.getPromptsCount();
    expect
      .soft(
        actualFilteredNestedFolderPromptsCount +
          actualFilteredSingleFolderPromptsCount +
          actualPromptsCount,
        ExpectedMessages.promptsCountIsValid,
      )
      .toBe(nestedPrompts.length + nestedSharedPrompts.length + 3);

    const actualFoldersCount = await folderPrompts.getFoldersCount();
    expect
      .soft(actualFoldersCount, ExpectedMessages.foldersCountIsValid)
      .toBe(nestedSharedPrompts.length + 2);
  });
});

test('Filter "Shared by me" stays checked if to search prompts', async ({
  dialHomePage,
  prompts,
  promptData,
  localStorageManager,
  promptFilter,
  promptFilterDropdownMenu,
  promptBarSearch,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1636');
  const testPrompts: Prompt[] = [];
  const searchTerm = 'test';

  await test.step('Prepare 3 prompts with common name and share two of them', async () => {
    for (let i = 1; i <= 3; i++) {
      const prompt = promptData.prepareDefaultPrompt(`${searchTerm}${i}`);
      if (i !== 3) {
        prompt.isShared = true;
      }
      testPrompts.push(prompt);
      promptData.resetData();
    }
    await localStorageManager.setPrompts(...testPrompts);
  });

  await test.step('Open prompt panel filter, check "Shared by me" option, set search term and verify only matched shared prompts are shown', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await promptFilter.openFilterDropdownMenu();
    await promptFilterDropdownMenu.selectMenuOption(
      FilterMenuOptions.sharedByMe,
    );
    await promptBarSearch.setSearchValue(searchTerm);

    const filteredPromptsCount = await prompts.getPromptsCount();
    expect
      .soft(filteredPromptsCount, ExpectedMessages.promptsCountIsValid)
      .toBe(2);
  });
});
