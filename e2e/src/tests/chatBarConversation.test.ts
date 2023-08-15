import { OpenAIEntityModelID, OpenAIEntityModels } from '@/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/e2e/src/testData';
import { expect } from '@playwright/test';

test(
  'Chat name equals to the first message\n' +
    'Chat sorting. Today for newly created chat',
  async ({ dialHomePage, conversations, chat }) => {
    await dialHomePage.openHomePage();
    const messageToSend = 'Hi';
    await chat.sendRequest(messageToSend);
    expect
      .soft(
        await conversations.getConversationByName(messageToSend).isVisible(),
        ExpectedMessages.conversationRenamed,
      )
      .toBeTruthy();

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(messageToSend),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();
  },
);

test('Rename chat before starting the conversation', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
}) => {
  const newName = 'new conversation name';
  await dialHomePage.openHomePage();
  await conversations.openConversationDropdownMenu(
    ExpectedConstants.newConversationTitle,
  );
  await conversationDropdownMenu.selectMenuOption(MenuOptions.edit);
  await conversations.editConversationNameWithTick(
    ExpectedConstants.newConversationTitle,
    newName,
  );
  expect
    .soft(
      await conversations.getConversationByName(newName).isVisible(),
      ExpectedMessages.conversationNameUpdated,
    )
    .toBeTruthy();
});

test('Rename chat after starting the conversation', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  conversationData,
  localStorageManager,
}) => {
  const newName = 'new conversation name';
  const conversation = conversationData.prepareDefaultConversation();
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await conversations.openConversationDropdownMenu(conversation.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.edit);
  await conversations.editConversationNameWithEnter(conversation.name, newName);
  expect
    .soft(
      await conversations.getConversationByName(newName).isVisible(),
      ExpectedMessages.conversationNameUpdated,
    )
    .toBeTruthy();
});

test('Menu for New conversation', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
}) => {
  await dialHomePage.openHomePage();
  await conversations.openConversationDropdownMenu(
    ExpectedConstants.newConversationTitle,
  );
  const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
  expect
    .soft(menuOptions, ExpectedMessages.conversationContextOptionsValid)
    .toEqual([
      MenuOptions.edit,
      MenuOptions.compare,
      MenuOptions.export,
      MenuOptions.moveTo,
      MenuOptions.delete,
    ]);
});

test('Menu for conversation with history', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  conversationData,
  localStorageManager,
}) => {
  const conversation = conversationData.prepareDefaultConversation();
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await conversations.openConversationDropdownMenu(conversation.name);
  const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
  expect
    .soft(menuOptions, ExpectedMessages.conversationContextOptionsValid)
    .toEqual(Object.values(MenuOptions));
});

test('Delete chat in the folder', async ({
  dialHomePage,
  folderConversations,
  conversationData,
  localStorageManager,
  conversationDropdownMenu,
}) => {
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations,
  );
  await localStorageManager.setSelectedConversation(
    conversationInFolder.conversations,
  );

  await dialHomePage.openHomePage();
  await folderConversations.expandCollapseFolder(
    conversationInFolder.folders.name,
  );
  await folderConversations.openFolderConversationDropdownMenu(
    conversationInFolder.folders.name,
    conversationInFolder.conversations.name,
  );
  await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
  await folderConversations
    .getFolderConversationInput(conversationInFolder.conversations.name)
    .clickTickButton();
  expect
    .soft(
      await folderConversations.isFolderConversationVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations.name,
      ),
      ExpectedMessages.folderConversationDeleted,
    )
    .toBeFalsy();
});

test('Delete chat located in the root', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  conversationData,
  localStorageManager,
}) => {
  const conversation = conversationData.prepareDefaultConversation();
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await conversations.openConversationDropdownMenu(conversation.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
  await conversations.getConversationInput(conversation.name).clickTickButton();
  expect
    .soft(
      await conversations.getConversationByName(conversation.name).isVisible(),
      ExpectedMessages.conversationDeleted,
    )
    .toBeFalsy();
});

test(
  'Chat sorting. Yesterday\n' +
    'Chat sorting.  Last 7 days when chat with lastActivityDate is the day before yesterday\n' +
    'Chat sorting. Last 30 days when chat with lastActivityDate is the 8th day\n' +
    'Chat sorting. Yesterday chat is moved to Today section after regenerate response\n' +
    'Chat sorting. Last 7 Days chat is moved to Today section after editing already answered message\n' +
    'Chat sorting. Other chat is moved to Today section after sending a message',
  async ({
    dialHomePage,
    conversations,
    chat,
    chatMessages,
    conversationData,
    localStorageManager,
  }) => {
    const yesterdayConversation = conversationData.prepareYesterdayConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
    );
    conversationData = conversationData.resetData();
    const lastWeekConversation = conversationData.prepareLastWeekConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
    );
    conversationData = conversationData.resetData();
    const lastMonthConversation = conversationData.prepareLastMonthConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
    );
    await localStorageManager.setConversationHistory(
      yesterdayConversation,
      lastWeekConversation,
      lastMonthConversation,
    );
    await localStorageManager.setSelectedConversation(yesterdayConversation);

    await dialHomePage.openHomePage();

    const yesterdayConversations =
      await conversations.getYesterdayConversations();
    expect
      .soft(
        yesterdayConversations.includes(yesterdayConversation.name),
        ExpectedMessages.conversationOfYesterday,
      )
      .toBeTruthy();

    const lastWeekConversations =
      await conversations.getLastWeekConversations();
    expect
      .soft(
        lastWeekConversations.includes(lastWeekConversation.name),
        ExpectedMessages.conversationOfLastWeek,
      )
      .toBeTruthy();

    const lastMonthConversations =
      await conversations.getLastMonthConversations();
    expect
      .soft(
        lastMonthConversations.includes(lastMonthConversation.name),
        ExpectedMessages.conversationOfLastMonth,
      )
      .toBeTruthy();

    await chat.regenerateResponse();
    let todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(yesterdayConversation.name),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();

    const messageToEdit = lastWeekConversation.messages[0].content;
    await conversations.selectConversation(lastWeekConversation.name);
    await chatMessages.openEditMessageMode(messageToEdit);
    await chatMessages.editMessage(messageToEdit, 'updated message');
    todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(lastWeekConversation.name),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();

    await conversations.selectConversation(lastMonthConversation.name);
    await chat.sendRequest('one more test message');
    todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(lastMonthConversation.name),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();
  },
);
