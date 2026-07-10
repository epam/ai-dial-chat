import { Conversation } from '@/chat/types/chat';
import { EnterType } from '@/chat/types/settings';
import dialTest from '@/src/core/dialFixtures';
import {
  AccountMenuOptions,
  CheckboxState,
  ExpectedConstants,
  MockedChatApiResponseBodies,
  ThemeId,
  ToggleState,
  toTitleCase,
} from '@/src/testData';
import { ThemeColorAttributes, getElementWidth } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';

dialTest(
  'Menu on user name',
  async ({
    dialHomePage,
    accountSettings,
    accountDropdownMenuAssertion,
    setTestIds,
    chatBar,
    accountSettingsAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-812');

    await dialTest.step(
      'Open account menu and verify menu options',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenuAssertion.assertMenuState('visible');
        await accountDropdownMenuAssertion.assertMenuOptions(
          Object.values(AccountMenuOptions),
        );
      },
    );

    await dialTest.step(
      'Click out of account menu and verify it is closed',
      async () => {
        await chatBar.click();
        await accountSettingsAssertion.assertCaretState('collapsed');
        await accountDropdownMenuAssertion.assertMenuState('hidden');
      },
    );
  },
);

dialTest(
  'Settings: available themes.\n' +
    `[Keyboard shortcuts][Windows] User Settings: default setting is 'Enter - send message, Shift + Enter - new line'`,
  async ({
    dialHomePage,
    accountSettings,
    accountDropdownMenu,
    settingsModalAssertion,
    setTestIds,
    settingsModal,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-360', 'EPMRTC-8041');

    await dialTest.step(
      'Open account settings and verify "Theme" field has "Dark" value, "Save" button is available',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModalAssertion.assertThemeValue(ThemeId.dark);
        await settingsModalAssertion.assertSaveButtonState('visible');
      },
    );

    await dialTest.step(
      'Expand "Theme" dropdown and verify available options',
      async () => {
        await settingsModal.theme.click();
        const expectedThemes = Object.values(ThemeId).map((t) =>
          toTitleCase(t),
        );
        await settingsModalAssertion.assertThemeMenuOptions(...expectedThemes);
      },
    );

    await dialTest.step(
      'Verify keyboard shortcuts section has two radio button options',
      async () => {
        await settingsModalAssertion.assertKeyboardShortcutsCount(2);
        await settingsModalAssertion.assertKeyboardShortcutRadioButtonLabel(
          EnterType.Enter,
          ExpectedConstants.enterKeyboardShortcut,
        );
        await settingsModalAssertion.assertKeyboardShortcutRadioButtonLabel(
          EnterType.CtrlEnter,
          ExpectedConstants.ctrlEnterKeyboardShortcut,
        );
      },
    );

    await dialTest.step(
      "Verify 'Enter - send message, Shift + Enter - new line' option is selected by default",
      async () => {
        await settingsModalAssertion.assertKeyboardShortcutState(
          EnterType.Enter,
          CheckboxState.checked,
        );
        await settingsModalAssertion.assertKeyboardShortcutState(
          EnterType.CtrlEnter,
          CheckboxState.unchecked,
        );
      },
    );
  },
);

dialTest(
  `By default "Full width chat" is off.\n` +
    `Chat when "Full width chat" is on.\n` +
    `Chat when "Full width chat" is on and then off`,
  async ({
    dialHomePage,
    accountSettings,
    accountDropdownMenu,
    setTestIds,
    settingsModal,
    chatMessagesAssertion,
    sendMessage,
    settingsModalAssertion,
    sendMessageAssertion,
    chatHeaderAssertion,
    conversationData,
    dataInjector,
    conversations,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1704', 'EPMRTC-1705', 'EPMRTC-1708');
    let sendMessageInputInitWidth: number;
    let conversation: Conversation;

    await dialTest.step(
      'Create conversation with more than 160 symbols name and message',
      async () => {
        const request = GeneratorUtil.randomString(170);
        const name = GeneratorUtil.randomString(170);
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          [request],
          ModelsUtil.getDefaultAgent()!,
          name,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open account settings and verify "Full width chat" is toggled-off by default',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModalAssertion.assertFullWidthChatToggleState(
          ToggleState.off,
        );
        await settingsModalAssertion.assertFullWidthChatToggleColor(
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer4),
        );
      },
    );

    await dialTest.step(
      'Set "Full width chat" to true and verify toggle state is changed',
      async () => {
        await settingsModal.fullWidthChatToggle.click();
        await settingsModalAssertion.assertFullWidthChatToggleState(
          ToggleState.on,
        );
      },
    );

    await dialTest.step(
      'Save changes and verify width of chat message box, history messages, chat name become wider',
      async () => {
        sendMessageInputInitWidth = await getElementWidth(sendMessage);
        await settingsModal.saveButton.click();
        await chatHeaderAssertion.assertHeaderWidth({ hasFullWidth: true });
        await chatMessagesAssertion.assertMessagesWidth({ hasFullWidth: true });
        await sendMessageAssertion.assertSendMessageWidth(
          sendMessageInputInitWidth,
          { hasFullWidth: true },
        );
      },
    );

    await dialTest.step(
      'Set "Full width chat" to false and verify toggle state is changed',
      async () => {
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModal.fullWidthChatToggle.click();
        await settingsModalAssertion.assertFullWidthChatToggleState(
          ToggleState.off,
        );
      },
    );

    await dialTest.step(
      'Save changes and verify width of chat message box, history messages, chat name become narrower',
      async () => {
        await settingsModal.saveButton.click();
        await chatHeaderAssertion.assertHeaderWidth({ hasFullWidth: false });
        await chatMessagesAssertion.assertMessagesWidth({
          hasFullWidth: false,
        });
        await sendMessageAssertion.assertSendMessageWidth(
          sendMessageInputInitWidth,
          { hasFullWidth: false },
        );
      },
    );
  },
);

dialTest(
  '[Keyboard shortcuts] Use Shift + Enter to move cursor to the new row.\n' +
    '[Keyboard shortcuts] Use Enter to send message and Shift + Enter to move cursor to the new row while EDITING already sent message',
  async ({
    dialHomePage,
    localStorageManager,
    conversationData,
    dataInjector,
    conversations,
    sendMessage,
    sendMessageAssertion,
    chatMessages,
    chatMessagesAssertion,
    setTestIds,
    page,
  }) => {
    setTestIds('EPMRTC-8042', 'EPMRTC-8046');

    const newLinesCount = 4;
    let conversation: Conversation;
    let expectedMessage: string;

    await dialTest.step('Prepare conversation with a message', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open home page and navigate to the conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
      },
    );

    await dialTest.step(
      'Focus message input and press Shift + Enter several times',
      async () => {
        await sendMessage.fillRequestData();
        for (let i = 1; i <= newLinesCount; i++) {
          await page.keyboard.press(keys.shiftPlusEnter);
        }
      },
    );

    await dialTest.step(
      'Verify cursor moved to new rows in the message input',
      async () => {
        await sendMessageAssertion.assertMessageValue(
          '\n'.repeat(newLinesCount),
        );
      },
    );

    await dialTest.step('Open edit mode for the user message', async () => {
      await chatMessages.openEditMessageMode(1);
    });

    await dialTest.step(
      'Set cursor in the edit input and press Shift + Enter several times',
      async () => {
        await chatMessages.getChatMessageTextarea(1).click();
        await page.keyboard.press(keys.end);
        for (let i = 1; i <= newLinesCount; i++) {
          await page.keyboard.press(keys.shiftPlusEnter);
        }
      },
    );

    await dialTest.step(
      'Verify cursor moved to new rows in the edit input',
      async () => {
        expectedMessage =
          conversation.messages[0].content + '\n'.repeat(newLinesCount);
        await chatMessagesAssertion.assertElementText(
          chatMessages.getChatMessageTextarea(1),
          expectedMessage,
        );
      },
    );

    await dialTest.step(
      'Type text, press Enter and verify message is updated and sent',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await page.keyboard.press(keys.enter);
        await chatMessagesAssertion.assertEditMessageInputState(1, 'hidden');
        await chatMessagesAssertion.assertMessagesCount(2);
        await chatMessagesAssertion.assertMessageContent(1, expectedMessage);
      },
    );
  },
);

dialTest(
  '[Keyboard shortcuts] Use Ctrl + Enter to send message and Enter to move cursor to the new row.\n' +
    '[Keyboard shortcuts] Use Ctrl + Enter to send message and Enter to move cursor to the new row while EDITING already sent message',
  async ({
    dialHomePage,
    localStorageManager,
    sendMessage,
    chatMessages,
    chat,
    chatMessagesAssertion,
    settingsModal,
    accountSettings,
    accountDropdownMenu,
    fileApiHelper,
    setTestIds,
    page,
  }) => {
    setTestIds('EPMRTC-8044', 'EPMRTC-8045');

    const newLinesCount = 4;
    const randomRequest = GeneratorUtil.randomString(5);
    const firstExpectedMessage = '\n'
      .repeat(newLinesCount)
      .concat(randomRequest);
    const secondExpectedMessage = '\n'
      .repeat(newLinesCount)
      .concat(firstExpectedMessage);

    await dialTest.step('Add some model to the users workspace', async () => {
      const randomModel = GeneratorUtil.randomArrayElement(
        ModelsUtil.getModels(),
      );
      await fileApiHelper.updateInstalledDeployments([randomModel]);
      await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
        randomModel,
      );
    });

    await dialTest.step(
      'Open home page, open account settings modal and set Ctrl+Enter as keyboard shortcuts',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModal
          .keyboardShortcutRadioButtonByValue(EnterType.CtrlEnter)
          .click();
        await settingsModal.saveButton.click();
      },
    );

    await dialTest.step(
      'Focus message input and press Enter several times',
      async () => {
        await sendMessage.messageInput.click();
        for (let i = 1; i <= newLinesCount; i++) {
          await page.keyboard.press(keys.enter);
        }
        await sendMessage.typeInInput(randomRequest);
      },
    );

    await dialTest.step(
      'Enter some text, press Ctrl+Enter and verify request is sent',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequest(randomRequest, () =>
          page.keyboard.press(keys.ctrlPlusEnter),
        );
      },
    );

    await dialTest.step('Verify message content', async () => {
      await chatMessagesAssertion.assertMessagesCount(2);
      await chatMessagesAssertion.assertMessageContent(1, firstExpectedMessage);
    });

    await dialTest.step('Open edit mode for the user message', async () => {
      await chatMessages.openEditMessageMode(1);
    });

    await dialTest.step(
      'Set cursor in the edit input and press Enter several times',
      async () => {
        await chatMessages.getChatMessageTextarea(1).click();
        await page.keyboard.press(keys.home);
        for (let i = 1; i <= newLinesCount; i++) {
          await page.keyboard.press(keys.enter);
        }
      },
    );

    await dialTest.step(
      'Verify cursor moved to new rows in the edit input',
      async () => {
        await chatMessagesAssertion.assertElementText(
          chatMessages.getChatMessageTextarea(1),
          secondExpectedMessage,
        );
      },
    );

    await dialTest.step(
      'Press Ctrl+Enter and verify message is updated and sent',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await page.keyboard.press(keys.ctrlPlusEnter);
        await chatMessagesAssertion.assertEditMessageInputState(1, 'hidden');
        await chatMessagesAssertion.assertMessagesCount(2);
        await chatMessagesAssertion.assertMessageContent(
          1,
          secondExpectedMessage,
        );
      },
    );
  },
);

dialTest(
  '[Keyboard shortcuts] Message is send on Enter for the desktop < 1280px',
  async ({
    dialHomePage,
    sendMessage,
    settingsModalAssertion,
    chatMessagesAssertion,
    accountSettings,
    accountDropdownMenu,
    setTestIds,
    page,
  }) => {
    setTestIds('EPMRTC-8245');
    const randomRequest = GeneratorUtil.randomString(5);

    await dialTest.step(
      'Change browser resolution and open home page',
      async () => {
        await page.setViewportSize({ width: 1200, height: 600 });
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
      },
    );

    await dialTest.step(
      'Type any text, press Enter and verify request is sent',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await sendMessage.sendWithEnterKey(randomRequest);
        await chatMessagesAssertion.assertMessagesCount(2);
        await chatMessagesAssertion.assertMessageContent(1, randomRequest);
      },
    );

    await dialTest.step(
      'Open account settings modal and verify Keyboard shortcuts are available',
      async () => {
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModalAssertion.assertKeyboardShortcutsCount(2);
        await settingsModalAssertion.assertKeyboardShortcutRadioButtonLabel(
          EnterType.Enter,
          ExpectedConstants.enterKeyboardShortcut,
        );
        await settingsModalAssertion.assertKeyboardShortcutRadioButtonLabel(
          EnterType.CtrlEnter,
          ExpectedConstants.ctrlEnterKeyboardShortcut,
        );
      },
    );
  },
);
