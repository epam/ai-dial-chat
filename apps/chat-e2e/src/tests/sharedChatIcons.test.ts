import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
  TestConversation,
} from '@/src/testData';
import { Colors, Overflow, Styles } from '@/src/ui/domData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Shared icon does not appear in chat model icon if to click on copy button.\n' +
    'Shared URL is copied using Ctrl+A, Ctrl+C\n' +
    'Share chat: tooltip for long chat name.\n' +
    'Share chat: tooltip for URL.\n' +
    'Share chat: copy button changes.\n' +
    'Shared URL is copied if to click on copy button.\n' +
    'Shared chat link is always different.\n' +
    'Error appears if shared chat link is opened by its owner',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    shareModal,
    localStorageManager,
    tooltip,
    page,
    sendMessage,
    errorToast,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-1502',
      'EPMRTC-1503',
      'EPMRTC-1508',
      'EPMRTC-1509',
      'EPMRTC-1512',
      'EPMRTC-2745',
      'EPMRTC-1820',
      'EPMRTC-2747',
    );
    let conversation: TestConversation;
    let firstShareLinkResponse: ShareByLinkResponseModel;
    let secondShareLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare default conversation', async () => {
      conversation = await conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Open conversation dropdown menu and choose "Share" option',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(conversation.name);
        const firstShareLinkResponseText = await conversations.selectMenuOption(
          MenuOptions.share,
        );
        firstShareLinkResponse =
          firstShareLinkResponseText as ShareByLinkResponseModel;
      },
    );

    await dialTest.step(
      'Hover over "Cancel" and "Copy" buttons and verify they are highlighted with blue color',
      async () => {
        await shareModal.linkInputLoader.waitForState({ state: 'hidden' });
        await shareModal.closeButton.hoverOver();
        const closeButtonColor =
          await shareModal.closeButton.getComputedStyleProperty(Styles.color);
        expect
          .soft(closeButtonColor[0], ExpectedMessages.buttonColorIsValid)
          .toBe(Colors.controlsBackgroundAccent);

        await shareModal.copyLinkButton.hoverOver();
        const copyButtonColor =
          await shareModal.copyLinkButton.getComputedStyleProperty(
            Styles.color,
          );
        expect
          .soft(copyButtonColor[0], ExpectedMessages.buttonColorIsValid)
          .toBe(Colors.controlsBackgroundAccent);

        const copyLinkTooltip = await tooltip.getContent();
        expect
          .soft(copyLinkTooltip, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.copyUrlTooltip);
      },
    );

    await dialTest.step(
      'Verify chat name is truncated with dots and full name is shown on hover',
      async () => {
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
          .toBe(ExpectedConstants.sharedConversationName(conversation.name));

        const isTooltipChatNameTruncated =
          await tooltip.isElementWidthTruncated();
        expect
          .soft(
            isTooltipChatNameTruncated,
            ExpectedMessages.chatNameIsFullyVisible,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Verify URL is truncated with dots and full URL is shown on hover',
      async () => {
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
      },
    );

    await dialTest.step(
      'Set cursor in URL input, press Ctrl+A/Ctrl+C and verify url is copied to buffer',
      async () => {
        await shareModal.shareLinkInput.click();
        await page.keyboard.press(keys.ctrlPlusA);
        await page.keyboard.press(keys.ctrlPlusC);
        await shareModal.closeButton.click();
        await sendMessage.pasteDataIntoMessageInput();
        const actualCopiedLink = await sendMessage.getMessage();
        expect
          .soft(actualCopiedLink, ExpectedMessages.shareConversationLinkIsValid)
          .toBe(
            ExpectedConstants.sharedConversationPath(
              firstShareLinkResponse.invitationLink,
            ),
          );
      },
    );

    await dialTest.step(
      'Open Share modal again, click "Copy" button and verify the link is different from the previous, no shared icon appears on conversation',
      async () => {
        await conversations.openConversationDropdownMenu(conversation.name);
        secondShareLinkResponse = (await conversations.selectMenuOption(
          MenuOptions.share,
        )) as ShareByLinkResponseModel;
        await shareModal.linkInputLoader.waitForState({ state: 'hidden' });
        expect
          .soft(
            firstShareLinkResponse.invitationLink !==
              secondShareLinkResponse.invitationLink,
            ExpectedMessages.sharedInvitationLinkIsUnique,
          )
          .toBeTruthy();

        const isArrowIconVisible = await conversations
          .getConversationArrowIcon(ExpectedConstants.newConversationTitle)
          .isVisible();
        expect
          .soft(
            isArrowIconVisible,
            ExpectedMessages.sharedConversationIconIsNotVisible,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Open shared link by current user and verify error is shown',
      async () => {
        await dialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationPath(
            secondShareLinkResponse.invitationLink,
          ),
        );
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.shareInviteAcceptanceErrorShown)
          .toBe(ExpectedConstants.shareInviteAcceptanceFailureMessage);
      },
    );
  },
);

dialTest(
  'Shared icon appears in chat model icon if to copy using Ctrl+A, Ctrl+C.\n' +
    'Shared icon in chat header and response does not appear.\n' +
    'Shared icon stays in chat name if to continue the conversation.\n',
  async ({
    dialHomePage,
    conversations,
    chatHeader,
    conversationDropdownMenu,
    shareModal,
    page,
    conversationData,
    localStorageManager,
    dataInjector,
    chatMessages,
    talkToSelector,
    chat,
    tooltip,
    conversationSettings,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1503', 'EPMRTC-1601', 'EPMRTC-1514');
    let conversation: TestConversation;
    const conversationName = GeneratorUtil.randomString(60);

    await dialTest.step('Prepare default conversation', async () => {
      conversation = await conversationData.prepareDefaultConversation(
        ModelsUtil.getDefaultModel(),
        conversationName,
      );
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Open conversation dropdown menu and choose "Share" option',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(conversation.name);
        await conversations.selectMenuOption(MenuOptions.share);
      },
    );

    //
    // await dialTest.step(
    //   'Close modal window and verify green shared icon appears on model icon',
    //   async () => {
    //     await shareModal.closeButton.click();
    //     await conversations
    //       .getConversationArrowIcon(conversation.name)
    //       .waitFor();
    //     const arrowIconColor =
    //       await conversations.getConversationArrowIconColor(conversation.name);
    //     expect
    //       .soft(arrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
    //       .toBe(Colors.textAccentSecondary);
    //   },
    // );
    //
    // await dialTest.step(
    //   'Verify no shared icon shown in chat header and chat response',
    //   async () => {
    //     const isArrowIconVisibleInHeader =
    //       await chatHeader.isArrowIconVisible();
    //     expect
    //       .soft(
    //         isArrowIconVisibleInHeader,
    //         ExpectedMessages.sharedConversationIconIsNotVisible,
    //       )
    //       .toBeFalsy();
    //
    //     const isArrowIconVisibleInResponse =
    //       await chatMessages.isArrowIconVisibleForMessage();
    //     expect
    //       .soft(
    //         isArrowIconVisibleInResponse,
    //         ExpectedMessages.sharedConversationIconIsNotVisible,
    //       )
    //       .toBeFalsy();
    //   },
    // );
    //
    // await dialTest.step(
    //   'Change chat model, send a new request and verify share icon is preserved on chat bar',
    //   async () => {
    //     const updatedModel = ModelsUtil.getModel(ModelIds.GPT_4)!;
    //     await chatHeader.openConversationSettingsPopup();
    //     await talkToSelector.waitForState();
    //     await talkToSelector.selectModel(updatedModel.name);
    //     await chat.applyNewEntity();
    //     await conversationSettings.waitForState({ state: 'hidden' });
    //     await chat.sendRequestWithButton('1+2', false);
    //     await conversations
    //       .getConversationArrowIcon(conversation.name)
    //       .waitFor();
    //   },
    // );
  },
);

dialTest.skip(
  'Shared icon does not appear in chat model icon if to create replay or playback',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    conversationDropdownMenu,
    localStorageManager,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1510');
    let conversation: TestConversation;

    await dialTest.step('Prepare shared conversation', async () => {
      conversation = conversationData.prepareDefaultSharedConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Create replay and playback conversations based on shared one and verify no arrow icon is shown for them',
      async () => {
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
      },
    );
  },
);

dialTest.skip(
  'Shared icon is blue in Select conversation to compare.\n' +
    'Share chat: tooltip on shared model icon',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    conversationDropdownMenu,
    localStorageManager,
    dataInjector,
    compareConversationSelector,
    tooltip,
    compareConversation,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1600', 'EPMRTC-1511');
    let notSharedConversation: TestConversation;
    let sharedConversation: TestConversation;

    await dialTest.step(
      'Prepare one shared and one not shared conversations',
      async () => {
        notSharedConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        sharedConversation =
          conversationData.prepareDefaultSharedConversation();
        await dataInjector.createConversations([
          notSharedConversation,
          sharedConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          notSharedConversation,
        );
      },
    );

    await dialTest.step(
      'Open Compare mode for not shared conversation and verify shared conversation has blue arrow in Compare dropdown list',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(
          notSharedConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.checkShowAllConversations();
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
      },
    );

    await dialTest.step(
      'Hover over arrow in the dropdown list option and verify tooltip shown',
      async () => {
        await compareConversationSelector
          .getOptionAdditionalIcon(sharedConversation.name)
          .hover();
        const tooltipChatName = await tooltip.getContent();
        expect
          .soft(tooltipChatName, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.sharedConversationTooltip);
      },
    );
  },
);
