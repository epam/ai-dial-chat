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
import { BucketUtil, GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest.beforeEach(async ({ additionalUserItemApiHelper }) => {
  await additionalUserItemApiHelper.deleteAllData(
    BucketUtil.getAdditionalShareUserBucket(),
  );
});

dialTest(
  'Shared icon does not appear in chat model icon if to click on copy button.\n' +
    'Shared URL is copied using Ctrl+A, Ctrl+C\n' +
    'Share chat: tooltip for long chat name.\n' +
    'Share chat: tooltip for URL.\n' +
    'Share chat: copy button changes.\n' +
    'Shared URL is copied if to click on copy button.\n' +
    'Shared chat link is always different.\n' +
    'Error appears if shared chat link is opened by its owner.\n' +
    'Shared icon appears in chat model icon if another user clicks on the link.\n' +
    'Shared icon in chat header and response does not appear',
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
    additionalUserShareApiHelper,
    chatHeader,
    chatMessages,
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
      'EPMRTC-1505',
      'EPMRTC-1601',
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
            ExpectedConstants.sharedConversationUrl(
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
          ExpectedConstants.sharedConversationUrl(
            secondShareLinkResponse.invitationLink,
          ),
        );
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.shareInviteAcceptanceErrorShown)
          .toBe(ExpectedConstants.shareInviteAcceptanceFailureMessage);
      },
    );

    await dialTest.step(
      'Accept invitation link by another user and verify arrow icon appears on conversation icon of the current user',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(
          secondShareLinkResponse,
        );
        await dialHomePage.reloadPage();
        await conversations
          .getConversationArrowIcon(conversation.name)
          .waitFor();
        const arrowIconColor =
          await conversations.getConversationArrowIconColor(conversation.name);
        expect
          .soft(arrowIconColor[0], ExpectedMessages.sharedIconColorIsValid)
          .toBe(Colors.textAccentSecondary);
      },
    );

    await dialTest.step(
      'Verify no shared icon shown in chat header and chat response',
      async () => {
        const isArrowIconVisibleInHeader =
          await chatHeader.isArrowIconVisible();
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
      },
    );
  },
);

dialTest(
  'Shared icon stays in chat if to continue the conversation.\n' +
    'Shared icon disappears from chat if to rename conversation.\n' +
    'Shared icon disappears from chat if to change model',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    localStorageManager,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1514', 'EPMRTC-2750', 'EPMRTC-2751');
    let firstConversationToShare: TestConversation;
    let secondConversationToShare: TestConversation;
    let thirdConversationToShare: TestConversation;

    await dialTest.step(
      'Prepare default conversation and share it with another user.\n' +
        'Shared icon disappears from chat if to rename conversation.\n' +
        'Shared icon disappears from chat if to change model',
      async () => {
        firstConversationToShare =
          await conversationData.prepareDefaultConversation();
        conversationData.resetData();
        secondConversationToShare =
          await conversationData.prepareDefaultConversation();
        conversationData.resetData();
        thirdConversationToShare =
          await conversationData.prepareDefaultConversation();
        const conversationsToShare = [
          firstConversationToShare,
          secondConversationToShare,
          thirdConversationToShare,
        ];

        await dataInjector.createConversations(conversationsToShare);
        await localStorageManager.setSelectedConversation(
          firstConversationToShare,
        );

        for (const conversation of conversationsToShare) {
          const shareByLinkResponse =
            await mainUserShareApiHelper.shareConversationByLink(conversation);
          await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        }
      },
    );

    await dialTest.step(
      'Update conversation settings for the 1st shared conversation, conversation name for the 2nd conversation and model for the 3rd conversation',
      async () => {
        const addons = ModelsUtil.getAddons();
        firstConversationToShare.prompt = 'repeat the same';
        firstConversationToShare.temperature = 0.5;
        firstConversationToShare.selectedAddons = addons ? [addons[0].id] : [];

        secondConversationToShare.name = GeneratorUtil.randomString(7);

        thirdConversationToShare.model.id = ModelIds.GPT_4;
        await dataInjector.updateConversations([
          firstConversationToShare,
          secondConversationToShare,
          thirdConversationToShare,
        ]);
      },
    );

    await dialTest.step(
      'Open app and verify arrow icon is preserved only for the 1st conversation with updated settings',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations
          .getConversationArrowIcon(firstConversationToShare.name)
          .waitFor();
        for (const conversation of [
          secondConversationToShare,
          thirdConversationToShare,
        ]) {
          const isArrowIconVisible = await conversations
            .getConversationArrowIcon(conversation.name)
            .isVisible();
          expect
            .soft(
              isArrowIconVisible,
              ExpectedMessages.sharedConversationIconIsNotVisible,
            )
            .toBeFalsy();
        }
      },
    );
  },
);

dialTest(
  'Shared icon does not appear in chat model icon if to create replay or playback.\n' +
    'Shared icon does not appear in chat if previously shared chat was deleted and new one with the same name and model created',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    localStorageManager,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    itemApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1510', 'EPMRTC-2002');
    let conversation: TestConversation;
    let replayConversation: TestConversation;
    let playbackConversation: TestConversation;
    let conversationToDelete: TestConversation;

    await dialTest.step(
      'Prepare shared conversation and replay and playback conversations based on it',
      async () => {
        conversation = await conversationData.prepareDefaultConversation();
        conversationData.resetData();

        replayConversation =
          await conversationData.prepareDefaultReplayConversation(conversation);
        conversationData.resetData();

        playbackConversation =
          await conversationData.prepareDefaultPlaybackConversation(
            conversation,
          );
        conversationData.resetData();

        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);

        const shareByLinkResponse =
          await mainUserShareApiHelper.shareConversationByLink(conversation);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);

        await dataInjector.createConversations([
          replayConversation,
          playbackConversation,
        ]);
      },
    );

    await dialTest.step(
      'Prepare one more conversation, delete it and recreate with the same data',
      async () => {
        const conversationToDeleteName = GeneratorUtil.randomString(7);
        conversationToDelete =
          await conversationData.prepareDefaultConversation(
            ModelIds.GPT_4,
            conversationToDeleteName,
          );
        conversationData.resetData();
        await dataInjector.createConversations([conversationToDelete]);

        const shareByLinkResponse =
          await mainUserShareApiHelper.shareConversationByLink(
            conversationToDelete,
          );
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        await itemApiHelper.deleteConversation(conversationToDelete);

        conversationToDelete =
          await conversationData.prepareDefaultConversation(
            ModelIds.GPT_4,
            conversationToDeleteName,
          );
        await dataInjector.createConversations([conversationToDelete]);
      },
    );

    await dialTest.step(
      'Open app and verify no arrow icon is shown for conversations',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const conversation of [
          replayConversation,
          playbackConversation,
          conversationToDelete,
        ]) {
          const isArrowIconVisible = await conversations
            .getConversationArrowIcon(conversation.name)
            .isVisible();
          expect
            .soft(
              isArrowIconVisible,
              ExpectedMessages.sharedConversationIconIsNotVisible,
            )
            .toBeFalsy();
        }
      },
    );
  },
);

dialTest(
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
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1600', 'EPMRTC-1511');
    let firstSharedConversation: TestConversation;
    let secondSharedConversation: TestConversation;

    await dialTest.step('Prepare two shared conversations', async () => {
      firstSharedConversation =
        await conversationData.prepareDefaultConversation();
      conversationData.resetData();
      secondSharedConversation =
        await conversationData.prepareDefaultConversation();

      const conversationsToShare = [
        firstSharedConversation,
        secondSharedConversation,
      ];

      await dataInjector.createConversations(conversationsToShare);
      await localStorageManager.setSelectedConversation(
        firstSharedConversation,
      );

      for (const conversation of conversationsToShare) {
        const shareByLinkResponse =
          await mainUserShareApiHelper.shareConversationByLink(conversation);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      }
    });

    await dialTest.step(
      'Open Compare mode for shared conversation and verify shared conversation has blue arrow in Compare dropdown list',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(
          firstSharedConversation.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.compare);
        await compareConversation.checkShowAllConversations();
        await compareConversationSelector.click();
        await compareConversationSelector
          .getOptionAdditionalIcon(secondSharedConversation.name)
          .waitFor();
        const arrowIconColor =
          await compareConversationSelector.getOptionArrowIconColor(
            secondSharedConversation.name,
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
          .getOptionAdditionalIcon(secondSharedConversation.name)
          .hover();
        const sharedTooltip = await tooltip.getContent();
        expect
          .soft(sharedTooltip, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.sharedConversationTooltip);
      },
    );

    await dialTest.step(
      'Hover over arrow icon in the side bar conversation and verify tooltip shown',
      async () => {
        await conversations
          .getConversationArrowIcon(firstSharedConversation.name)
          .hover();
        const sharedTooltip = await tooltip.getContent();
        expect
          .soft(sharedTooltip, ExpectedMessages.tooltipContentIsValid)
          .toBe(ExpectedConstants.sharedConversationTooltip);
      },
    );
  },
);
