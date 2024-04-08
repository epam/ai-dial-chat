import { isApiStorageType } from '@/src/hooks/global-setup';

import { ModelsUtil } from '@/src/utils/modelsUtil';

import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';

import dialTest from '@/src/core/dialFixtures';
import {
  Chronology,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let gpt35Model: DialAIEntityModel;
let gpt4Model: DialAIEntityModel;
let bisonModel: DialAIEntityModel;

const request = 'What is epam official name';
const notMatchingSearchTerm = 'abc';
const secondSearchTerm = 'epam official';
const matchingConversationName = `${secondSearchTerm} name`;
const specialSymbolsName = '_!@$epam official^&()_[]"\'.<>-`~';

dialTest.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bisonModel = ModelsUtil.getModel(ModelIds.BISON_001)!;
});

dialTest(
  'Chat name equals to the first message\n' +
    'Chat sorting. Today for newly created chat',
  async ({ dialHomePage, conversations, chat, setTestIds }) => {
    setTestIds('EPMRTC-583', 'EPMRTC-776');
    await dialHomePage.openHomePage({
      iconsToBeLoaded: [ModelsUtil.getDefaultModel()!.iconUrl],
    });
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    const messageToSend = 'Hi';
    await chat.sendRequestWithButton(messageToSend);
    await conversations.getConversationByName(messageToSend).waitFor();

    const todayConversations = await conversations.getTodayConversations();
    expect
      .soft(
        todayConversations.includes(messageToSend),
        ExpectedMessages.conversationOfToday,
      )
      .toBeTruthy();
  },
);

dialTest(
  'Rename chat. Cancel.\n' +
    'Long Chat name is cut. Named automatically by the system.\n' +
    'Long chat name while delete and edit',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    localStorageManager,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-588', 'EPMRTC-816', 'EPMRTC-1494');
    const newName = 'new name to cancel';
    let conversation: Conversation;
    const conversationName = GeneratorUtil.randomString(70);

    await dialTest.step('Prepare conversation with long name', async () => {
      conversation = conversationData.prepareDefaultConversation(
        gpt35Model,
        conversationName,
      );
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Open app and verify conversation name is truncated in the side panel',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Hover over conversation name and verify it is truncated when menu dots appear',
      async () => {
        await conversations.getConversationByName(conversationName).hover();
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Select "Rename" from chat menu and verify it is truncated, cursor set at the end',
      async () => {
        await conversations.openConversationDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(undefined);
      },
    );

    await dialTest.step(
      'Set new conversation name, cancel edit and verify conversation with initial name shown',
      async () => {
        const nameInput = await conversations.openEditConversationNameMode(
          conversation.name,
          newName,
        );
        await nameInput.clickCancelButton();
        await expect
          .soft(
            conversations.getConversationByName(newName),
            ExpectedMessages.conversationNameNotUpdated,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Select "Delete" from conversation menu and verify its name is truncated when menu dots appear',
      async () => {
        await conversations.openConversationDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );
  },
);

dialTest(
  'Rename chat before starting the conversation.\n' +
    'Long Chat name is cut. Named manually',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    chat,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-584', 'EPMRTC-819');
    const newName = GeneratorUtil.randomString(70);
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
    await expect
      .soft(
        conversations.getConversationByName(newName),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeVisible();

    const chatNameOverflow = await conversations
      .getConversationName(newName)
      .getComputedStyleProperty(Styles.text_overflow);
    expect
      .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
      .toBe(Overflow.ellipsis);

    await chat.sendRequestWithButton('one more test message');
    await expect
      .soft(
        conversations.getConversationByName(newName),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeVisible();
  },
);

dialTest(
  'Rename chat after starting the conversation.\n' +
    'Long Chat name is cut in chat header. Named manually.\n' +
    'Tooltip shows full long chat name in chat header. Named manually.\n' +
    'Long chat name is cut in chat header. Named automatically by the system.\n' +
    'Tooltip shows full long chat name in chat header. Named automatically by the system',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    localStorageManager,
    chatHeader,
    tooltip,
    setTestIds,
    errorPopup,
  }) => {
    setTestIds(
      'EPMRTC-585',
      'EPMRTC-821',
      'EPMRTC-822',
      'EPMRTC-818',
      'EPMRTC-820',
    );
    const newName = GeneratorUtil.randomString(60);
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([conversation]);
    await localStorageManager.setSelectedConversation(conversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
    await conversations.editConversationNameWithEnter(
      conversation.name,
      newName,
    );
    await expect
      .soft(
        conversations.getConversationByName(newName),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeVisible();

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

    const isTooltipChatHeaderTitleTruncated =
      await tooltip.isElementWidthTruncated();
    expect
      .soft(
        isTooltipChatHeaderTitleTruncated,
        ExpectedMessages.headerTitleIsFullyVisible,
      )
      .toBeFalsy();
  },
);

dialTest.only(
  'Menu for New conversation',
  async ({
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
        MenuOptions.duplicate,
        MenuOptions.moveTo,
        MenuOptions.delete,
      ]);
  },
);

dialTest.only(
  'Menu for conversation with history.\n' +
    'Special characters are allowed in chat name',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    localStorageManager,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-595', 'EPMRTC-1276');
    const conversation = conversationData.prepareDefaultConversation(
      gpt35Model,
      '!@$^&()_[] "\'.<>-`~',
    );
    await dataInjector.createConversations([conversation]);
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
        MenuOptions.duplicate,
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

//TODO: enable when item modification date is implemented on backend
dialTest.skip(
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
    dataInjector,
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
    await dataInjector.createConversations([
      yesterdayConversation,
      lastWeekConversation,
      lastMonthConversation,
    ]);
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

    await chatMessages.regenerateResponse();
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

dialTest.only(
  'Chat is moved to folder created from Move to',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    localStorageManager,
    folderConversations,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-864');
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([conversation]);
    await localStorageManager.setSelectedConversation(conversation);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);
    await conversations.selectMoveToMenuOption(
      ExpectedConstants.newFolderTitle,
    );

    await folderConversations.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    const isFolderConversationVisible =
      await folderConversations.isFolderEntityVisible(
        ExpectedConstants.newFolderWithIndexTitle(1),
        conversation.name,
      );
    expect
      .soft(
        isFolderConversationVisible,
        ExpectedMessages.conversationMovedToFolder,
      )
      .toBeTruthy();

    const folderNameColor = await folderConversations.getFolderNameColor(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    expect
      .soft(folderNameColor[0], ExpectedMessages.folderNameColorIsValid)
      .toBe(Colors.textAccentSecondary);
  },
);

dialTest(
  'Chat is moved to folder from Move to list.\n' +
    'Long folder name is cut in Move to menu',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    localStorageManager,
    dataInjector,
    folderConversations,
    folderDropdownMenu,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-863', 'EPMRTC-942');
    const folderName = GeneratorUtil.randomString(70);
    let conversation: Conversation;

    await dialTest.step(
      'Prepare conversation and folder with long name to move conversation in',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Open "Move to" menu option for conversation and verify folder name is truncated',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatBar.createNewFolder();
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
          1,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderNameWithEnter(
          ExpectedConstants.newFolderWithIndexTitle(1),
          folderName,
        );

        await conversations.openConversationDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);

        const moveToFolder =
          await conversationDropdownMenu.getMenuOption(folderName);
        await moveToFolder.waitForState();
        const moveToFolderOverflow =
          await moveToFolder.getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(moveToFolderOverflow[0], ExpectedMessages.folderNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Select folder name from menu and conversation is moved into folder',
      async () => {
        await conversations.selectMoveToMenuOption(folderName);
        await folderConversations.expandFolder(folderName);
        const isFolderConversationVisible =
          await folderConversations.isFolderEntityVisible(
            folderName,
            conversation.name,
          );
        expect
          .soft(
            isFolderConversationVisible,
            ExpectedMessages.conversationMovedToFolder,
          )
          .toBeTruthy();
      },
    );
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

//TODO: enable when item modification date is implemented on backend
dialTest.skip(
  'Chat sorting. Sections can be collapsed and expanded',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1313');
    await dialTest.step(
      'Prepare conversations for all available chronologies',
      async () => {
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
      },
    );

    await dialTest.step(
      'Verify it is possible to expand/collapse random chronology',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });

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
      },
    );
  },
);

dialTest(
  'Search conversation when no folders',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    chatBar,
    chatBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1188');
    const firstSearchTerm = 'EPAM';
    const specialSymbolsSearchTerm = '@';
    const specialSymbolName = 'test' + specialSymbolsSearchTerm + 'chat';

    await dialTest.step(
      'Prepare conversations with different content',
      async () => {
        const firstConversation = conversationData.prepareDefaultConversation(
          gpt4Model,
          matchingConversationName,
        );
        conversationData.resetData();

        const secondConversation = conversationData.prepareDefaultConversation(
          bisonModel,
          specialSymbolName,
        );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
      },
    );

    await dialTest.step(
      'Type not matching search term is "Search conversation..." field and verify no results found',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBarSearch.setSearchValue(notMatchingSearchTerm);
        const noResult =
          await chatBar.noResultFoundIcon.getElementInnerContent();
        expect
          .soft(noResult, ExpectedMessages.noResultsFound)
          .toBe(ExpectedConstants.noResults);
      },
    );

    await dialTest.step(
      'Clear search field and verify all conversations are displayed',
      async () => {
        await chatBarSearch.setSearchValue('');
        const results = await conversations.getTodayConversations();
        expect
          .soft(results.length, ExpectedMessages.searchResultCountIsValid)
          .toBe(3);
      },
    );

    await dialTest.step(
      'Search by first term and verify search results are correct',
      async () => {
        for (const term of [firstSearchTerm, secondSearchTerm]) {
          await chatBarSearch.setSearchValue(term);
          const results = await conversations.getTodayConversations();
          expect
            .soft(results.length, ExpectedMessages.searchResultCountIsValid)
            .toBe(1);
        }
      },
    );

    await dialTest.step(
      'Search by special symbol and verify search results are correct',
      async () => {
        await chatBarSearch.setSearchValue(specialSymbolsSearchTerm);
        const results = await conversations.getTodayConversations();
        expect
          .soft(results.length, ExpectedMessages.searchResultCountIsValid)
          .toBe(1);
      },
    );
  },
);

dialTest(
  'Search conversation located in folders',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    chatBar,
    folderConversations,
    chatBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1201');

    let firstFolder: FolderInterface;
    let secondFolder: FolderInterface;

    await dialTest.step(
      'Prepare conversations in folders with different content',
      async () => {
        firstFolder = conversationData.prepareFolder();
        conversationData.resetData();

        const firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(gpt35Model, [
            request,
          ]);
        firstConversation.folderId = firstFolder.folderId;
        firstConversation.id = `${firstConversation.folderId}/${firstConversation.id}`;
        conversationData.resetData();

        const secondConversation = conversationData.prepareDefaultConversation(
          gpt4Model,
          matchingConversationName,
        );
        secondConversation.folderId = firstFolder.folderId;
        secondConversation.id = `${secondConversation.folderId}/${secondConversation.id}`;
        conversationData.resetData();

        secondFolder = conversationData.prepareFolder();
        conversationData.resetData();

        const thirdConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            bisonModel,
            [request],
            specialSymbolsName,
          );
        thirdConversation.folderId = secondFolder.folderId;
        thirdConversation.id = `${thirdConversation.folderId}/${thirdConversation.id}`;
        conversationData.resetData();

        const fourthConversation =
          conversationData.prepareDefaultConversation(gpt35Model);
        fourthConversation.folderId = secondFolder.folderId;
        fourthConversation.id = `${fourthConversation.folderId}/${fourthConversation.id}`;
        conversationData.resetData();

        await dataInjector.createConversations(
          [
            firstConversation,
            secondConversation,
            thirdConversation,
            fourthConversation,
          ],
          firstFolder,
          secondFolder,
        );
      },
    );

    await dialTest.step(
      'Type not matching search term is "Search conversation..." field and verify no results found',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await chatBar.createNewFolder();
        await chatBarSearch.setSearchValue(notMatchingSearchTerm);
        const noResult =
          await chatBar.noResultFoundIcon.getElementInnerContent();
        expect
          .soft(noResult, ExpectedMessages.noResultsFound)
          .toBe(ExpectedConstants.noResults);
      },
    );

    await dialTest.step(
      'Clear search field and verify all conversations are displayed',
      async () => {
        await chatBarSearch.setSearchValue('');
        const results = await folderConversations.getFoldersCount();
        expect.soft(results, ExpectedMessages.searchResultCountIsValid).toBe(3);
      },
    );

    await dialTest.step(
      'Search by search term and verify search results are correct, empty folder is not shown',
      async () => {
        await chatBarSearch.setSearchValue(secondSearchTerm);
        let results = await folderConversations.getFolderEntitiesCount(
          firstFolder.name,
        );
        results += await folderConversations.getFolderEntitiesCount(
          secondFolder.name,
        );
        expect
          .soft(results, ExpectedMessages.searchResultCountIsValid)
          .toBe(isApiStorageType ? 2 : 3);

        const isEmptyFolderVisible = await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible();
        expect
          .soft(isEmptyFolderVisible, ExpectedMessages.folderIsNotVisible)
          .toBeFalsy();
      },
    );
  },
);
