import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/src/testData';
import { DateUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Duplicate chat located in today.\n' +
    'Duplicate chat located in today several times to check postfixes.\n' +
    'Metadata for chat duplicated from yesterday section',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    setTestIds,
    conversationData,
    dataInjector,
    localStorageManager,
    conversationAssertion,
    chatMessagesAssertion,
    informationModalAssertion,
  }) => {
    setTestIds('EPMRTC-3000', 'EPMRTC-3056', 'EPMRTC-6103');
    let conversation: Conversation;
    const firstRequest = 'first request';
    const secondRequest = 'second request';
    const currentDate = DateUtil.getCurrentLocalDate();

    await dialTest.step('Prepare conversation with some history', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests([
        firstRequest,
        secondRequest,
      ]);
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Select Duplicate option from conversation context menu twice and verify conversation with incremented index and equal content is created',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        for (let i = 1; i <= 2; i++) {
          await conversations.openEntityDropdownMenu(conversation.name, {
            exactMatch: true,
            index: i,
          });
          await conversationDropdownMenu.selectMenuOption(
            MenuOptions.duplicate,
            {
              triggeredHttpMethod: 'POST',
            },
          );
          await conversationAssertion.assertEntityState(
            {
              name: ExpectedConstants.entityWithIndexTitle(
                conversation.name,
                i,
              ),
            },
            'visible',
          );
          await chatMessagesAssertion.assertMessagesCount(
            conversation.messages.length,
          );
        }
      },
    );

    await dialTest.step(
      'Select "Info" option for duplicated conversation from dropdown menu and verify modal data',
      async () => {
        await conversations.openEntityDropdownMenu(
          ExpectedConstants.entityWithIndexTitle(conversation.name, 1),
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.info);
        await informationModalAssertion.assertFields({
          createdDate: currentDate,
          lastUpdatedDate: currentDate,
        });
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
    conversationDropdownMenu,
    dataInjector,
    localStorageManager,
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
      await localStorageManager.setChatCollapsedSection(
        CollapsedSections.Organization,
      );
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Select Duplicate option for conversation context menu and verify conversation with incremented index is created inside same folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        await folderConversations.expandFolder(folderConversation.folders.name);
        await folderConversations.selectFolderEntity(
          folderConversation.folders.name,
          folderConversation.conversations[0].name,
        );
        await folderConversations.openFolderEntityDropdownMenu(
          folderConversation.folders.name,
          folderConversation.conversations[0].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.duplicate, {
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
