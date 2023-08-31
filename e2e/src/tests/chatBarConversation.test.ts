import { OpenAIEntityModelID, OpenAIEntityModels } from '@/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/e2e/src/testData';
import { expect } from '@playwright/test';

test.only(
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

test('Rename chat. Cancel', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
}) => {
  const newName = 'new name to cancel';
  await dialHomePage.openHomePage();
  await conversations.openConversationDropdownMenu(
    ExpectedConstants.newConversationTitle,
  );
  await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
  const nameInput = await conversations.openEditConversationNameMode(
    ExpectedConstants.newConversationTitle,
    newName,
  );
  await nameInput.clickCancelButton();
  expect
    .soft(
      await conversations.getConversationByName(newName).isVisible(),
      ExpectedMessages.conversationNameNotUpdated,
    )
    .toBeFalsy();
});

test('Rename chat before starting the conversation', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  chat,
}) => {
  const newName = 'new conversation name';
  await dialHomePage.openHomePage();
  await conversations.openConversationDropdownMenu(
    ExpectedConstants.newConversationTitle,
  );
  await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
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
  await chat.sendRequest('one more test message');
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
  await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
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
      MenuOptions.rename,
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
    .toEqual([
      MenuOptions.rename,
      MenuOptions.compare,
      MenuOptions.replay,
      MenuOptions.export,
      MenuOptions.moveTo,
      MenuOptions.delete,
    ]);
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
    'Chat sorting. Last 7 Days chat is moved to Today section after editing already answered message',
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
      'yesterday',
    );
    conversationData = conversationData.resetData();
    const lastWeekConversation = conversationData.prepareLastWeekConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
      'last week',
    );
    conversationData = conversationData.resetData();
    const lastMonthConversation = conversationData.prepareLastMonthConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
      'last month',
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

test('Chat is moved from the folder via drag&drop', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  conversations,
}) => {
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations,
  );

  await dialHomePage.openHomePage();
  await folderConversations.expandCollapseFolder(
    conversationInFolder.folders.name,
  );
  await folderConversations.dropConversationFromFolder(
    conversationInFolder.folders.name,
    conversationInFolder.conversations.name,
  );
  expect
    .soft(
      await folderConversations.isFolderConversationVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations.name,
      ),
      ExpectedMessages.conversationMovedToFolder,
    )
    .toBeFalsy();

  const todayConversations = await conversations.getTodayConversations();
  expect
    .soft(
      todayConversations.includes(conversationInFolder.conversations.name),
      ExpectedMessages.conversationOfToday,
    )
    .toBeTruthy();
});

test('Chat is moved to folder created from Move to', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  conversationData,
  localStorageManager,
  folderConversations,
}) => {
  const conversation = conversationData.prepareDefaultConversation();
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await conversations.openConversationDropdownMenu(conversation.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.newFolder);

  await folderConversations.expandCollapseFolder(
    ExpectedConstants.newFolderTitle,
  );
  const isFolderConversationVisible =
    await folderConversations.isFolderConversationVisible(
      ExpectedConstants.newFolderTitle,
      conversation.name,
    );
  expect
    .soft(
      isFolderConversationVisible,
      ExpectedMessages.conversationMovedToFolder,
    )
    .toBeTruthy();
});

test('Chat is moved to folder from Move to list', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  conversationData,
  localStorageManager,
  folderConversations,
}) => {
  const folderToMoveIn = conversationData.prepareFolder();
  const conversation = conversationData.prepareDefaultConversation();
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setFolders(folderToMoveIn);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await folderConversations.expandCollapseFolder(folderToMoveIn.name);

  await conversations.openConversationDropdownMenu(conversation.name);
  await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);
  await conversationDropdownMenu.selectMenuOption(folderToMoveIn.name);

  const isFolderConversationVisible =
    await folderConversations.isFolderConversationVisible(
      folderToMoveIn.name,
      conversation.name,
    );
  expect
    .soft(
      isFolderConversationVisible,
      ExpectedMessages.conversationMovedToFolder,
    )
    .toBeTruthy();
});

test('Delete all conversations. Cancel', async ({
  dialHomePage,
  conversations,
  conversationData,
  localStorageManager,
  folderConversations,
  chatBar,
  confirmationDialog,
}) => {
  const emptyFolder = conversationData.prepareFolder();
  conversationData = conversationData.resetData();
  const singleConversation = conversationData.prepareDefaultConversation();
  conversationData = conversationData.resetData();
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setConversationHistory(
    singleConversation,
    conversationInFolder.conversations,
  );
  await localStorageManager.setFolders(
    emptyFolder,
    conversationInFolder.folders,
  );

  await dialHomePage.openHomePage();
  await folderConversations.expandCollapseFolder(
    conversationInFolder.folders.name,
  );
  await chatBar.deleteAllConversations();
  await confirmationDialog.cancelDialog();

  const isFolderConversationVisible =
    await folderConversations.isFolderConversationVisible(
      conversationInFolder.folders.name,
      conversationInFolder.conversations.name,
    );
  expect
    .soft(isFolderConversationVisible, ExpectedMessages.conversationNotDeleted)
    .toBeTruthy();

  const isFolderVisible = await folderConversations
    .getFolderByName(emptyFolder.name)
    .isVisible();
  expect.soft(isFolderVisible, ExpectedMessages.folderNotDeleted).toBeTruthy();

  const isSingleConversationVisible = await conversations
    .getConversationByName(singleConversation.name)
    .isVisible();
  expect
    .soft(isSingleConversationVisible, ExpectedMessages.conversationNotDeleted)
    .toBeTruthy();
});

test('Delete all conversations. Clear', async ({
  dialHomePage,
  conversations,
  conversationData,
  promptData,
  localStorageManager,
  folderConversations,
  chatBar,
  confirmationDialog,
  folderPrompts,
  prompts,
}) => {
  const emptyFolder = conversationData.prepareFolder();
  conversationData = conversationData.resetData();
  const singleConversation = conversationData.prepareDefaultConversation();
  conversationData = conversationData.resetData();
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();

  const emptyPromptFolder = promptData.prepareFolder();
  promptData = promptData.resetData();
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  promptData = await promptData.resetData();
  const singlePrompt = promptData.prepareDefaultPrompt();
  await localStorageManager.setConversationHistory(
    singleConversation,
    conversationInFolder.conversations,
  );
  await localStorageManager.setPrompts(singlePrompt, promptInFolder.prompts);
  await localStorageManager.setFolders(
    emptyFolder,
    conversationInFolder.folders,
    emptyPromptFolder,
    promptInFolder.folders,
  );

  await dialHomePage.openHomePage();
  await folderConversations.expandCollapseFolder(
    conversationInFolder.folders.name,
  );
  await chatBar.deleteAllConversations();
  await confirmationDialog.confirm();

  const isFolderConversationVisible =
    await folderConversations.isFolderConversationVisible(
      conversationInFolder.folders.name,
      conversationInFolder.conversations.name,
    );
  expect
    .soft(isFolderConversationVisible, ExpectedMessages.conversationDeleted)
    .toBeFalsy();

  const isFolderVisible = await folderConversations
    .getFolderByName(emptyFolder.name)
    .isVisible();
  expect.soft(isFolderVisible, ExpectedMessages.folderDeleted).toBeFalsy();

  const isSingleConversationVisible = await conversations
    .getConversationByName(singleConversation.name)
    .isVisible();
  expect
    .soft(isSingleConversationVisible, ExpectedMessages.conversationDeleted)
    .toBeFalsy();

  const isNewConversationVisible = await conversations
    .getConversationByName(ExpectedConstants.newConversationTitle)
    .isVisible();
  expect
    .soft(isNewConversationVisible, ExpectedMessages.newConversationCreated)
    .toBeTruthy();

  await folderPrompts.expandCollapseFolder(promptInFolder.folders.name);
  const isFolderPromptVisible = await folderPrompts.isFolderPromptVisible(
    promptInFolder.folders.name,
    promptInFolder.prompts.name,
  );
  expect
    .soft(isFolderPromptVisible, ExpectedMessages.promptNotDeleted)
    .toBeTruthy();

  const isPromptFolderVisible = await folderPrompts
    .getFolderByName(emptyPromptFolder.name)
    .isVisible();
  expect
    .soft(isPromptFolderVisible, ExpectedMessages.folderNotDeleted)
    .toBeTruthy();

  const isSinglePromptVisible = await prompts
    .getPromptByName(singlePrompt.name)
    .isVisible();
  expect
    .soft(isSinglePromptVisible, ExpectedMessages.promptNotDeleted)
    .toBeTruthy();
});
