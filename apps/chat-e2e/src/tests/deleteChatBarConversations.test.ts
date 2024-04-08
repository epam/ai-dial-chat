import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let gpt35Model: DialAIEntityModel;
dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Delete chat in the folder',
  async ({
    dialHomePage,
    folderConversations,
    conversationData,
    dataInjector,
    conversationDropdownMenu,
    setTestIds,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-607');
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();
    await dataInjector.createConversations(
      conversationInFolder.conversations,
      conversationInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderConversations.expandFolder(conversationInFolder.folders.name);
    await folderConversations.openFolderEntityDropdownMenu(
      conversationInFolder.folders.name,
      conversationInFolder.conversations[0].name,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    await folderConversations
      .getFolderEntity(
        conversationInFolder.folders.name,
        conversationInFolder.conversations[0].name,
      )
      .waitFor({ state: 'hidden' });
  },
);

dialTest(
  'Delete chat located in the root',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    localStorageManager,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-608');
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([conversation]);
    await localStorageManager.setSelectedConversation(conversation);

    await dialHomePage.openHomePage({ iconsToBeLoaded: [gpt35Model.iconUrl] });
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    await conversations
      .getConversationByName(conversation.name)
      .waitFor({ state: 'hidden' });
  },
);

dialTest(
  'Delete all conversations. Cancel',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    folderConversations,
    chatBar,
    confirmationDialog,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-610');
    conversationData.resetData();
    const singleConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();
    await dataInjector.createConversations(
      [singleConversation, ...conversationInFolder.conversations],
      conversationInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chatBar.createNewFolder();
    await folderConversations.expandFolder(conversationInFolder.folders.name);
    await chatBar.deleteAllEntities();
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

    const isFolderVisible = await folderConversations
      .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
      .isVisible();
    expect
      .soft(isFolderVisible, ExpectedMessages.folderNotDeleted)
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
  },
);

dialTest(
  'Delete all conversations. Clear',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    promptData,
    dataInjector,
    folderConversations,
    chatBar,
    confirmationDialog,
    folderPrompts,
    prompts,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-611');
    const singleConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();
    conversationData.resetData();
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    promptData.resetData();
    const singlePrompt = promptData.prepareDefaultPrompt();

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    if (isApiStorageType) {
      await dataInjector.createConversations([
        singleConversation,
        ...conversationInFolder.conversations,
      ]);
      await dataInjector.createPrompts([
        singlePrompt,
        ...promptInFolder.prompts,
      ]);
    } else {
      await dataInjector.updateConversations(
        [singleConversation, ...conversationInFolder.conversations],
        conversationInFolder.folders,
      );
      await dataInjector.updatePrompts(
        [singlePrompt, ...promptInFolder.prompts],
        promptInFolder.folders,
      );
    }

    await dialHomePage.reloadPage();
    await dialHomePage.waitForPageLoaded();
    await promptBar.createNewFolder();
    for (let i = 1; i <= 4; i++) {
      await chatBar.createNewFolder();
    }
    for (let i = 3; i >= 2; i--) {
      await chatBar.dragAndDropEntityToFolder(
        folderConversations.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i),
        ),
        folderConversations.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i - 1),
        ),
      );
    }
    await folderConversations.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(2),
    );

    await folderConversations.expandFolder(conversationInFolder.folders.name);
    await folderPrompts.expandFolder(promptInFolder.folders.name);
    await chatBar.deleteAllEntities();
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

    let i = 2;
    while (i > 0) {
      const isFolderConversationVisible =
        await folderConversations.isFolderEntityVisible(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        );
      expect
        .soft(isFolderConversationVisible, ExpectedMessages.conversationDeleted)
        .toBeFalsy();

      const isFolderVisible = await folderConversations
        .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(4))
        .isVisible();
      expect.soft(isFolderVisible, ExpectedMessages.folderDeleted).toBeFalsy();

      for (let i = 1; i <= 3; i++) {
        const isNestedFolderVisible = await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
          .isVisible();
        expect
          .soft(isNestedFolderVisible, ExpectedMessages.folderDeleted)
          .toBeFalsy();
      }

      const isSingleConversationVisible = await conversations
        .getConversationByName(singleConversation.name)
        .isVisible();
      expect
        .soft(isSingleConversationVisible, ExpectedMessages.conversationDeleted)
        .toBeFalsy();

      await conversations
        .getConversationByName(ExpectedConstants.newConversationTitle)
        .waitFor();

      if (i === 1) {
        await folderPrompts.expandFolder(promptInFolder.folders.name);
      }
      const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
        promptInFolder.folders.name,
        promptInFolder.prompts[0].name,
      );
      expect
        .soft(isFolderPromptVisible, ExpectedMessages.promptNotDeleted)
        .toBeTruthy();

      const isPromptFolderVisible = await folderPrompts
        .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
        .isVisible();
      i === 1
        ? expect
            .soft(isPromptFolderVisible, ExpectedMessages.folderNotDeleted)
            .toBeFalsy()
        : expect
            .soft(isPromptFolderVisible, ExpectedMessages.folderNotDeleted)
            .toBeTruthy();

      const isSinglePromptVisible = await prompts
        .getPromptByName(singlePrompt.name)
        .isVisible();
      expect
        .soft(isSinglePromptVisible, ExpectedMessages.promptNotDeleted)
        .toBeTruthy();

      if (i > 1) {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
      }
      i--;
    }
  },
);
