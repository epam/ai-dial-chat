import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  Chronology,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { EditInput } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ModelsUtil } from '@/src/utils/modelsUtil';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;

const request = 'What is epam official name';
const notMatchingSearchTerm = 'abc';
const secondSearchTerm = 'epam official';
const matchingConversationName = `${secondSearchTerm} name`;
const specialSymbolsName = () => {
  const allowedCharsLength = ExpectedConstants.allowedSpecialChars.length;
  return `${ExpectedConstants.allowedSpecialChars.substring(0, allowedCharsLength / 2)}epam official${ExpectedConstants.allowedSpecialChars.substring(allowedCharsLength / 2, allowedCharsLength)}`;
};

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Chat name equals to the first message\n' +
    'Chat sorting. Today for newly created chat.\n' +
    'A dot at the end is removed if chat was named automatically\n' +
    'Chat name: restricted special characters are removed from chat name if to name automatically',
  async ({ dialHomePage, conversations, chat, chatMessages, setTestIds }) => {
    setTestIds('EPMRTC-583', 'EPMRTC-776', 'EPMRTC-2894', 'EPMRTC-2957');
    const messageToSend = `.Hi${ExpectedConstants.restrictedNameChars}...`;
    const expectedConversationName = '.Hi';

    await dialTest.step(
      'Send request with prohibited symbols and verify they are not displayed in conversation name',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(messageToSend);

        await expect
          .soft(
            conversations.getEntityByName(expectedConversationName),
            ExpectedMessages.conversationNameUpdated,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Verify request is fully displayed in chat history',
      async () => {
        await expect
          .soft(
            chatMessages.getChatMessage(1),
            ExpectedMessages.messageContentIsValid,
          )
          .toHaveText(messageToSend);
      },
    );

    await dialTest.step(
      'Verify conversation is placed in Today section',
      async () => {
        const todayConversations = await conversations.getTodayConversations();
        expect
          .soft(
            todayConversations.includes(expectedConversationName),
            ExpectedMessages.conversationOfToday,
          )
          .toBeTruthy();
      },
    );
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
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-588', 'EPMRTC-816', 'EPMRTC-1494');
    const newName = 'new name to cancel';
    let conversation: Conversation;
    const conversationName = GeneratorUtil.randomString(70);

    await dialTest.step('Prepare conversation with long name', async () => {
      conversation = conversationData.prepareDefaultConversation(
        defaultModel,
        conversationName,
      );
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Open app and verify conversation name is truncated in the side panel',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        const chatNameOverflow = await conversations
          .getEntityName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Hover over conversation name and verify it is truncated when menu dots appear',
      async () => {
        await conversations.getEntityByName(conversationName).hover();
        const chatNameOverflow = await conversations
          .getEntityName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(Overflow.ellipsis);
      },
    );

    await dialTest.step(
      'Select "Rename" from chat menu and verify it is truncated, cursor set at the end',
      async () => {
        await conversations.openEntityDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        const chatNameOverflow = await conversations
          .getEntityName(conversationName)
          .getComputedStyleProperty(Styles.text_overflow);
        expect
          .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
          .toBe(undefined);
      },
    );

    await dialTest.step(
      'Set new conversation name, cancel edit and verify conversation with initial name shown',
      async () => {
        await conversations.openEditEntityNameMode(newName);
        await conversations.getEditInputActions().clickCancelButton();
        await expect
          .soft(
            conversations.getEntityByName(newName),
            ExpectedMessages.conversationNameNotUpdated,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Select "Delete" from conversation menu and verify its name is truncated when menu dots appear',
      async () => {
        await conversations.openEntityDropdownMenu(conversationName);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        const chatNameOverflow = await conversations
          .getEntityName(conversationName)
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
    await conversations.openEntityDropdownMenu(
      ExpectedConstants.newConversationTitle,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
    await conversations.editConversationNameWithTick(newName);
    await expect
      .soft(
        conversations.getEntityByName(newName),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeVisible();

    const chatNameOverflow = await conversations
      .getEntityName(newName)
      .getComputedStyleProperty(Styles.text_overflow);
    expect
      .soft(chatNameOverflow[0], ExpectedMessages.chatNameIsTruncated)
      .toBe(Overflow.ellipsis);

    await dialHomePage.mockChatTextResponse(
      MockedChatApiResponseBodies.simpleTextBody,
    );
    await chat.sendRequestWithButton('one more test message');
    await expect
      .soft(
        conversations.getEntityByName(newName),
        ExpectedMessages.conversationNameUpdated,
      )
      .toBeVisible();
  },
);

dialTest(
  'Rename chat after starting the conversation.\n' +
    'Chat name: spaces in the middle of chat name stay.\n' +
    'Long Chat name is cut in chat header. Named manually.\n' +
    'Tooltip shows full long chat name in chat header. Named manually.\n' +
    'Long chat name is cut in chat header. Named automatically by the system.\n' +
    'Tooltip shows full long chat name in chat header. Named automatically by the system.\n' +
    'Rename chat or chat folder with 161 symbol with dot in the end',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    chatHeader,
    tooltip,
    setTestIds,
    errorPopup,
    errorToast,
  }) => {
    setTestIds(
      'EPMRTC-585',
      'EPMRTC-3084',
      'EPMRTC-821',
      'EPMRTC-822',
      'EPMRTC-818',
      'EPMRTC-820',
      'EPMRTC-3188',
    );
    const newLongNameWithMiddleSpacesEndDot = `${GeneratorUtil.randomString(80)}${' '.repeat(3)}${GeneratorUtil.randomString(77)}.`;
    const expectedName = newLongNameWithMiddleSpacesEndDot.substring(
      0,
      ExpectedConstants.maxEntityNameLength,
    );
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([conversation]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.selectConversation(conversation.name);
    await conversations.openEntityDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
    await conversations.editConversationNameWithEnter(
      newLongNameWithMiddleSpacesEndDot,
    );

    await expect
      .soft(
        errorToast.getElementLocator(),
        ExpectedMessages.noErrorToastIsShown,
      )
      .toBeHidden();
    const actualName = await conversations
      .getEntityName(expectedName)
      .getElementInnerContent();
    expect
      .soft(actualName, ExpectedMessages.conversationNameUpdated)
      .toBe(expectedName);

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
      .toBe(expectedName);

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

dialTest(
  'Menu for New conversation.\n' +
    'Duplicate item is not available for chat without history',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-594', 'EPMRTC-3054');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await conversations.openEntityDropdownMenu(
      ExpectedConstants.newConversationTitle,
    );
    const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual([
        MenuOptions.select,
        MenuOptions.rename,
        MenuOptions.compare,
        MenuOptions.moveTo,
        MenuOptions.delete,
      ]);
  },
);

dialTest(
  'Menu for conversation with history.\n' +
    'Error message appears if to add a dot to the end of chat name.\n' +
    'Chat name: restricted special characters are not allowed to be entered while renaming manually.\n' +
    'Chat name can not be blank.\n' +
    'Spaces at the beginning or end of chat name are removed.\n' +
    'Special characters are allowed in chat name',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    chat,
    errorToast,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-595',
      'EPMRTC-2855',
      'EPMRTC-2895',
      'EPMRTC-586',
      'EPMRTC-1574',
      'EPMRTC-1276',
    );
    let editInputContainer: EditInput;
    const newNameWithEndDot = 'updated folder name.';

    await dialTest.step(
      'Start editing conversation to name with dot at the end and verify error message shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await conversations.openEntityDropdownMenu(
          ExpectedConstants.newConversationTitle,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        editInputContainer =
          await conversations.openEditEntityNameMode(newNameWithEndDot);
        await conversations.getEditInputActions().clickTickButton();

        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(ExpectedConstants.nameWithDotErrorMessage);
      },
    );

    await dialTest.step(
      'Start typing prohibited symbols and verify they are not displayed in text input',
      async () => {
        await editInputContainer.editInput.click();
        await editInputContainer.editValue(
          ExpectedConstants.restrictedNameChars,
        );
        const inputContent = await editInputContainer.getEditInputValue();
        expect
          .soft(inputContent, ExpectedMessages.charactersAreNotDisplayed)
          .toBe('');
      },
    );

    await dialTest.step(
      'Set empty conversation name or spaces and verify initial name is preserved',
      async () => {
        const name = GeneratorUtil.randomArrayElement(['', '   ']);
        editInputContainer = await conversations.openEditEntityNameMode(name);
        await conversations.getEditInputActions().clickTickButton();
        await expect
          .soft(
            conversations.getEntityByName(
              ExpectedConstants.newConversationTitle,
            ),
            ExpectedMessages.conversationNameNotUpdated,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Verify renaming conversation to the name with special symbols is successful',
      async () => {
        await conversations.openEntityDropdownMenu(
          ExpectedConstants.newConversationTitle,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await conversations.editConversationNameWithTick(
          ExpectedConstants.allowedSpecialChars,
        );
        await expect
          .soft(
            conversations.getEntityByName(
              ExpectedConstants.allowedSpecialChars,
            ),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Send new request to conversation and verify context menu options',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('1+2');
        await conversations.openEntityDropdownMenu(
          ExpectedConstants.allowedSpecialChars,
        );
        const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
          .toEqual([
            MenuOptions.select,
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
    await expect
      .soft(
        folderConversations.getFolderEntity(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        ),
        ExpectedMessages.conversationIsNotVisible,
      )
      .toBeHidden();
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
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-608');
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([conversation]);

    await dialHomePage.openHomePage({
      iconsToBeLoaded: [defaultModel.iconUrl],
    });
    await dialHomePage.waitForPageLoaded();
    await conversations.selectConversation(conversation.name);
    await conversations.openEntityDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    await expect
      .soft(
        conversations.getEntityByName(conversation.name),
        ExpectedMessages.conversationIsNotVisible,
      )
      .toBeHidden();
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
      defaultModel,
      'yesterday',
    );
    conversationData.resetData();
    const lastWeekConversation = conversationData.prepareLastWeekConversation(
      defaultModel,
      'last week',
    );
    conversationData.resetData();
    const lastMonthConversation = conversationData.prepareLastMonthConversation(
      defaultModel,
      'last month',
    );
    await dataInjector.createConversations([
      yesterdayConversation,
      lastWeekConversation,
      lastMonthConversation,
    ]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.selectConversation(yesterdayConversation.name);
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
    await dialHomePage.mockChatTextResponse(
      MockedChatApiResponseBodies.simpleTextBody,
    );
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

dialTest(
  'Chat is moved to folder created from Move to',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    folderConversations,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-864');
    const conversation = conversationData.prepareDefaultConversation();
    await dataInjector.createConversations([conversation]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.selectConversation(conversation.name);
    await conversations.openEntityDropdownMenu(conversation.name);
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
      },
    );

    await dialTest.step(
      'Open "Move to" menu option for conversation and verify folder name is truncated',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatBar.createNewFolder();
        await folderConversations.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
          1,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderConversations.editFolderNameWithEnter(folderName);

        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.moveTo);

        const moveToFolder = conversationDropdownMenu.getMenuOption(folderName);
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

    await expect
      .soft(
        folderConversations.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(1),
        ),
        ExpectedMessages.folderNotDeleted,
      )
      .toBeVisible();

    await expect
      .soft(
        conversations.getEntityByName(singleConversation.name),
        ExpectedMessages.conversationNotDeleted,
      )
      .toBeVisible();
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

      await expect
        .soft(
          folderConversations.getFolderByName(
            ExpectedConstants.newFolderWithIndexTitle(4),
          ),
          ExpectedMessages.folderDeleted,
        )
        .toBeHidden();

      for (let i = 1; i <= 3; i++) {
        await expect
          .soft(
            folderConversations.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderDeleted,
          )
          .toBeHidden();
      }

      await expect
        .soft(
          conversations.getEntityByName(singleConversation.name),
          ExpectedMessages.conversationDeleted,
        )
        .toBeHidden();

      await conversations
        .getEntityByName(ExpectedConstants.newConversationTitle)
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

      const promptFolder = folderPrompts.getFolderByName(
        ExpectedConstants.newFolderWithIndexTitle(1),
      );
      i === 1
        ? await expect
            .soft(promptFolder, ExpectedMessages.folderNotDeleted)
            .toBeHidden()
        : await expect
            .soft(promptFolder, ExpectedMessages.folderNotDeleted)
            .toBeVisible();

      await expect
        .soft(
          prompts.getEntityByName(singlePrompt.name),
          ExpectedMessages.promptNotDeleted,
        )
        .toBeVisible();

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
          conversationData.prepareYesterdayConversation(defaultModel);
        conversationData.resetData();
        const lastWeekConversation =
          conversationData.prepareLastWeekConversation(defaultModel);
        conversationData.resetData();
        const lastMonthConversation =
          conversationData.prepareLastMonthConversation(defaultModel);
        conversationData.resetData();
        const otherConversation =
          conversationData.prepareOlderConversation(defaultModel);
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
          defaultModel,
          matchingConversationName,
        );
        conversationData.resetData();

        const secondConversation = conversationData.prepareDefaultConversation(
          defaultModel,
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
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
          );
        firstConversation.folderId = firstFolder.id;
        firstConversation.id = `${firstConversation.folderId}/${firstConversation.id}`;
        conversationData.resetData();

        const secondConversation = conversationData.prepareDefaultConversation(
          defaultModel,
          matchingConversationName,
        );
        secondConversation.folderId = firstFolder.id;
        secondConversation.id = `${secondConversation.folderId}/${secondConversation.id}`;
        conversationData.resetData();

        secondFolder = conversationData.prepareFolder();
        conversationData.resetData();

        const thirdConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            [request],
            specialSymbolsName(),
          );
        thirdConversation.folderId = secondFolder.id;
        thirdConversation.id = `${thirdConversation.folderId}/${thirdConversation.id}`;
        conversationData.resetData();

        const fourthConversation =
          conversationData.prepareDefaultConversation(defaultModel);
        fourthConversation.folderId = secondFolder.id;
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

        await expect
          .soft(
            folderConversations.getFolderByName(
              ExpectedConstants.newFolderWithIndexTitle(1),
            ),
            ExpectedMessages.folderIsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'Chat name with smiles.\n' + 'Chat name with hieroglyph, specific letters',
  async ({
    dialHomePage,
    conversations,
    conversationDropdownMenu,
    conversationData,
    dataInjector,
    chatMessages,
    chat,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2849', 'EPMRTC-2959');
    const updatedConversationName = `😂👍🥳 😷 🤧 🤠 🥴😇 😈 ⭐あおㅁㄹñ¿äß`;
    let conversation: Conversation;

    await dialTest.step('Prepare new conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Rename conversation to name with emoticons and hieroglyphs',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await conversations.editConversationNameWithTick(
          updatedConversationName,
        );
        await expect
          .soft(
            conversations.getEntityByName(updatedConversationName),
            ExpectedMessages.conversationNameUpdated,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Send request to chat and verify response received',
      async () => {
        const simpleRequestModel = ModelsUtil.getModelForSimpleRequest();
        if (simpleRequestModel !== undefined) {
          await chat.sendRequestWithButton('1+2');
          const messagesCount =
            await chatMessages.chatMessages.getElementsCount();
          expect
            .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
            .toBe(conversation.messages.length + 2);
        }
      },
    );
  },
);

const longRequest =
  'Create a detailed guide on how to start a successful small business from scratch. Starting a small business from scratch can be a daunting task  but with the right planning, strategy, and dedication, it is indeed possible to build a successful venture. This comprehensive guide will outline the step-by-step process to help aspiring entrepreneurs kickstart their journey and turn their business ideas into reality';
const testRequestMap = new Map([
  [
    `how${GeneratorUtil.randomArrayElement(ExpectedConstants.controlChars.split(''))}are you`,
    'how are you',
  ],
  ['first\nsecond\nthird', 'first'],
  [
    longRequest,
    longRequest.substring(0, ExpectedConstants.maxEntityNameLength),
  ],
]);
for (const [request, expectedConversationName] of testRequestMap.entries()) {
  dialTest(
    'Chat name: tab is changed to space if to use it in chat name.\n' +
      'Chat name: ASCII control characters %00-%1F are changed to space if to use them in chat name.\n' +
      'The first and only row from the first message is used as chat name.\n' +
      'The first 160 symbols from the first message is used as chat name' +
      ` for ${expectedConversationName}`,
    async ({
      dialHomePage,
      conversations,
      sendMessage,
      chatMessages,
      setTestIds,
    }) => {
      setTestIds('EPMRTC-3007', 'EPMRTC-3015', 'EPMRTC-2853', 'EPMRTC-2961');

      await dialTest.step(
        'Send request to chat and verify control chars are replaced with spaces',
        async () => {
          await dialHomePage.openHomePage();
          await dialHomePage.waitForPageLoaded({
            isNewConversationVisible: true,
          });
          await sendMessage.send(request);

          const actualConversationName = await conversations
            .getEntityName(expectedConversationName)
            .getElementInnerContent();
          expect
            .soft(
              actualConversationName,
              ExpectedMessages.conversationNameUpdated,
            )
            .toBe(expectedConversationName);
          await expect
            .soft(
              chatMessages.getChatMessage(1),
              ExpectedMessages.messageContentIsValid,
            )
            .toHaveText(request);
        },
      );
    },
  );
}

dialTest(
  'Chat name: restricted special characters are removed from chat name if to name automatically via updating the 1st message',
  async ({
    dialHomePage,
    conversations,
    chatHeader,
    conversationData,
    dataInjector,
    chatMessages,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2958');
    const updatedRequest = `Chat${ExpectedConstants.restrictedNameChars}name.....`;
    const expectedConversationName = `Chat${' '.repeat(ExpectedConstants.restrictedNameChars.length)}name`;
    let conversation: Conversation;

    await dialTest.step('Prepare new conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
    });

    await dialTest.step(
      'Edit first chat request to contain restricted symbols and verify request is fully displayed in chat history',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await chatMessages.openEditMessageMode(1);
        await chatMessages.editMessage(
          conversation.messages[0].content,
          updatedRequest,
        );
        await expect
          .soft(
            chatMessages.getChatMessage(1),
            ExpectedMessages.messageContentIsValid,
          )
          .toHaveText(updatedRequest);
      },
    );

    await dialTest.step(
      'Verify conversation name is updated on side bar, header and restricted symbols are removed from the name',
      async () => {
        await expect
          .soft(
            conversations.getEntityByName(expectedConversationName),
            ExpectedMessages.conversationNameUpdated,
          )
          .toBeVisible();

        expect
          .soft(
            await chatHeader.chatTitle.getElementInnerContent(),
            ExpectedMessages.headerTitleIsValid,
          )
          .toBe(expectedConversationName);
      },
    );
  },
);
