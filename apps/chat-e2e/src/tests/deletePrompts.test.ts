import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Delete prompt located in the root',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    setTestIds,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-969');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    expect
      .soft(
        await prompts.getPromptByName(prompt.name).isVisible(),
        ExpectedMessages.promptDeleted,
      )
      .toBeFalsy();
  },
);

dialTest(
  'Delete prompt. Cancel',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    setTestIds,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-970');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.cancelDialog();
    expect
      .soft(
        await prompts.getPromptByName(prompt.name).isVisible(),
        ExpectedMessages.promptNotDeleted,
      )
      .toBeTruthy();
  },
);

dialTest(
  'Clear prompts. Cancel',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    promptData,
    dataInjector,
    folderConversations,
    folderPrompts,
    promptBar,
    confirmationDialog,
    prompts,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-971');
    const singlePrompt = promptData.prepareDefaultPrompt();
    promptData.resetData();
    const promptInFolder = promptData.prepareDefaultPromptInFolder();

    const singleConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();

    await dataInjector.createPrompts(
      [singlePrompt, ...promptInFolder.prompts],
      promptInFolder.folders,
    );
    await dataInjector.createConversations(
      [singleConversation, ...conversationInFolder.conversations],
      conversationInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await promptBar.createNewFolder();
    await folderPrompts.expandFolder(promptInFolder.folders.name);
    await folderConversations.expandFolder(conversationInFolder.folders.name);
    await promptBar.deleteAllEntities();
    await confirmationDialog.cancelDialog();

    const isFolderConversationVisible =
      await folderConversations.isFolderEntityVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations[0].name,
      );
    expect
      .soft(
        isFolderConversationVisible,
        ExpectedMessages.conversationNotDeleted,
      )
      .toBeTruthy();

    const isSingleConversationVisible = await conversations
      .getConversationByName(singleConversation.name)
      .isVisible();
    expect
      .soft(
        isSingleConversationVisible,
        ExpectedMessages.conversationNotDeleted,
      )
      .toBeTruthy();

    const isPromptFolderVisible = await folderPrompts
      .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
      .isVisible();
    expect
      .soft(isPromptFolderVisible, ExpectedMessages.folderNotDeleted)
      .toBeTruthy();

    const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
      promptInFolder.folders.name,
      promptInFolder.prompts[0].name,
    );
    expect
      .soft(isFolderPromptVisible, ExpectedMessages.promptNotDeleted)
      .toBeTruthy();

    const isSinglePromptVisible = await prompts
      .getPromptByName(singlePrompt.name)
      .isVisible();
    expect
      .soft(isSinglePromptVisible, ExpectedMessages.promptNotDeleted)
      .toBeTruthy();
  },
);

dialTest(
  'Clear prompts. Clear',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    promptData,
    dataInjector,
    localStorageManager,
    folderConversations,
    folderPrompts,
    promptBar,
    confirmationDialog,
    prompts,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-972');
    let i = 2;
    const singlePrompt = promptData.prepareDefaultPrompt();
    promptData.resetData();
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    promptData.resetData();
    const singleConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    if (isApiStorageType) {
      await dataInjector.createPrompts([
        singlePrompt,
        ...promptInFolder.prompts,
      ]);
      await dataInjector.createConversations([
        singleConversation,
        ...conversationInFolder.conversations,
      ]);
    } else {
      await dataInjector.updatePrompts(
        [singlePrompt, ...promptInFolder.prompts],
        promptInFolder.folders,
      );
      await dataInjector.updateConversations(
        [singleConversation, ...conversationInFolder.conversations],
        conversationInFolder.folders,
      );
    }
    await localStorageManager.updateSelectedConversation(singleConversation);

    await dialHomePage.reloadPage();
    await dialHomePage.waitForPageLoaded();
    await chatBar.createNewFolder();
    for (let i = 1; i <= 4; i++) {
      await promptBar.createNewFolder();
    }
    for (let i = 3; i >= 2; i--) {
      await promptBar.dragAndDropEntityToFolder(
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i),
        ),
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i - 1),
        ),
      );
    }
    await folderPrompts.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(2),
    );
    await folderPrompts.expandFolder(promptInFolder.folders.name);
    await folderConversations.expandFolder(conversationInFolder.folders.name);
    await conversations
      .getConversationByName(singleConversation.name)
      .waitFor();

    await promptBar.deleteAllEntities();
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

    while (i > 0) {
      if (i === 1) {
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .waitFor({ state: 'hidden' });
        await folderConversations.expandFolder(
          conversationInFolder.folders.name,
        );
      } else {
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .waitFor();
      }
      await folderConversations
        .getFolderEntity(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        )
        .waitFor();
      await conversations
        .getConversationByName(singleConversation.name)
        .waitFor();

      const isPromptFolderVisible = await folderPrompts
        .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(4))
        .isVisible();
      expect
        .soft(isPromptFolderVisible, ExpectedMessages.folderDeleted)
        .toBeFalsy();

      const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
        promptInFolder.folders.name,
        promptInFolder.prompts[0].name,
      );
      expect
        .soft(isFolderPromptVisible, ExpectedMessages.promptDeleted)
        .toBeFalsy();

      const isSinglePromptVisible = await prompts
        .getPromptByName(singlePrompt.name)
        .isVisible();
      expect
        .soft(isSinglePromptVisible, ExpectedMessages.promptDeleted)
        .toBeFalsy();

      for (let i = 1; i <= 3; i++) {
        const isNestedPromptFolderVisible = await folderPrompts
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
          .isVisible();
        expect
          .soft(isNestedPromptFolderVisible, ExpectedMessages.folderDeleted)
          .toBeFalsy();
      }

      if (i > 1) {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
      }
      i--;
    }
  },
);

dialTest(
  `[UI] Delete all prompts button doesn't exist if not prompts are created`,
  async ({ dialHomePage, promptBar, setTestIds }) => {
    setTestIds('EPMRTC-973');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });

    const isDeleteAllPromptVisible =
      await promptBar.deleteEntitiesButton.isVisible();
    expect
      .soft(
        isDeleteAllPromptVisible,
        ExpectedMessages.deleteAllPromptsButtonNotVisible,
      )
      .toBeFalsy();
  },
);
