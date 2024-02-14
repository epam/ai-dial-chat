import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FilterMenuOptions,
  FolderConversation,
  FolderPrompt,
  ModelIds,
  TestConversation,
  TestFolder,
  TestPrompt,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest.skip(
  'Filter "Shared by me" shows only shared chats',
  async ({
    dialHomePage,
    conversations,
    folderConversations,
    conversationData,
    dataInjector,
    localStorageManager,
    chatFilter,
    chatBar,
    chatFilterDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1597');
    let nestedFolders: TestFolder[];
    let nestedSharedConversations: TestConversation[];
    let nestedConversations: TestConversation[];
    let folderConversation: FolderConversation;
    let sharedSingleConversation: TestConversation;
    let singleConversation: TestConversation;

    await dialTest.step(
      'Prepare nested folders and single shared and not shared conversations',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(3);
        conversationData.resetData();
        nestedSharedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        nestedSharedConversations.map((c) => (c.isShared = true));
        conversationData.resetData();
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();
        conversationData.resetData();
        folderConversation = conversationData.prepareFolderWithConversations(1);
        conversationData.resetData();
        sharedSingleConversation =
          conversationData.prepareDefaultSharedConversation();
        conversationData.resetData();
        singleConversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations(
          [
            ...nestedSharedConversations,
            ...nestedConversations,
            ...folderConversation.conversations,
            sharedSingleConversation,
            singleConversation,
          ],
          ...nestedFolders,
          folderConversation.folders,
        );
        await localStorageManager.setSelectedConversation(
          sharedSingleConversation,
        );
      },
    );

    await dialTest.step(
      'Open chat panel filter, check "Shared by me" option and verify only shared conversations and parent folders are shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.createNewFolder();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandCollapseFolder(nestedFolder.name, {
            isHttpMethodTriggered: true,
          });
        }
        await folderConversations.expandCollapseFolder(
          ExpectedConstants.newFolderWithIndexTitle(1),
          { isHttpMethodTriggered: true },
        );
        await folderConversations.expandCollapseFolder(
          folderConversation.folders.name,
          { isHttpMethodTriggered: true },
        );
        await chatFilter.openFilterDropdownMenu();
        await chatFilterDropdownMenu.selectMenuOption(
          FilterMenuOptions.sharedByMe,
        );

        const actualFilteredFolderConversations =
          await folderConversations.getFolderEntitiesCount(
            nestedFolders[0].name,
          );
        const actualFilteredConversations =
          await conversations.getTodayConversations();
        expect
          .soft(
            actualFilteredFolderConversations +
              actualFilteredConversations.length,
            ExpectedMessages.conversationsCountIsValid,
          )
          .toBe(nestedSharedConversations.length + 1);

        const actualFilteredFoldersCount =
          await folderConversations.getFoldersCount();
        expect
          .soft(
            actualFilteredFoldersCount,
            ExpectedMessages.foldersCountIsValid,
          )
          .toBe(nestedSharedConversations.length);
      },
    );

    await dialTest.step(
      'Uncheck "Shared by me" option and verify all conversations and folders are shown',
      async () => {
        await chatFilterDropdownMenu.selectMenuOption(
          FilterMenuOptions.sharedByMe,
        );

        let actualFolderConversationsCount =
          await folderConversations.getFolderEntitiesCount(
            nestedFolders[0].name,
          );
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
          .toBe(
            nestedConversations.length + nestedSharedConversations.length + 3,
          );

        const actualFoldersCount = await folderConversations.getFoldersCount();
        expect
          .soft(actualFoldersCount, ExpectedMessages.foldersCountIsValid)
          .toBe(nestedSharedConversations.length + 2);
      },
    );
  },
);

dialTest.skip(
  'Filter "Shared by me" stays checked if to search chats',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    chatFilter,
    chatFilterDropdownMenu,
    chatBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1631');
    const testConversations: TestConversation[] = [];
    const searchTerm = 'test';

    await dialTest.step(
      'Prepare 3 conversations with common name and share two of them',
      async () => {
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
        await dataInjector.createConversations(testConversations);
      },
    );

    await dialTest.step(
      'Open chat panel filter, check "Shared by me" option, set search term and verify only matched shared conversations are shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatFilter.openFilterDropdownMenu();
        await chatFilterDropdownMenu.selectMenuOption(
          FilterMenuOptions.sharedByMe,
        );
        await chatBarSearch.setSearchValue(searchTerm);

        const filteredConversations =
          await conversations.getTodayConversations();
        expect
          .soft(
            filteredConversations.length,
            ExpectedMessages.conversationsCountIsValid,
          )
          .toBe(2);
      },
    );
  },
);

dialTest.skip(
  'Filter "Shared by me" shows only shared prompts',
  async ({
    dialHomePage,
    prompts,
    folderPrompts,
    promptData,
    dataInjector,
    promptFilter,
    promptFilterDropdownMenu,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1635');
    let nestedFolders: TestFolder[];
    let nestedSharedPrompts: TestPrompt[];
    let nestedPrompts: TestPrompt[];
    let folderPrompt: FolderPrompt;
    let sharedSinglePrompt: TestPrompt;
    let singlePrompt: TestPrompt;

    await dialTest.step(
      'Prepare nested folders and single shared and not shared prompts',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(3);
        promptData.resetData();
        nestedSharedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        nestedSharedPrompts.map((p) => (p.isShared = true));
        promptData.resetData();
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();
        folderPrompt = promptData.preparePromptsInFolder(1);
        promptData.resetData();
        sharedSinglePrompt = promptData.prepareDefaultSharedPrompt();
        promptData.resetData();
        singlePrompt = promptData.prepareDefaultPrompt();

        await dataInjector.createPrompts(
          [
            ...nestedSharedPrompts,
            ...nestedPrompts,
            ...folderPrompt.prompts,
            sharedSinglePrompt,
            singlePrompt,
          ],
          ...nestedFolders,
          folderPrompt.folders,
        );
      },
    );

    await dialTest.step(
      'Open prompt panel filter, check "Shared by me" option and verify only shared prompts and parent folders are shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await promptBar.createNewFolder();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandCollapseFolder(nestedFolder.name);
        }
        await folderPrompts.expandCollapseFolder(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await folderPrompts.expandCollapseFolder(folderPrompt.folders.name);
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

        const actualFilteredFoldersCount =
          await folderPrompts.getFoldersCount();
        expect
          .soft(
            actualFilteredFoldersCount,
            ExpectedMessages.foldersCountIsValid,
          )
          .toBe(nestedSharedPrompts.length);
      },
    );

    await dialTest.step(
      'Uncheck "Shared by me" option and verify all prompts and folders are shown',
      async () => {
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
      },
    );
  },
);

dialTest.skip(
  'Filter "Shared by me" stays checked if to search prompts',
  async ({
    dialHomePage,
    prompts,
    promptData,
    dataInjector,
    promptFilter,
    promptFilterDropdownMenu,
    promptBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1636');
    const testPrompts: TestPrompt[] = [];
    const searchTerm = 'test';

    await dialTest.step(
      'Prepare 3 prompts with common name and share two of them',
      async () => {
        for (let i = 1; i <= 3; i++) {
          const prompt = promptData.prepareDefaultPrompt(`${searchTerm}${i}`);
          if (i !== 3) {
            prompt.isShared = true;
          }
          testPrompts.push(prompt);
          promptData.resetData();
        }
        await dataInjector.createPrompts(testPrompts);
      },
    );

    await dialTest.step(
      'Open prompt panel filter, check "Shared by me" option, set search term and verify only matched shared prompts are shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await promptFilter.openFilterDropdownMenu();
        await promptFilterDropdownMenu.selectMenuOption(
          FilterMenuOptions.sharedByMe,
        );
        await promptBarSearch.setSearchValue(searchTerm);

        const filteredPromptsCount = await prompts.getPromptsCount();
        expect
          .soft(filteredPromptsCount, ExpectedMessages.promptsCountIsValid)
          .toBe(2);
      },
    );
  },
);
