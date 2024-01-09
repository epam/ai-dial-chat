import { Conversation } from '@/src/types/chat';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
} from '@/e2e/src/testData';
import { Colors, Overflow, Styles } from '@/e2e/src/ui/domData';
import { keys } from '@/e2e/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

test(
  'Shared icon appears in chat model icon if to click on copy icon.\n' +
    'Share chat: copy button changes.\n' +
    'Shared icon does not appear in chat model icon if to close the pop-up on X button.\n' +
    'Shared icon does not appear in chat model icon if to close the pop-up on click out of it.\n' +
    'Shared icon appears only once if to click on copy several times',
  async ({
    dialHomePage,
    conversations,
    chatBar,
    conversationDropdownMenu,
    shareModal,
    tooltip,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-1502',
      'EPMRTC-1512',
      'EPMRTC-1505',
      'EPMRTC-1507',
      'EPMRTC-1506',
    );

    await test.step('Open conversation dropdown menu and choose "Share" option', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await conversations.openConversationDropdownMenu(
        ExpectedConstants.newConversationTitle,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.share);
    });

    await test.step('Hover over "Cancel" and copy buttons and verify they are highlighted with blue color', async () => {
      await shareModal.closeButton.hoverOver();
      const closeButtonColor =
        await shareModal.closeButton.getComputedStyleProperty(Styles.color);
      expect
        .soft(closeButtonColor[0], ExpectedMessages.buttonColorIsValid)
        .toBe(Colors.controlsBackgroundAccent);

      await shareModal.copyLinkButton.hoverOver();
      const copyButtonColor =
        await shareModal.copyLinkButton.getComputedStyleProperty(Styles.color);
      expect
        .soft(copyButtonColor[0], ExpectedMessages.buttonColorIsValid)
        .toBe(Colors.controlsBackgroundAccent);

      const copyLinkTooltip = await tooltip.getContent();
      expect
        .soft(copyLinkTooltip, ExpectedMessages.tooltipContentIsValid)
        .toBe(ExpectedConstants.copyUrlTooltip);
    });

    await test.step('Click on "Cancel" button in modal window and verify no shared icon appears on model icon', async () => {
      await shareModal.closeButton.click();
      const isArrowIconVisible = await conversations
        .getConversationArrowIcon(ExpectedConstants.newConversationTitle)
        .isVisible();
      expect
        .soft(isArrowIconVisible, ExpectedMessages.conversationIsNotShared)
        .toBeFalsy();
    });

    await test.step('Open Share modal again, click outside modal window area and verify no shared icon appears on model icon', async () => {
      await conversations.openConversationDropdownMenu(
        ExpectedConstants.newConversationTitle,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.share);
      await chatBar.draggableArea.click({ force: true });
      const isModalVisible = await shareModal.isVisible();
      expect
        .soft(isModalVisible, ExpectedMessages.modalWindowIsClosed)
        .toBeFalsy();

      const isArrowIconVisible = await conversations
        .getConversationArrowIcon(ExpectedConstants.newConversationTitle)
        .isVisible();
      expect
        .soft(isArrowIconVisible, ExpectedMessages.conversationIsNotShared)
        .toBeFalsy();
    });

    await test.step('Open Share modal again, click on "Copy" button in modal window, close it and verify green shared icon appears on model icon', async () => {
      await conversations.openConversationDropdownMenu(
        ExpectedConstants.newConversationTitle,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.share);
      await shareModal.copyLinkButton.click();
      await shareModal.closeButton.click();
      await conversations
        .getConversationArrowIcon(ExpectedConstants.newConversationTitle)
        .waitFor();
      const arrowIconColor = await conversations.getConversationArrowIconColor(
        ExpectedConstants.newConversationTitle,
      );
      expect
        .soft(arrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
        .toBe(Colors.textAccentSecondary);
    });

    await test.step('Open Share modal again, click on "Copy" button in modal window and verify only one green shared icon is shown on model icon', async () => {
      await conversations.openConversationDropdownMenu(
        ExpectedConstants.newConversationTitle,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.share);
      await shareModal.copyLinkButton.click();
      await shareModal.closeButton.click();
      const arrowIconsCount = await conversations
        .getConversationArrowIcon(ExpectedConstants.newConversationTitle)
        .count();
      expect
        .soft(arrowIconsCount, ExpectedMessages.entitiesIconsCountIsValid)
        .toBe(1);
    });
  },
);

test(
  'Shared icon appears in chat model icon if to copy using Ctrl+A, Ctrl+C.\n' +
    'Shared icon in chat header and response does not appear.\n' +
    'Shared icon stays in chat name if to continue the conversation.\n' +
    'Share chat: tooltip for long chat name.\n' +
    'Share chat: tooltip for URL',
  async ({
    dialHomePage,
    conversations,
    chatHeader,
    conversationDropdownMenu,
    shareModal,
    page,
    conversationData,
    localStorageManager,
    chatMessages,
    talkToSelector,
    chat,
    tooltip,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-1503',
      'EPMRTC-1601',
      'EPMRTC-1514',
      'EPMRTC-1508',
      'EPMRTC-1509',
    );
    let conversation: Conversation;
    const conversationName = GeneratorUtil.randomString(60);

    await test.step('Prepare default conversation', async () => {
      conversation = await conversationData.prepareDefaultConversation(
        ModelsUtil.getDefaultModel(),
        conversationName,
      );
      await localStorageManager.setConversationHistory(conversation);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await test.step('Open conversation dropdown menu and choose "Share" option', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.openConversationDropdownMenu(conversation.name);
      await conversationDropdownMenu.selectMenuOption(MenuOptions.share);
    });

    await test.step('Verify chat name is truncated with dots and full name is shown on hover', async () => {
      const chatNameOverflowProp =
        await shareModal.chatName.getComputedStyleProperty(
          Styles.overflow_wrap,
        );
      expect
        .soft(chatNameOverflowProp[0], ExpectedMessages.entityNameIsTruncated)
        .toBe(Overflow.breakWord);

      await shareModal.chatName.hoverOver();
      const tooltipChatName = await tooltip.getContent();
      expect
        .soft(tooltipChatName, ExpectedMessages.tooltipContentIsValid)
        .toBe(conversation.name);

      const isTooltipChatNameTruncated =
        await tooltip.isElementWidthTruncated();
      expect
        .soft(
          isTooltipChatNameTruncated,
          ExpectedMessages.chatNameIsFullyVisible,
        )
        .toBeFalsy();
    });

    await test.step('Verify URL is truncated with dots and full URL is shown on hover', async () => {
      const urlOverflowProp =
        await shareModal.shareLinkInput.getComputedStyleProperty(
          Styles.text_overflow,
        );
      expect
        .soft(urlOverflowProp[0], ExpectedMessages.entityNameIsTruncated)
        .toBe(Overflow.ellipsis);

      await shareModal.shareLinkInput.hoverOver();
      const isTooltipChatNameTruncated =
        await tooltip.isElementWidthTruncated();
      expect
        .soft(
          isTooltipChatNameTruncated,
          ExpectedMessages.shareLinkIsFullyVisible,
        )
        .toBeFalsy();
    });

    await test.step('Set cursor in URL input and press Ctrl+A/Ctrl+C', async () => {
      await shareModal.shareLinkInput.click();
      await page.keyboard.press(keys.ctrlPlusA);
      await page.keyboard.press(keys.ctrlPlusC);
    });

    await test.step('Close modal window and verify green shared icon appears on model icon', async () => {
      await shareModal.closeButton.click();
      await conversations.getConversationArrowIcon(conversation.name).waitFor();
      const arrowIconColor = await conversations.getConversationArrowIconColor(
        conversation.name,
      );
      expect
        .soft(arrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
        .toBe(Colors.textAccentSecondary);
    });

    await test.step('Verify no shared icon shown in chat header and chat response', async () => {
      const isArrowIconVisibleInHeader = await chatHeader.isArrowIconVisible();
      expect
        .soft(
          isArrowIconVisibleInHeader,
          ExpectedMessages.sharedConversationIconIsNotVisible,
        )
        .toBeFalsy();

      const isArrowIconVisibleInResponse =
        await chatMessages.isArrowIconVisibleForMessage();
      expect
        .soft(
          isArrowIconVisibleInResponse,
          ExpectedMessages.sharedConversationIconIsNotVisible,
        )
        .toBeFalsy();
    });

    await test.step('Change chat model, send a new request and verify share icon is preserved on chat bar', async () => {
      await chatHeader.openConversationSettingsPopup();
      await talkToSelector.waitForState();
      await talkToSelector.selectModel(
        ModelsUtil.getModel(ModelIds.GPT_4)!.name,
      );
      await chat.applyChanges().click();
      await chat.sendRequestWithButton('1+2=', false);
      await conversations.getConversationArrowIcon(conversation.name).waitFor();
    });
  },
);

test('Shared icon does not appear in chat model icon if to create replay or playback', async ({
  dialHomePage,
  conversations,
  conversationData,
  conversationDropdownMenu,
  localStorageManager,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1510');
  let conversation: Conversation;

  await test.step('Prepare shared conversation', async () => {
    conversation = conversationData.prepareDefaultSharedConversation();
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Create replay and playback conversations based on shared one and verify no arrow icon is shown for them', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(conversation.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
    await conversations.openConversationDropdownMenu(conversation.name, 2);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.playback);

    for (const chatName of [
      `${ExpectedConstants.replayConversation}${conversation.name}`,
      `${ExpectedConstants.playbackConversation}${conversation.name}`,
    ]) {
      const isArrowIconVisible = await conversations
        .getConversationArrowIcon(chatName)
        .isVisible();
      expect
        .soft(isArrowIconVisible, ExpectedMessages.conversationIsNotShared)
        .toBeFalsy();
    }
  });
});

test(
  'Shared icon is blue in Select conversation to compare.\n' +
    'Share chat: tooltip on shared model icon',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    conversationDropdownMenu,
    localStorageManager,
    compareConversationSelector,
    tooltip,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1600', 'EPMRTC-1511');
    let notSharedConversation: Conversation;
    let sharedConversation: Conversation;

    await test.step('Prepare one shared and one not shared conversations', async () => {
      notSharedConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      sharedConversation = conversationData.prepareDefaultSharedConversation();
      await localStorageManager.setConversationHistory(
        notSharedConversation,
        sharedConversation,
      );
      await localStorageManager.setSelectedConversation(notSharedConversation);
    });

    await test.step('Open Compare mode for not shared conversation and verify shared conversation has blue arrow in Compare dropdown list', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await conversations.openConversationDropdownMenu(
        notSharedConversation.name,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
      await compareConversationSelector.click();
      await compareConversationSelector
        .getOptionAdditionalIcon(sharedConversation.name)
        .waitFor();
      const arrowIconColor =
        await compareConversationSelector.getOptionArrowIconColor(
          sharedConversation.name,
        );
      expect
        .soft(arrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
        .toBe(Colors.controlsBackgroundAccent);
    });

    await test.step('Hover over arrow in the dropdown list option and verify tooltop shown', async () => {
      await compareConversationSelector
        .getOptionAdditionalIcon(sharedConversation.name)
        .hover();
      const tooltipChatName = await tooltip.getContent();
      expect
        .soft(tooltipChatName, ExpectedMessages.tooltipContentIsValid)
        .toBe(ExpectedConstants.sharedConversationTooltip);
    });
  },
);
