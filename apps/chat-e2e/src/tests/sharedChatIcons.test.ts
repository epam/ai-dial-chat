import { Conversation } from '@/chat/types/chat';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  ModelIds,
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
    'Error appears if shared chat link is opened by its owner.\n' +
    'Shared icon appears in chat model icon if another user clicks on the link.\n' +
    'Share form text differs for chat and folder',
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
      'EPMRTC-1811',
    );
    let conversation: Conversation;
    let firstShareLinkResponse: ShareByLinkResponseModel;
    let secondShareLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare default conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Open conversation dropdown menu and choose "Share" option and verify modal window text',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openConversationDropdownMenu(conversation.name);
        const firstShareRequestResponse = await conversations.selectMenuOption(
          MenuOptions.share,
        );
        firstShareLinkResponse = firstShareRequestResponse!.response;
        await shareModal.linkInputLoader.waitForState({ state: 'hidden' });
        expect
          .soft(
            await shareModal.getShareTextContent(),
            ExpectedMessages.sharedModalTextIsValid,
          )
          .toBe(ExpectedConstants.shareConversationText);
      },
    );

    await dialTest.step(
      'Hover over "Cancel" and "Copy" buttons and verify they are highlighted with blue color',
      async () => {
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
        const secondShareRequestResponse = await conversations.selectMenuOption(
          MenuOptions.share,
        );
        secondShareLinkResponse = secondShareRequestResponse!.response;
        await shareModal.linkInputLoader.waitForState({ state: 'hidden' });
        expect
          .soft(
            firstShareLinkResponse.invitationLink !==
              secondShareLinkResponse.invitationLink,
            ExpectedMessages.sharedInvitationLinkIsUnique,
          )
          .toBeTruthy();
        expect
          .soft(
            secondShareRequestResponse!.request.resources.length,
            ExpectedMessages.sharedResourcesCountIsValid,
          )
          .toBe(1);
        expect
          .soft(
            secondShareRequestResponse!.request.resources.find(
              (r) => r.url === conversation.id,
            ),
            ExpectedMessages.conversationUrlIsValid,
          )
          .toBeDefined();

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
    'Shared icon disappears from chat if to change model.\n' +
    'Shared chat disappears from Shared with me if the original was changed the model',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1514', 'EPMRTC-2750', 'EPMRTC-2751', 'EPMRTC-2774');
    let firstConversationToShare: Conversation;
    let secondConversationToShare: Conversation;
    let thirdConversationToShare: Conversation;

    await dialTest.step(
      'Prepare three conversations and share them with another user',
      async () => {
        firstConversationToShare =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();
        secondConversationToShare =
          conversationData.prepareDefaultConversation();
        conversationData.resetData();
        thirdConversationToShare =
          conversationData.prepareDefaultConversation();
        const conversationsToShare = [
          firstConversationToShare,
          secondConversationToShare,
          thirdConversationToShare,
        ];

        await dataInjector.createConversations(conversationsToShare);

        for (const conversation of conversationsToShare) {
          const shareByLinkResponse =
            await mainUserShareApiHelper.shareEntityByLink([conversation]);
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

        const secondUpdatedName = GeneratorUtil.randomString(7);
        secondConversationToShare.id = secondConversationToShare.id.replace(
          secondConversationToShare.name,
          secondUpdatedName,
        );
        secondConversationToShare.name = secondConversationToShare.name.replace(
          secondConversationToShare.name,
          secondUpdatedName,
        );
        secondConversationToShare.isNameChanged = true;

        thirdConversationToShare.id = thirdConversationToShare.id.replace(
          thirdConversationToShare.model.id,
          ModelIds.GPT_4,
        );

        thirdConversationToShare.model.id =
          thirdConversationToShare.model.id.replace(
            thirdConversationToShare.model.id,
            ModelIds.GPT_4,
          );

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

    await dialSharedWithMeTest.step(
      'Verify only conversation with updated settings is shared with user',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        expect
          .soft(
            sharedEntities.resources.find(
              (e) => e.url === firstConversationToShare.id,
            ),
            ExpectedMessages.conversationIsShared,
          )
          .toBeDefined();

        for (const sharedConversation of [
          secondConversationToShare,
          thirdConversationToShare,
        ]) {
          expect
            .soft(
              sharedEntities.resources.find(
                (e) => e.url === sharedConversation.id,
              ),
              ExpectedMessages.conversationIsNotShared,
            )
            .toBeUndefined();
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
    let conversation: Conversation;
    let replayConversation: Conversation;
    let playbackConversation: Conversation;
    let conversationToDelete: Conversation;

    await dialTest.step(
      'Prepare shared conversation and replay and playback conversations based on it',
      async () => {
        conversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();

        replayConversation =
          conversationData.prepareDefaultReplayConversation(conversation);
        conversationData.resetData();

        playbackConversation =
          conversationData.prepareDefaultPlaybackConversation(conversation);
        conversationData.resetData();

        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);

        const shareByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([conversation]);
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
        conversationToDelete = conversationData.prepareDefaultConversation(
          ModelIds.GPT_4,
          conversationToDeleteName,
        );
        conversationData.resetData();
        await dataInjector.createConversations([conversationToDelete]);

        const shareByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([
            conversationToDelete,
          ]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        await itemApiHelper.deleteConversation(conversationToDelete);

        conversationToDelete = conversationData.prepareDefaultConversation(
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
    let firstSharedConversation: Conversation;
    let secondSharedConversation: Conversation;

    await dialTest.step('Prepare two shared conversations', async () => {
      firstSharedConversation = conversationData.prepareDefaultConversation();
      conversationData.resetData();
      secondSharedConversation = conversationData.prepareDefaultConversation();

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
          await mainUserShareApiHelper.shareEntityByLink([conversation]);
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

dialTest(
  'Shared icon in chat header and response does not appear.\n' +
    'Shared icon stays in chat if to cancel unshare.\n' +
    'Unshare item appears for shared chats only.\n' +
    'Shared icon disappears in chat if to unshare.\n' +
    'Error appears if chat was unshared, but user clicks on shared link.\n' +
    'Shared chat disappears from Shared with me if the original was unshared',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    conversationDropdownMenu,
    confirmationDialog,
    chatBar,
    chat,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-2748',
      'EPMRTC-2746',
      'EPMRTC-2749',
      'EPMRTC-2765',
      'EPMRTC-2762',
    );
    let conversation: Conversation;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare shared conversation', async () => {
      conversation = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversation]);

      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        conversation,
      ]);
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
    });

    await dialTest.step(
      'Verify Share and Unshare options are displayed in dropdown menu for shared conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations
          .getConversationArrowIcon(conversation.name)
          .waitFor();
        await conversations.openConversationDropdownMenu(conversation.name);
        const actualMenuOptions =
          await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(actualMenuOptions, ExpectedMessages.contextMenuOptionsValid)
          .toEqual(
            expect.arrayContaining([MenuOptions.share, MenuOptions.unshare]),
          );
      },
    );

    await dialTest.step(
      'Select Unshare option for shared conversation, click cancel and verify arrow icon is still displayed',
      async () => {
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unshare);
        await confirmationDialog.cancelDialog();
        await conversations
          .getConversationArrowIcon(conversation.name)
          .waitFor();
      },
    );

    await dialTest.step(
      'Select Unshare option for shared conversation, click Revoke and verify arrow icon disappears',
      async () => {
        await conversations.openConversationDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unshare);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await conversations
          .getConversationArrowIcon(conversation.name)
          .waitFor({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Open conversation dropdown menu and verify only Share option is available',
      async () => {
        await conversations.openConversationDropdownMenu(conversation.name);
        const actualMenuOptions =
          await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(actualMenuOptions, ExpectedMessages.contextMenuOptionsValid)
          .toEqual(expect.arrayContaining([MenuOptions.share]));
        expect
          .soft(actualMenuOptions, ExpectedMessages.contextMenuOptionsValid)
          .not.toEqual(expect.arrayContaining([MenuOptions.unshare]));
      },
    );

    await dialTest.step(
      'Get the list of shared with me conversation by another user and verify there is no shared one',
      async () => {
        const sharedWithAnotherUserConversations =
          await additionalUserShareApiHelper.listSharedWithMeEntities();
        expect
          .soft(
            sharedWithAnotherUserConversations.resources.find(
              (c) => c.name === conversation.name,
            ),
            ExpectedMessages.conversationIsNotShared,
          )
          .toBeUndefined();
      },
    );

    await dialTest.step(
      'Try to open share link by another user and verify error received',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(
          shareByLinkResponse,
          404,
        );
      },
    );

    await dialTest.step(
      'Create new conversation, send any request and verify Unshare option is not available i  context menu',
      async () => {
        const newChatRequest = '1+2';
        await chatBar.createNewConversation();
        await chat.sendRequestWithButton(newChatRequest);
        await conversations.openConversationDropdownMenu(newChatRequest);
        const actualMenuOptions =
          await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(actualMenuOptions, ExpectedMessages.contextMenuOptionsValid)
          .not.toEqual(expect.arrayContaining([MenuOptions.unshare]));
      },
    );
  },
);
