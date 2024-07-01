import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Duplicate chat located in today.\n' +
    'Duplicate chat located in today several times to check postfixes',
  async ({
    dialHomePage,
    conversations,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    chatMessages,
  }) => {
    setTestIds('EPMRTC-3000', 'EPMRTC-3056');
    let conversation: Conversation;
    const firstRequest = 'first request';
    const secondRequest = 'second request';

    await dialTest.step('Prepare conversation with some history', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        [firstRequest, secondRequest],
      );
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Select Duplicate option from conversation context menu twice and verify conversation with incremented index and equal content is created',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 1; i <= 2; i++) {
          await conversations.openConversationDropdownMenu(
            conversation.name,
            i,
          );
          await conversations.selectEntityMenuOption(MenuOptions.duplicate, {
            triggeredHttpMethod: 'POST',
          });
          await expect
            .soft(
              conversations.getConversationByName(
                ExpectedConstants.entityWithIndexTitle(conversation.name, i),
              ),
              ExpectedMessages.conversationIsVisible,
            )
            .toBeVisible();
          expect
            .soft(
              await chatMessages.chatMessages.getElementsCount(),
              ExpectedMessages.messageCountIsCorrect,
            )
            .toBe(conversation.messages.length);
        }
      },
    );
  },
);

dialTest(
  'Duplicate chat located in folder',
  async ({
    dialHomePage,
    folderConversations,
    setTestIds,
    conversationData,
    conversations,
    localStorageManager,
    dataInjector,
  }) => {
    setTestIds('EPMRTC-3001');
    let folderConversation: FolderConversation;

    await dialTest.step('Prepare conversation inside folder', async () => {
      folderConversation =
        conversationData.prepareDefaultConversationInFolder();
      await dataInjector.createConversations(
        folderConversation.conversations,
        folderConversation.folders,
      );
      await localStorageManager.setSelectedConversation(
        folderConversation.conversations[0],
      );
    });

    await dialTest.step(
      'Select Duplicate option for conversation context menu and verify conversation with incremented index is created inside same folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.openFolderEntityDropdownMenu(
          folderConversation.folders.name,
          folderConversation.conversations[0].name,
        );
        await conversations.selectEntityMenuOption(MenuOptions.duplicate, {
          triggeredHttpMethod: 'POST',
        });
        await expect
          .soft(
            folderConversations.getFolderEntity(
              folderConversation.folders.name,
              ExpectedConstants.entityWithIndexTitle(
                folderConversation.conversations[0].name,
                1,
              ),
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);
