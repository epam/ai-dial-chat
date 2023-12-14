import { ModelsUtil } from '@/e2e/src/utils/modelsUtil';

import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  Chronology,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
} from '@/e2e/src/testData';
import { Colors } from '@/e2e/src/ui/domData';
import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let gpt35Model: OpenAIEntityModel;
let gpt4Model: OpenAIEntityModel;
let bisonModel: OpenAIEntityModel;

test.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bisonModel = ModelsUtil.getModel(ModelIds.BISON_001)!;
});

test(
  'Chat name equals to the first message\n' +
    'Chat sorting. Today for newly created chat',
  async ({ dialHomePage, conversations, chat, setTestIds }) => {
    setTestIds('EPMRTC-583', 'EPMRTC-776');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    const messageToSend = 'Hi';
    await chat.sendRequestWithButton(messageToSend);
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-588');
  const newName = 'new name to cancel';
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-584');
  const newName = 'new conversation name';
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
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

  await chat.sendRequestWithButton('one more test message');
  expect
    .soft(
      await conversations.getConversationByName(newName).isVisible(),
      ExpectedMessages.conversationNameUpdated,
    )
    .toBeTruthy();
});

test(
  'Rename chat after starting the conversation.\n' +
    'Long Chat name is cut in chat header. Named manually.\n' +
    'Tooltip shows full long chat name in chat header. Named manually',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    localStorageManager,
    chatHeader,
    tooltip,
    setTestIds,
    errorPopup,
  }) => {
    setTestIds('EPMRTC-585', 'EPMRTC-821', 'EPMRTC-822');
    const newName = GeneratorUtil.randomString(60);
    const conversation = conversationData.prepareDefaultConversation();
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
    await conversations.editConversationNameWithEnter(
      conversation.name,
      newName,
    );
    expect
      .soft(
        await conversations.getConversationByName(newName).isVisible(),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeTruthy();

    const isChatHeaderTitleTruncated =
      await chatHeader.chatTitle.isElementWidthTruncated();
    expect
      .soft(
        isChatHeaderTitleTruncated,
        ExpectedMessages.chatHeaderTitleTruncated,
      )
      .toBeTruthy();
    await errorPopup.cancelPopup();
    await chatHeader.chatTitle.hoverOver();
    const tooltipChatHeaderTitle = await tooltip.getContent();
    expect
      .soft(
        tooltipChatHeaderTitle,
        ExpectedMessages.headerTitleCorrespondRequest,
      )
      .toBe(newName);
  },
);

test('Menu for New conversation', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-594');
  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
  await conversations.openConversationDropdownMenu(
    ExpectedConstants.newConversationTitle,
  );
  const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
  expect
    .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
    .toEqual([
      MenuOptions.rename,
      MenuOptions.compare,
      MenuOptions.export,
      MenuOptions.moveTo,
      MenuOptions.share,
      MenuOptions.publish,
      MenuOptions.delete,
    ]);
});

test(
  'Menu for conversation with history.\n' +
    'Special characters are allowed in chat name',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-595', 'EPMRTC-1276');
    const conversation = conversationData.prepareDefaultConversation(
      gpt35Model,
      '!@#$%^&()_{}[]:;"\',./<>?/-`~',
    );
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.getConversationByName(conversation.name).waitFor();
    await conversations.openConversationDropdownMenu(conversation.name);
    const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual([
        MenuOptions.rename,
        MenuOptions.compare,
        MenuOptions.replay,
        MenuOptions.playback,
        MenuOptions.export,
        MenuOptions.moveTo,
        MenuOptions.share,
        MenuOptions.publish,
        MenuOptions.delete,
      ]);
  },
);

test('Delete chat in the folder', async ({
  dialHomePage,
  folderConversations,
  conversationData,
  localStorageManager,
  conversationDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-607');
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations[0],
  );
  await localStorageManager.setSelectedConversation(
    conversationInFolder.conversations[0],
  );

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.expandCollapseFolder(
    conversationInFolder.folders.name,
  );
  await folderConversations.openFolderConversationDropdownMenu(
    conversationInFolder.folders.name,
    conversationInFolder.conversations[0].name,
  );
  await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
  await folderConversations
    .getFolderConversationInput(conversationInFolder.conversations[0].name)
    .clickTickButton();
  expect
    .soft(
      await folderConversations.isFolderConversationVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations[0].name,
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-608');
  const conversation = conversationData.prepareDefaultConversation();
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
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
  'Chat sorting. Yesterday.\n' +
    'Chat sorting. Last 7 days when chat with lastActivityDate is the day before yesterday.\n' +
    'Chat sorting. Last 30 days when chat with lastActivityDate is the 8th day.\n' +
    'Chat sorting. Yesterday chat is moved to Today section after regenerate response.\n' +
    'Chat sorting. Last 7 Days chat is moved to Today section after editing already answered message',
  async ({
    dialHomePage,
    conversations,
    chat,
    chatMessages,
    conversationData,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-775',
      'EPMRTC-796',
      'EPMRTC-798',
      'EPMRTC-777',
      'EPMRTC-780',
    );
    const yesterdayConversation = conversationData.prepareYesterdayConversation(
      gpt35Model,
      'yesterday',
    );
    conversationData.resetData();
    const lastWeekConversation = conversationData.prepareLastWeekConversation(
      gpt35Model,
      'last week',
    );
    conversationData.resetData();
    const lastMonthConversation = conversationData.prepareLastMonthConversation(
      gpt35Model,
      'last month',
    );
    await localStorageManager.setConversationHistory(
      yesterdayConversation,
      lastWeekConversation,
      lastMonthConversation,
    );
    await localStorageManager.setSelectedConversation(yesterdayConversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
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
      .soft(todayConversations.length, ExpectedMessages.conversationOfToday)
      .toBe(1);

    const messageToEdit = lastWeekConversation.messages[0].content;
    await conversations.selectConversation(lastWeekConversation.name);
    await chatMessages.openEditMessageMode(messageToEdit);
    await chatMessages.editMessage(messageToEdit, 'updated message');
    todayConversations = await conversations.getTodayConversations();
    expect
      .soft(todayConversations.length, ExpectedMessages.conversationOfToday)
      .toBe(2);

    await conversations.selectConversation(lastMonthConversation.name);
    await chat.sendRequestWithButton('one more test message');
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
  chatBar,
  page,
  setTestIds,
}) => {
  setTestIds('EPMRTC-861');
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setFolders(conversationInFolder.folders);
  await localStorageManager.setConversationHistory(
    conversationInFolder.conversations[0],
  );
  await localStorageManager.setOpenedFolders(conversationInFolder.folders);
  await localStorageManager.setSelectedConversation(
    conversationInFolder.conversations[0],
  );
  await dialHomePage.openHomePage({
    iconsToBeLoaded: [gpt35Model.iconUrl],
  });
  await dialHomePage.waitForPageLoaded();
  await folderConversations.drugConversationFromFolder(
    conversationInFolder.folders.name,
    conversationInFolder.conversations[0].name,
  );
  const draggableAreaColor = await chatBar.getDraggableAreaColor();
  expect
    .soft(draggableAreaColor[0], ExpectedMessages.draggableAreaColorIsValid)
    .toBe(Colors.highlightedDraggableArea);
  await page.mouse.up();

  expect
    .soft(
      await folderConversations.isFolderConversationVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations[0].name,
      ),
      ExpectedMessages.conversationMovedToFolder,
    )
    .toBeFalsy();

  const todayConversations = await conversations.getTodayConversations();
  expect
    .soft(
      todayConversations.includes(conversationInFolder.conversations[0].name),
      ExpectedMessages.conversationOfToday,
    )
    .toBeTruthy();

  const folderNameColor = await folderConversations.getFolderNameColor(
    conversationInFolder.folders.name,
  );
  expect
    .soft(folderNameColor[0], ExpectedMessages.folderNameColorIsValid)
    .toBe(Colors.notHighlightedFolderName);
});

test('Chat is moved to folder created from Move to', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  conversationData,
  localStorageManager,
  folderConversations,
  setTestIds,
}) => {
  setTestIds('EPMRTC-864');
  const conversation = conversationData.prepareDefaultConversation();
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
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

  const folderNameColor = await folderConversations.getFolderNameColor(
    ExpectedConstants.newFolderTitle,
  );
  expect
    .soft(folderNameColor[0], ExpectedMessages.folderNameColorIsValid)
    .toBe(Colors.highlightedFolderName);
});

test('Chat is moved to folder from Move to list', async ({
  dialHomePage,
  conversations,
  conversationDropdownMenu,
  conversationData,
  localStorageManager,
  folderConversations,
  setTestIds,
}) => {
  setTestIds('EPMRTC-863');
  const folderToMoveIn = conversationData.prepareFolder();
  const conversation = conversationData.prepareDefaultConversation();
  await localStorageManager.setConversationHistory(conversation);
  await localStorageManager.setFolders(folderToMoveIn);
  await localStorageManager.setSelectedConversation(conversation);

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-610');
  const emptyFolder = conversationData.prepareFolder();
  conversationData.resetData();
  const singleConversation = conversationData.prepareDefaultConversation();
  conversationData.resetData();
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  await localStorageManager.setConversationHistory(
    singleConversation,
    conversationInFolder.conversations[0],
  );
  await localStorageManager.setFolders(
    emptyFolder,
    conversationInFolder.folders,
  );

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await folderConversations.expandCollapseFolder(
    conversationInFolder.folders.name,
  );
  await chatBar.deleteAllConversations();
  await confirmationDialog.cancelDialog();

  const isFolderConversationVisible =
    await folderConversations.isFolderConversationVisible(
      conversationInFolder.folders.name,
      conversationInFolder.conversations[0].name,
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
  setTestIds,
}) => {
  setTestIds('EPMRTC-611');
  const emptyFolder = conversationData.prepareFolder();
  conversationData.resetData();
  const singleConversation = conversationData.prepareDefaultConversation();
  conversationData.resetData();
  const conversationInFolder =
    conversationData.prepareDefaultConversationInFolder();
  conversationData.resetData();
  const nestedFolders = conversationData.prepareNestedFolder(3);

  const emptyPromptFolder = promptData.prepareFolder();
  promptData.resetData();
  const promptInFolder = promptData.prepareDefaultPromptInFolder();
  promptData.resetData();
  const singlePrompt = promptData.prepareDefaultPrompt();

  await dialHomePage.openHomePage();
  await dialHomePage.waitForPageLoaded();
  await localStorageManager.updateConversationHistory(
    singleConversation,
    conversationInFolder.conversations[0],
  );
  await localStorageManager.updatePrompts(
    singlePrompt,
    promptInFolder.prompts[0],
  );
  await localStorageManager.updateFolders(
    emptyFolder,
    conversationInFolder.folders,
    emptyPromptFolder,
    promptInFolder.folders,
    ...nestedFolders,
  );
  await localStorageManager.updateOpenedFolders(
    conversationInFolder.folders,
    promptInFolder.folders,
    ...nestedFolders,
  );

  await dialHomePage.reloadPage();
  await dialHomePage.waitForPageLoaded();
  await chatBar.deleteAllConversations();
  await confirmationDialog.confirm();

  let i = 2;
  while (i > 0) {
    const isFolderConversationVisible =
      await folderConversations.isFolderConversationVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations[0].name,
      );
    expect
      .soft(isFolderConversationVisible, ExpectedMessages.conversationDeleted)
      .toBeFalsy();

    const isFolderVisible = await folderConversations
      .getFolderByName(emptyFolder.name)
      .isVisible();
    expect.soft(isFolderVisible, ExpectedMessages.folderDeleted).toBeFalsy();

    for (const nestedFolder of nestedFolders) {
      const isNestedFolderVisible = await folderConversations
        .getFolderByName(nestedFolder.name)
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

    const isNewConversationVisible = await conversations
      .getConversationByName(ExpectedConstants.newConversationTitle)
      .isVisible();
    expect
      .soft(isNewConversationVisible, ExpectedMessages.newConversationCreated)
      .toBeTruthy();

    const isFolderPromptVisible = await folderPrompts.isFolderPromptVisible(
      promptInFolder.folders.name,
      promptInFolder.prompts[0].name,
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

    if (i > 1) {
      await dialHomePage.reloadPage();
      await dialHomePage.waitForPageLoaded();
    }
    i--;
  }
});

test('Chat sorting. Sections can be collapsed and expanded', async ({
  dialHomePage,
  conversations,
  conversationData,
  localStorageManager,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1313');
  await test.step('Prepare conversations for all available chronologies', async () => {
    const yesterdayConversation =
      conversationData.prepareYesterdayConversation(gpt35Model);
    conversationData.resetData();
    const lastWeekConversation =
      conversationData.prepareLastWeekConversation(gpt35Model);
    conversationData.resetData();
    const lastMonthConversation =
      conversationData.prepareLastMonthConversation(gpt35Model);
    conversationData.resetData();
    const otherConversation =
      conversationData.prepareOlderConversation(gpt35Model);
    await localStorageManager.setConversationHistory(
      yesterdayConversation,
      lastWeekConversation,
      lastMonthConversation,
      otherConversation,
    );
  });

  await test.step('Verify it is possible to expand/collapse random chronology', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });

    const randomChronology = GeneratorUtil.randomArrayElement([
      Chronology.today,
      Chronology.yesterday,
      Chronology.lastSevenDays,
      Chronology.lastThirtyDays,
      Chronology.older,
    ]);
    await conversations.chronologyByTitle(randomChronology).click();

    let chronologyConversations =
      await conversations.getChronologyConversations(randomChronology);
    expect
      .soft(
        chronologyConversations.length,
        ExpectedMessages.chronologyMessageCountIsCorrect,
      )
      .toBe(0);

    await conversations.chronologyByTitle(randomChronology).click();
    chronologyConversations =
      await conversations.getChronologyConversations(randomChronology);
    expect
      .soft(
        chronologyConversations.length,
        ExpectedMessages.chronologyMessageCountIsCorrect,
      )
      .toBe(1);
  });
});

test('Search conversation when no folders', async ({
  dialHomePage,
  conversations,
  conversationData,
  localStorageManager,
  chatBar,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1188');
  const request = 'What is epam official name?';
  const notMatchingSearchTerm = 'abc';
  const firstSearchTerm = 'EPAM';
  const secondSearchTerm = 'epam official';
  const specialSymbolsSearchTerm = '@';

  await test.step('Prepare conversations with different content', async () => {
    const firstConversation =
      conversationData.prepareModelConversationBasedOnRequests(gpt35Model, [
        request,
      ]);
    conversationData.resetData();

    const secondConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        gpt4Model,
        ['What is AI?'],
        'epam official name',
      );
    conversationData.resetData();

    const thirdConversation =
      conversationData.prepareModelConversationBasedOnRequests(
        bisonModel,
        [request],
        'Chat_!@#$%^&*()+=\':",.<>',
      );

    await localStorageManager.setConversationHistory(
      firstConversation,
      secondConversation,
      thirdConversation,
    );
  });

  await test.step('Type not matching search term is "Search chat..." field and verify no results found', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await chatBar.searchChat.fill(notMatchingSearchTerm);
    const noResult = await chatBar.noResultFoundIcon.getElementInnerContent();
    expect
      .soft(noResult, ExpectedMessages.noResultsFound)
      .toBe(ExpectedConstants.noResults);
  });

  await test.step('Clear search field and verify all conversations are displayed', async () => {
    await chatBar.searchChat.fill('');
    const results = await conversations.getTodayConversations();
    expect
      .soft(results.length, ExpectedMessages.searchResultCountIsValid)
      .toBe(4);
  });

  await test.step('Search by first term and verify search results are correct', async () => {
    for (const term of [firstSearchTerm, secondSearchTerm]) {
      await chatBar.searchChat.fill(term);
      const results = await conversations.getTodayConversations();
      expect
        .soft(results.length, ExpectedMessages.searchResultCountIsValid)
        .toBe(3);
    }
  });

  await test.step('Search by special symbol and verify search results are correct', async () => {
    await chatBar.searchChat.fill(specialSymbolsSearchTerm);
    const results = await conversations.getTodayConversations();
    expect
      .soft(results.length, ExpectedMessages.searchResultCountIsValid)
      .toBe(1);
  });
});
