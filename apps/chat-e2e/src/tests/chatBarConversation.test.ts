import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { OpenAIEntityModel } from '@/chat/types/openai';
import test, { stateFilePath } from '@/src/core/fixtures';
import {
  Chronology,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { BucketUtil, GeneratorUtil } from '@/src/utils';
import { ModelsUtil } from '@/src/utils/modelsUtil';
import { expect } from '@playwright/test';

let gpt35Model: OpenAIEntityModel;
let gpt4Model: OpenAIEntityModel;
let bisonModel: OpenAIEntityModel;

const request = 'What is epam official name?';
const notMatchingSearchTerm = 'abc';
const secondSearchTerm = 'epam official';
const matchingConversationName = `${secondSearchTerm} name`;
const specialSymbolsName = 'Chat_!@#$%^&*()+=\':",.<>';

test.beforeAll(async () => {
  gpt35Model = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bisonModel = ModelsUtil.getModel(ModelIds.BISON_001)!;
});

test.describe('Chat bar conversations tests', () => {
  test.use({
    storageState: stateFilePath,
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

  test(
    'Rename chat. Cancel.\n' +
      'Long Chat name is cut. Named automatically by the system.\n' +
      'Long chat name while delete and edit',
    async ({
      dialHomePage,
      conversations,
      conversationDropdownMenu,
      conversationData,
      localStorageManager,
      setTestIds,
    }) => {
      setTestIds('EPMRTC-588', 'EPMRTC-816', 'EPMRTC-1494');
      const newName = 'new name to cancel';
      let conversation: Conversation;
      const conversationName = GeneratorUtil.randomString(70);

      await test.step('Prepare conversation with long name', async () => {
        conversation = conversationData.prepareDefaultConversation(
          gpt35Model,
          conversationName,
        );
        await localStorageManager.setConversationHistory(conversation);
        await localStorageManager.setSelectedConversation(conversation);
      });

      await test.step('Open app and verify conversation name is truncated in the side panel', async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      });

      await test.step('Hover over conversation name and verify it is truncated when menu dots appear', async () => {
        await conversations.getConversationByName(conversationName).hover();
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      });

      await test.step('Select "Rename" from chat menu and verify it is truncated, cursor set at the end', async () => {
        await conversations.openConversationDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(undefined);
      });

      await test.step('Set new conversation name, cancel edit and verify conversation with initial name shown', async () => {
        const nameInput = await conversations.openEditConversationNameMode(
          conversation.name,
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

      await test.step('Select "Delete" from conversation menu and verify its name is truncated when menu dots appear', async () => {
        await conversations.openConversationDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        const chatNameOverflow = await conversations
          .getConversationName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      });
    },
  );

  test(
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
      expect
        .soft(
          await conversations.getConversationByName(newName).isVisible(),
          ExpectedMessages.conversationNameUpdated,
        )
        .toBeTruthy();

      const chatNameOverflow = await conversations
        .getConversationName(newName)
        .getComputedStyleProperty(Styles.text_overflow);
      expect
        .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
        .toBe(Overflow.ellipsis);

      await chat.sendRequestWithButton('one more test message');
      expect
        .soft(
          await conversations.getConversationByName(newName).isVisible(),
          ExpectedMessages.conversationNameUpdated,
        )
        .toBeTruthy();
    },
  );

  test(
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
    await folderConversations.openFolderEntityDropdownMenu(
      conversationInFolder.folders.name,
      conversationInFolder.conversations[0].name,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await folderConversations
      .getFolderConversationInput(conversationInFolder.conversations[0].name)
      .clickTickButton();
    expect
      .soft(
        await folderConversations.isFolderEntityVisible(
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
    await conversations
      .getConversationInput(conversation.name)
      .clickTickButton();
    expect
      .soft(
        await conversations
          .getConversationByName(conversation.name)
          .isVisible(),
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
      const yesterdayConversation =
        conversationData.prepareYesterdayConversation(gpt35Model, 'yesterday');
      conversationData.resetData();
      const lastWeekConversation = conversationData.prepareLastWeekConversation(
        gpt35Model,
        'last week',
      );
      conversationData.resetData();
      const lastMonthConversation =
        conversationData.prepareLastMonthConversation(gpt35Model, 'last month');
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
      await folderConversations.isFolderEntityVisible(
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
      .toBe(Colors.textAccentSecondary);
  });

  test(
    'Chat is moved to folder from Move to list.\n' +
      'Long folder name is cut in Move to menu',
    async ({
      dialHomePage,
      conversations,
      conversationDropdownMenu,
      conversationData,
      localStorageManager,
      folderConversations,
      setTestIds,
    }) => {
      setTestIds('EPMRTC-863', 'EPMRTC-942');
      const folderName = GeneratorUtil.randomString(70);
      let conversation: Conversation;

      await test.step('Prepare conversation and folder with long name to move conversation in', async () => {
        const folderToMoveIn = conversationData.prepareFolder(folderName);
        conversation = conversationData.prepareDefaultConversation();
        await localStorageManager.setConversationHistory(conversation);
        await localStorageManager.setFolders(folderToMoveIn);
        await localStorageManager.setSelectedConversation(conversation);
        await localStorageManager.setOpenedFolders(folderToMoveIn);
      });

      await test.step('Open "Move to" menu option for conversation and verify folder name is truncated', async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
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
      });

      await test.step('Select folder name from menu and conversation is moved into folder', async () => {
        await conversationDropdownMenu.selectMenuOption(folderName);
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
      });
    },
  );

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
      .getFolderByName(emptyFolder.name)
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
    await chatBar.deleteAllEntities();
    await confirmationDialog.confirm();

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

      const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
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
    chatBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1188');
    const firstSearchTerm = 'EPAM';
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
          matchingConversationName,
        );
      conversationData.resetData();

      const thirdConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          bisonModel,
          [request],
          specialSymbolsName,
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
      await chatBarSearch.setSearchValue(notMatchingSearchTerm);
      const noResult = await chatBar.noResultFoundIcon.getElementInnerContent();
      expect
        .soft(noResult, ExpectedMessages.noResultsFound)
        .toBe(ExpectedConstants.noResults);
    });

    await test.step('Clear search field and verify all conversations are displayed', async () => {
      await chatBarSearch.setSearchValue('');
      const results = await conversations.getTodayConversations();
      expect
        .soft(results.length, ExpectedMessages.searchResultCountIsValid)
        .toBe(4);
    });

    await test.step('Search by first term and verify search results are correct', async () => {
      for (const term of [firstSearchTerm, secondSearchTerm]) {
        await chatBarSearch.setSearchValue(term);
        const results = await conversations.getTodayConversations();
        expect
          .soft(results.length, ExpectedMessages.searchResultCountIsValid)
          .toBe(3);
      }
    });

    await test.step('Search by special symbol and verify search results are correct', async () => {
      await chatBarSearch.setSearchValue(specialSymbolsSearchTerm);
      const results = await conversations.getTodayConversations();
      expect
        .soft(results.length, ExpectedMessages.searchResultCountIsValid)
        .toBe(1);
    });
  });

  test('Search conversation located in folders', async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    chatBar,
    folderConversations,
    chatBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1201');

    let firstFolder: FolderInterface;
    let secondFolder: FolderInterface;
    let thirdFolder: FolderInterface;

    await test.step('Prepare conversations in folders with different content', async () => {
      firstFolder = conversationData.prepareFolder();
      conversationData.resetData();

      const firstConversation =
        conversationData.prepareModelConversationBasedOnRequests(gpt35Model, [
          request,
        ]);
      firstConversation.folderId = firstFolder.id;
      conversationData.resetData();

      const secondConversation = conversationData.prepareDefaultConversation(
        gpt4Model,
        matchingConversationName,
      );
      secondConversation.folderId = firstFolder.id;
      conversationData.resetData();

      secondFolder = conversationData.prepareFolder();
      conversationData.resetData();

      const thirdConversation =
        conversationData.prepareModelConversationBasedOnRequests(
          bisonModel,
          [request],
          specialSymbolsName,
        );
      thirdConversation.folderId = secondFolder.id;
      conversationData.resetData();

      const fourthConversation =
        conversationData.prepareDefaultConversation(gpt35Model);
      fourthConversation.folderId = secondFolder.id;
      conversationData.resetData();

      thirdFolder = conversationData.prepareFolder();

      await localStorageManager.setConversationHistory(
        firstConversation,
        secondConversation,
        thirdConversation,
        fourthConversation,
      );
      await localStorageManager.setFolders(
        firstFolder,
        secondFolder,
        thirdFolder,
      );
    });

    await test.step('Type not matching search term is "Search chat..." field and verify no results found', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await chatBarSearch.setSearchValue(notMatchingSearchTerm);
      const noResult = await chatBar.noResultFoundIcon.getElementInnerContent();
      expect
        .soft(noResult, ExpectedMessages.noResultsFound)
        .toBe(ExpectedConstants.noResults);
    });

    await test.step('Clear search field and verify all conversations are displayed', async () => {
      await chatBarSearch.setSearchValue('');
      const results = await folderConversations.getFoldersCount();
      expect.soft(results, ExpectedMessages.searchResultCountIsValid).toBe(3);
    });

    await test.step('Search by search term and verify search results are correct, empty folder is not shown', async () => {
      await chatBarSearch.setSearchValue(secondSearchTerm);
      let results = await folderConversations.getFolderEntitiesCount(
        firstFolder.name,
      );
      results += await folderConversations.getFolderEntitiesCount(
        secondFolder.name,
      );
      expect.soft(results, ExpectedMessages.searchResultCountIsValid).toBe(3);

      const isEmptyFolderVisible = await folderConversations
        .getFolderByName(thirdFolder.name)
        .isVisible();
      expect
        .soft(isEmptyFolderVisible, ExpectedMessages.folderIsNotVisible)
        .toBeFalsy();
    });
  });
});
