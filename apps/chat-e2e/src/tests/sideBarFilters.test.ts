import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  FilterMenuOptions,
  FolderConversation,
  FolderPrompt,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

const nestedLevel = 2;
const searchTerm = 'test';

dialTest(
  'Filter "Shared by me" shows only shared chats.\n' +
    'Filter "Shared by me" stays checked if to search chats',
  async ({
    dialHomePage,
    conversations,
    folderConversations,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    conversationData,
    dataInjector,
    localStorageManager,
    chatFilter,
    chatBar,
    chatFilterDropdownMenu,
    chatBarSearch,
    conversationAssertion,
    chatBarFolderAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1597', 'EPMRTC-1631');
    let nestedFolders: FolderInterface[];
    let nestedSharedConversations: Conversation[];
    let nestedConversations: Conversation[];
    let folderConversation: FolderConversation;
    let sharedSingleConversation: Conversation;
    let singleConversation: Conversation;

    await dialTest.step(
      'Prepare nested folders hierarchy with shared and not shared conversations on each level, not shared conversation in a folder, single shared and not shared conversations',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedLevel);
        nestedSharedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders, {
            1: searchTerm,
            2: GeneratorUtil.randomString(5),
          });
        conversationData.resetData();
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        conversationData.resetData();

        folderConversation =
          conversationData.prepareDefaultConversationInFolder();
        conversationData.resetData();

        sharedSingleConversation =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();
        singleConversation = conversationData.prepareDefaultConversation(
          ModelsUtil.getDefaultModel(),
          searchTerm,
        );
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
        const shareConversationsLink =
          await mainUserShareApiHelper.shareEntityByLink([
            sharedSingleConversation,
            ...nestedSharedConversations,
          ]);
        await additionalUserShareApiHelper.acceptInvite(shareConversationsLink);

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
          await folderConversations.expandFolder(nestedFolder.name);
        }
        await folderConversations.expandFolder(folderConversation.folders.name);
        await chatFilter.openFilterDropdownMenu();
        await chatFilterDropdownMenu.selectOption(FilterMenuOptions.sharedByMe);

        const actualFilteredNestedFolderConversationsCount =
          await folderConversations.getFolderEntitiesCount(
            nestedFolders[0].name,
          );
        const actualFilteredSingleFolderConversationsCount =
          await folderConversations.getFolderEntitiesCount(
            folderConversation.folders.name,
          );
        const actualFilteredConversationsCount =
          await conversations.getEntitiesCount();
        await conversationAssertion.assertEntitiesCount(
          actualFilteredNestedFolderConversationsCount +
            actualFilteredSingleFolderConversationsCount +
            actualFilteredConversationsCount,
          nestedSharedConversations.length + 1,
        );
        await chatBarFolderAssertion.assertFoldersCount(nestedFolders.length);
      },
    );

    await dialTest.step(
      'Type search term in "Search conversations" input and verify only one conversation is displayed',
      async () => {
        await chatBarSearch.setSearchValue(searchTerm);
        const actualFilteredNestedFolderConversationsCount =
          await folderConversations.getFolderEntitiesCount(
            nestedFolders[0].name,
          );
        const actualFilteredSingleFolderConversationsCount =
          await folderConversations.getFolderEntitiesCount(
            folderConversation.folders.name,
          );
        const actualFilteredConversationsCount =
          await conversations.getEntitiesCount();
        await conversationAssertion.assertEntitiesCount(
          actualFilteredNestedFolderConversationsCount +
            actualFilteredSingleFolderConversationsCount +
            actualFilteredConversationsCount,
          1,
        );
        await chatBarFolderAssertion.assertFoldersCount(
          nestedFolders.length - 1,
        );
      },
    );

    await dialTest.step(
      'Uncheck "Shared by me" option and verify all conversations and folders are shown',
      async () => {
        await chatBarSearch.setSearchValue('');
        await chatFilter.openFilterDropdownMenu();
        await chatFilterDropdownMenu.selectOption(FilterMenuOptions.sharedByMe);

        const actualFilteredNestedFolderConversationsCount =
          await folderConversations.getFolderEntitiesCount(
            nestedFolders[0].name,
          );
        const actualFilteredSingleFolderConversationsCount =
          await folderConversations.getFolderEntitiesCount(
            folderConversation.folders.name,
          );
        const actualFilteredConversationsCount =
          await conversations.getEntitiesCount();
        await conversationAssertion.assertEntitiesCount(
          actualFilteredNestedFolderConversationsCount +
            actualFilteredSingleFolderConversationsCount +
            actualFilteredConversationsCount,
          nestedConversations.length +
            nestedSharedConversations.length +
            folderConversation.conversations.length +
            2,
        );
        await chatBarFolderAssertion.assertFoldersCount(
          nestedFolders.length + 2,
        );
      },
    );
  },
);

dialTest(
  'Filter "Shared by me" shows only shared prompts and shared prompt folders.\n' +
    'Filter "Shared by me" stays checked if to search prompts',
  async ({
    dialHomePage,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    prompts,
    folderPrompts,
    promptBarSearch,
    promptData,
    dataInjector,
    promptFilter,
    promptFilterDropdownMenu,
    promptBar,
    promptAssertion,
    promptBarFolderAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1635', 'EPMRTC-1636');
    let nestedFolders: FolderInterface[];
    let nestedSharedPrompts: Prompt[];
    let nestedPrompts: Prompt[];
    let folderPrompt: FolderPrompt;
    let sharedSinglePrompt: Prompt;
    let singlePrompt: Prompt;

    await dialTest.step(
      'Prepare nested folders hierarchy with shared and not shared prompts on each level, not shared prompt in folder, single shared and not shared prompts',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(nestedLevel);
        nestedSharedPrompts = promptData.preparePromptsForNestedFolders(
          nestedFolders,
          { 1: searchTerm, 2: GeneratorUtil.randomString(5) },
        );
        promptData.resetData();
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        promptData.resetData();

        folderPrompt = promptData.prepareDefaultPromptInFolder();
        promptData.resetData();

        sharedSinglePrompt = promptData.prepareDefaultPrompt();
        promptData.resetData();
        singlePrompt = promptData.preparePrompt(searchTerm);

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

        const shareNestedPromptsLink =
          await mainUserShareApiHelper.shareEntityByLink([
            sharedSinglePrompt,
            ...nestedSharedPrompts,
          ]);
        await additionalUserShareApiHelper.acceptInvite(shareNestedPromptsLink);
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
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await folderPrompts.expandFolder(folderPrompt.folders.name);
        await promptFilter.openFilterDropdownMenu();
        await promptFilterDropdownMenu.selectOption(
          FilterMenuOptions.sharedByMe,
        );

        const actualFilteredNestedFolderPromptsCount =
          await folderPrompts.getFolderEntitiesCount(nestedFolders[0].name);
        const actualFilteredSingleFolderPromptsCount =
          await folderPrompts.getFolderEntitiesCount(folderPrompt.folders.name);
        const actualFilteredPromptsCount = await prompts.getEntitiesCount();
        await promptAssertion.assertEntitiesCount(
          actualFilteredNestedFolderPromptsCount +
            actualFilteredSingleFolderPromptsCount +
            actualFilteredPromptsCount,
          nestedSharedPrompts.length + 1,
        );
        await promptBarFolderAssertion.assertFoldersCount(nestedFolders.length);
      },
    );

    await dialTest.step(
      'Type search term in "Search prompt" input and verify only one prompt is displayed',
      async () => {
        await promptBarSearch.setSearchValue(searchTerm);
        const actualFilteredNestedFolderPromptsCount =
          await folderPrompts.getFolderEntitiesCount(nestedFolders[0].name);
        const actualFilteredSingleFolderPromptsCount =
          await folderPrompts.getFolderEntitiesCount(folderPrompt.folders.name);
        const actualFilteredPromptsCount = await prompts.getEntitiesCount();
        await promptAssertion.assertEntitiesCount(
          actualFilteredNestedFolderPromptsCount +
            actualFilteredSingleFolderPromptsCount +
            actualFilteredPromptsCount,
          1,
        );
        await promptBarFolderAssertion.assertFoldersCount(
          nestedFolders.length - 1,
        );
      },
    );

    await dialTest.step(
      'Clear search filed, uncheck "Shared by me" option and verify all prompts and folders are shown',
      async () => {
        await promptBarSearch.setSearchValue('');
        await promptFilter.openFilterDropdownMenu();
        await promptFilterDropdownMenu.selectOption(
          FilterMenuOptions.sharedByMe,
        );
        const actualFilteredNestedFolderPromptsCount =
          await folderPrompts.getFolderEntitiesCount(nestedFolders[0].name);
        const actualFilteredSingleFolderPromptsCount =
          await folderPrompts.getFolderEntitiesCount(folderPrompt.folders.name);
        const actualPromptsCount = await prompts.getEntitiesCount();
        await promptAssertion.assertEntitiesCount(
          actualFilteredNestedFolderPromptsCount +
            actualFilteredSingleFolderPromptsCount +
            actualPromptsCount,
          nestedPrompts.length +
            nestedSharedPrompts.length +
            folderPrompt.prompts.length +
            2,
        );
        await promptBarFolderAssertion.assertFoldersCount(
          nestedFolders.length + 2,
        );
      },
    );
  },
);
