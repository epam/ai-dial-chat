import { Conversation } from '@/chat/types/chat';
import dialTest from '@/src/core/dialFixtures';
import {
  AccountMenuOptions,
  Theme,
  ToggleState,
  toTitleCase,
} from '@/src/testData';
import { Colors, Styles } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

dialTest(
  'Menu on user name',
  async ({
    dialHomePage,
    accountSettings,
    accountDropdownMenuAssertion,
    setTestIds,
    chatBar,
    accountSettingsAssertion,
  }) => {
    setTestIds('EPMRTC-812');

    await dialTest.step(
      'Open account menu and verify icon is changed to expanded',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await accountSettings.openAccountDropdownMenu();
        await accountSettingsAssertion.assertCaretState('expanded');
      },
    );

    await dialTest.step('Verify account menu options', async () => {
      await accountDropdownMenuAssertion.assertMenuOptions(
        Object.values(AccountMenuOptions),
      );
    });

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
  'Settings: available themes',
  async ({
    dialHomePage,
    accountSettings,
    accountDropdownMenu,
    settingsModalAssertion,
    setTestIds,
    settingsModal,
  }) => {
    setTestIds('EPMRTC-360');

    await dialTest.step(
      'Open account settings and verify "Theme" field has "Dark" value, "Save" button is available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModalAssertion.assertThemeValue(Theme.dark);
        await settingsModalAssertion.assertSaveButtonState('visible');
      },
    );

    await dialTest.step(
      'Expand "Theme" dropdown and verify available options',
      async () => {
        await settingsModal.theme.click();
        const expectedThemes = Object.values(Theme).map((t) => toTitleCase(t));
        await settingsModalAssertion.assertThemeMenuOptions(...expectedThemes);
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
          ModelsUtil.getDefaultModel()!,
          [request],
          name,
        );
        await dataInjector.createConversations([conversation]);
      },
    );

    await dialTest.step(
      'Open account settings and verify "Full width chat" is toggled-off by default',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(conversation.name);
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await settingsModalAssertion.assertFullWidthChatToggleState(
          ToggleState.off,
        );
        await settingsModalAssertion.assertFullWidthChatToggleColor(
          Colors.controlsTextDisable,
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
        sendMessageInputInitWidth = await sendMessage
          .getComputedStyleProperty(Styles.width)
          .then((w) => +w[0].replace('px', ''));
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
