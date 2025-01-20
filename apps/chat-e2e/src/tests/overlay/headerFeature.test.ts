import { Conversation } from '@/chat/types/chat';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import dialOverlayTest from '@/src/core/dialOverlayFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  Theme,
} from '@/src/testData';
import { OverlaySandboxUrls } from '@/src/testData/overlay/overlaySandboxUrls';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ItemUtil, ModelsUtil } from '@/src/utils';
import { Locator, expect } from '@playwright/test';

dialOverlayTest(
  '[Overlay] Defaults set in the code: theme.\n' +
    '[Overlay] Display conversations panel - Feature.ConversationsSection.\n' +
    '[Overlay] Display prompts panel - Feature.PromptsSection.\n' +
    '[Overlay] Display Report an issue modal - Feature.ReportAnIssue.\n' +
    '[Overlay] Display Request API Key modal - Feature.RequestApiKey.\n' +
    '[Overlay] Display conversation sharing - ConversationsSharing.\n' +
    '[Overlay] Display prompts sharing - PromptsSharing.\n' +
    '[Overlay] Display attachments manager in conversation panel - Feature.AttachmentsManager.\n' +
    '[Overlay] Display conversation publishing - Feature.ConversationsPublishing.\n' +
    '[Overlay] Display prompts publishing - Feature.PromptsPublishing.\n' +
    '[Overlay] Enable setting for custom logo feature - Feature.CustomLogo.\n' +
    '[Overlay] Display DIAL footer - Feature.Footer',
  async ({
    overlayHomePage,
    overlayAgentInfo,
    overlayChat,
    overlayHeader,
    overlaySendMessage,
    overlayAccountSettings,
    overlayBaseAssertion,
    overlayAssertion,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-3782',
      'EPMRTC-3759',
      'EPMRTC-3760',
      'EPMRTC-3769',
      'EPMRTC-3768',
      'EPMRTC-3771',
      'EPMRTC-3772',
      'EPMRTC-3775',
      'EPMRTC-3776',
      'EPMRTC-3777',
      'EPMRTC-3778',
      'EPMRTC-3767',
    );

    await dialTest.step('Verify header is not visible', async () => {
      await overlayHomePage.navigateToUrl(
        OverlaySandboxUrls.disabledHeaderSandboxUrl,
      );
      await overlayBaseAssertion.assertElementState(overlayHeader, 'hidden');
    });

    await dialTest.step(
      'Verify new conversation with possibility to change agent, configure and send request are available',
      async () => {
        await overlayBaseAssertion.assertElementState(
          overlayAgentInfo,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChat.changeAgentButton,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChat.configureSettingsButton,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayChat.getSendMessage(),
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlaySendMessage,
          'visible',
        );
      },
    );

    await dialTest.step('Verify Light theme is set', async () => {
      await overlayAssertion.assertOverlayTheme(overlayHomePage, Theme.light);
    });

    await dialTest.step(
      'Verify side bar toggles and account settings are not available',
      async () => {
        await overlayBaseAssertion.assertElementState(
          overlayHeader.leftPanelToggle,
          'hidden',
        );
        await overlayBaseAssertion.assertElementState(
          overlayHeader.rightPanelToggle,
          'hidden',
        );
        await overlayBaseAssertion.assertElementState(
          overlayAccountSettings,
          'hidden',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] Display conversations panel - Feature.ConversationsSection.\n' +
    '[Overlay] Display prompts panel - Feature.PromptsSection.\n' +
    '[Overlay] Display conversation sharing - ConversationsSharing.\n' +
    '[Overlay] Display prompts sharing - PromptsSharing.\n' +
    '[Overlay] Display attachments manager in conversation panel - Feature.AttachmentsManager.\n' +
    '[Overlay] Display conversation publishing - Feature.ConversationsPublishing.\n' +
    '[Overlay] Display prompts publishing - Feature.PromptsPublishing.\n' +
    '[Overlay] Enable setting for custom logo feature - Feature.CustomLogo.\n' +
    '[Overlay] Hide "New conversation" button in DIAL header - Feature.HideNewConversation.\n' +
    '[Overlay] Message template feature toggle - Feature.MessageTemplates.\n' +
    '[Overlay] Display DIAL footer - Feature.Footer',
  async ({
    page,
    overlayHomePage,
    overlayHeader,
    overlayChatBar,
    overlayConversations,
    overlayConversationDropdownMenu,
    overlayPublishingRequestModal,
    overlayPrompts,
    overlayPromptDropdownMenu,
    overlaySettingsModal,
    overlayAgentInfo,
    overlayShareModal,
    overlayAccountSettings,
    overlayProfilePanel,
    overlayRequestApiKeyModal,
    overlayReportAnIssueModal,
    overlayAttachFilesModal,
    overlayChatMessages,
    overlayBaseAssertion,
    overlayConversationAssertion,
    overlayPromptAssertion,
    conversationData,
    promptData,
    overlayDataInjector,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-3759',
      'EPMRTC-3760',
      'EPMRTC-3771',
      'EPMRTC-3772',
      'EPMRTC-3775',
      'EPMRTC-3776',
      'EPMRTC-3777',
      'EPMRTC-3778',
      'EPMRTC-3779',
      'EPMRTC-4438',
      'EPMRTC-3767',
    );
    let conversation: Conversation;
    let prompt: Prompt;
    let conversationEntity: Locator;
    let promptEntity: Locator;

    await dialTest.step('Create simple conversation and prompt', async () => {
      conversation = conversationData.prepareDefaultConversation();
      prompt = promptData.preparePrompt('test');
      await overlayDataInjector.createConversations([conversation]);
      await overlayDataInjector.createPrompts([prompt]);
    });

    await dialTest.step('Verify header is visible', async () => {
      await overlayHomePage.navigateToUrl(
        OverlaySandboxUrls.enabledHeaderSandboxUrl,
      );
      await overlayHomePage.waitForPageLoaded();
      await overlayBaseAssertion.assertElementState(overlayHeader, 'visible');
    });

    await dialTest.step('Verify side bar toggles are available', async () => {
      await overlayBaseAssertion.assertElementState(
        overlayHeader.leftPanelToggle,
        'visible',
      );
      await overlayBaseAssertion.assertElementState(
        overlayHeader.rightPanelToggle,
        'visible',
      );
    });

    await dialTest.step(
      'Verify "New Conversation button" is not available',
      async () => {
        await overlayBaseAssertion.assertElementState(
          overlayHeader.newEntityButton,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open left side panel and verify created conversation is visible',
      async () => {
        await overlayHeader.leftPanelToggle.click();
        await overlayConversationAssertion.assertEntityState(
          { name: conversation.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify "Manage attachments" modal is opened on click "Clip" in the bottom menu',
      async () => {
        await overlayBaseAssertion.assertElementState(
          overlayChatBar.attachments,
          'visible',
        );
        await overlayChatBar.openManageAttachmentsModal();
        await overlayBaseAssertion.assertElementState(
          overlayAttachFilesModal,
          'visible',
        );
        await overlayAttachFilesModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Verify Share option is available for conversation',
      async () => {
        conversationEntity = overlayConversations.getTreeEntity(
          conversation.name,
        );
        await conversationEntity.hover();
        await overlayConversations.entityDotsMenu(conversation.name).click();
        await overlayConversationDropdownMenu.selectShareMenuOption();
        await overlayBaseAssertion.assertElementState(
          overlayShareModal,
          'visible',
        );
        await overlayShareModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Verify Publish option is available for conversation',
      async () => {
        await conversationEntity.hover();
        await overlayConversations.entityDotsMenu(conversation.name).click();
        await overlayConversationDropdownMenu.selectMenuOption(
          MenuOptions.publish,
        );
        await overlayBaseAssertion.assertElementState(
          overlayPublishingRequestModal,
          'visible',
        );
        await overlayPublishingRequestModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Verify new conversation is not create if to click on app logo',
      async () => {
        await overlayConversations.selectConversation(
          conversation.name,
          { exactMatch: true },
          { isHttpMethodTriggered: false },
        );
        await overlayHeader.logo.click();
        await overlayBaseAssertion.assertElementState(
          overlayAgentInfo,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify "Set message template" button is available for the request',
      async () => {
        const request = await overlayChatMessages.hoverOverMessage(1);
        await overlayBaseAssertion.assertElementState(
          overlayChatMessages.setMessageTemplateIcon(request),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Open right side panel and verify created prompt is visible',
      async () => {
        await overlayHeader.rightPanelToggle.click();
        await overlayPromptAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify Share option is available for prompt',
      async () => {
        promptEntity = overlayPrompts.getTreeEntity(prompt.name);
        await promptEntity.hover();
        await overlayPrompts.entityDotsMenu(prompt.name).click();
        await overlayPromptDropdownMenu.selectShareMenuOption();
        await overlayBaseAssertion.assertElementState(
          overlayShareModal,
          'visible',
        );
        await overlayShareModal.closeButton.click();
      },
    );

    await dialTest.step(
      'Verify Publish option is available for prompt',
      async () => {
        await promptEntity.hover();
        await overlayPrompts.entityDotsMenu(prompt.name).click();
        await overlayPromptDropdownMenu.selectMenuOption(MenuOptions.publish);
        await overlayBaseAssertion.assertElementState(
          overlayPublishingRequestModal,
          'visible',
        );
        await overlayPublishingRequestModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Verify custom logo can be set, footer is displayed',
      async () => {
        await overlayAccountSettings.click();
        await overlayBaseAssertion.assertElementState(
          overlayProfilePanel.getFooter(),
          'visible',
        );
        await overlayProfilePanel.settings.click();
        await overlayBaseAssertion.assertElementState(
          overlaySettingsModal.customLogo,
          'visible',
        );
        await overlaySettingsModal.cancelButton.click();
      },
    );

    await dialTest.step('Verify API key can be requested', async () => {
      await overlayProfilePanel
        .getFooter()
        .openFooterLink(ExpectedConstants.requestApiKeyLink);
      //TODO: remove when fixed https://github.com/epam/ai-dial-chat/issues/2878
      const overlayRequestApiKeyModalFirst =
        overlayRequestApiKeyModal.getNthElement(0);
      await overlayBaseAssertion.assertElementState(
        overlayRequestApiKeyModalFirst,
        'visible',
      );
      for (let i = 1; i <= 2; i++) {
        await page.keyboard.press(keys.escape);
      }
    });

    await dialTest.step('Verify a new issue can be reported', async () => {
      await overlayProfilePanel
        .getFooter()
        .openFooterLink(ExpectedConstants.reportAnIssueLink);
      //TODO: remove when fixed https://github.com/epam/ai-dial-chat/issues/2878
      const overlayRequestApiKeyModalFirst =
        overlayReportAnIssueModal.getNthElement(0);
      await overlayBaseAssertion.assertElementState(
        overlayRequestApiKeyModalFirst,
        'visible',
      );
    });
  },
);

dialOverlayTest(
  '[Overlay] Display DIAL header - Feature.Header.\n' +
    '[Overlay] Display DIAL footer - Feature.Footer.\n' +
    '[Overlay] Enable setting for custom logo feature - Feature.CustomLogo',
  async ({
    overlayHomePage,
    overlayAgentInfo,
    overlayChat,
    overlayHeader,
    overlayAccountSettings,
    overlayBaseAssertion,
    overlayItemApiHelper,
    overlayProfilePanel,
    overlayConfirmationDialog,
    overlaySettingsModal,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3766', 'EPMRTC-3767', 'EPMRTC-3778');

    await dialTest.step(
      'Verify "New Conversation", logo and profile setting buttons are available in the header',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledOnlyHeaderSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayBaseAssertion.assertElementState(
          overlayHeader.newEntityButton,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayHeader.logo,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayAccountSettings,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify new conversation is create on click "Plus" button',
      async () => {
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        const requestContent = GeneratorUtil.randomString(5);
        await overlayChat.sendRequestWithButton(requestContent);
        await overlayHeader.createNewConversation();
        await overlayBaseAssertion.assertElementState(
          overlayAgentInfo,
          'visible',
        );
        const allConversations = await overlayItemApiHelper.listItems(
          API.conversationsHost(),
        );
        const conversationWithContent = `${ModelsUtil.getDefaultModel()!.id}${ItemUtil.conversationIdSeparator}${requestContent}`;
        expect
          .soft(
            allConversations.find((c) => c.name === conversationWithContent),
            ExpectedMessages.conversationIsVisible,
          )
          .toBeDefined();
      },
    );

    await dialTest.step(
      'Verify new conversation is create on click logo button',
      async () => {
        await overlayHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
          { isOverlay: true },
        );
        await overlayChat.sendRequestWithButton(GeneratorUtil.randomString(5));
        await overlayHeader.logo.click();
        await overlayBaseAssertion.assertElementState(
          overlayAgentInfo,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Open profile settings and verify user info, "Settings", "Logout" options are displayed',
      async () => {
        await overlayAccountSettings.click();
        await overlayBaseAssertion.assertElementState(
          overlayProfilePanel.settings,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayProfilePanel.logout,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayProfilePanel.username,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayProfilePanel.avatar,
          'visible',
        );
        await overlayBaseAssertion.assertElementState(
          overlayAccountSettings.avatarIcon,
          'hidden',
        );
        await overlayBaseAssertion.assertElementState(
          overlayAccountSettings.closeButton,
          'visible',
        );
      },
    );

    await dialTest.step('Verify footer is not visible', async () => {
      await overlayBaseAssertion.assertElementState(
        overlayProfilePanel.getFooter(),
        'hidden',
      );
    });

    await dialTest.step(
      'Click on "Log out" and verify confirmation dialog appears',
      async () => {
        await overlayProfilePanel.logout.click();
        await overlayBaseAssertion.assertElementState(
          overlayConfirmationDialog,
          'visible',
        );
        await overlayConfirmationDialog.cancelDialog();
      },
    );

    await dialTest.step(
      'Open profile settings and verify "Custom logo" cannot be set',
      async () => {
        await overlayProfilePanel.settings.click();
        await overlayBaseAssertion.assertElementState(
          overlaySettingsModal.customLogo,
          'hidden',
        );
        await overlaySettingsModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Click on "X" and verify profile panel is closed',
      async () => {
        await overlayAccountSettings.closeButton.click();
        await overlayBaseAssertion.assertElementState(
          overlayProfilePanel,
          'hidden',
        );
        await overlayBaseAssertion.assertElementState(
          overlayAccountSettings.avatarIcon,
          'visible',
        );
      },
    );
  },
);

dialOverlayTest(
  '[Overlay] Display Request API Key modal - Feature.RequestApiKey.\n' +
    '[Overlay] Display Report an issue modal - Feature.ReportAnIssue',
  async ({
    overlayHomePage,
    overlayRequestApiKeyModal,
    overlayAccountSettings,
    overlayBaseAssertion,
    overlayProfilePanel,
    overlayReportAnIssueModal,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3768', 'EPMRTC-3769');

    await dialTest.step(
      'Open profile panel and verify API key cannot be requested',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledOnlyHeaderFooterSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayAccountSettings.click();
        await overlayProfilePanel
          .getFooter()
          .openFooterLink(ExpectedConstants.requestApiKeyLink);
        await overlayBaseAssertion.assertElementState(
          overlayRequestApiKeyModal,
          'hidden',
        );
      },
    );

    await dialTest.step('Verify new issue cannot be reported', async () => {
      await overlayProfilePanel
        .getFooter()
        .openFooterLink(ExpectedConstants.reportAnIssueLink);
      await overlayBaseAssertion.assertElementState(
        overlayReportAnIssueModal,
        'hidden',
      );
    });
  },
);

dialOverlayTest(
  '[Overlay] Display Request API Key modal - Feature.RequestApiKey.\n' +
    '[Overlay] Display Report an issue modal - Feature.ReportAnIssue.\n' +
    '[Overlay] Display attachments manager in conversation panel - Feature.AttachmentsManager',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayBaseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3768', 'EPMRTC-3769', 'EPMRTC-3775');

    await dialTest.step('Verify header is not available', async () => {
      await overlayHomePage.navigateToUrl(
        OverlaySandboxUrls.enabledOnlyFooterLinksAttachmentsUrl,
      );
      await overlayHomePage.waitForPageLoaded();
      await overlayBaseAssertion.assertElementState(overlayHeader, 'hidden');
    });
  },
);

dialOverlayTest(
  '[Overlay] Display attachments manager in conversation panel - Feature.AttachmentsManager',
  async ({
    overlayHomePage,
    overlayHeader,
    overlayBaseAssertion,
    overlayChatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3775');

    await dialTest.step(
      'Open conversations side panel and verify "Clip" icon is not visible at the bottom panel',
      async () => {
        await overlayHomePage.navigateToUrl(
          OverlaySandboxUrls.enabledOnlyHeaderConversationsSectionSandboxUrl,
        );
        await overlayHomePage.waitForPageLoaded();
        await overlayHeader.leftPanelToggle.click();
        await overlayBaseAssertion.assertElementState(
          overlayChatBar.attachments,
          'hidden',
        );
      },
    );
  },
);
