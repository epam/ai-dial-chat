import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  Attachment,
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
  ToggleState,
} from '@/src/testData';
import { ChatMessages } from '@/src/ui/webElements';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { CompactModeState } from '@epam/ai-dial-shared';
import { Locator, expect } from '@playwright/test';

const stagesCount = 6;
const webSearchStageNumber = 1;
const userMessageIndex = 1;
const assistantMessageIndex = 2;

const richMarkdownContent = `Summary of the results below.

| Country | Capital |
| --- | --- |
| Canada | Ottawa |
| United States | Washington, D.C. |

- First item
- Second item
- Third item

> Important note about the data above.

\`\`\`phyton
console.log('compact mode enabled');
\`\`\`
`;

let compactModeModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  compactModeModel = GeneratorUtil.randomArrayElement(
    ModelsUtil.getLatestModelsWithAttachment().filter(
      (m) =>
        m.inputAttachmentTypes?.length == 1 &&
        m.inputAttachmentTypes[0] === Attachment.imageTypesExtension,
    ),
  );
});

async function getVerticalGap(above: Locator, below: Locator) {
  const [aboveBox, belowBox] = await Promise.all([
    above.boundingBox(),
    below.boundingBox(),
  ]);
  return belowBox!.y - (aboveBox!.y + aboveBox!.height);
}

async function measureSpacing(chatMessages: ChatMessages) {
  const stageNumberInDom = webSearchStageNumber;
  const [
    userWrapperPadding,
    assistantWrapperPadding,
    stagePadding,
    stageContentPadding,
    showMoreMargin,
    showMorePadding,
    tableMargin,
    listMargin,
    quoteMargin,
    codeMargin,
    userAttachmentGap,
    assistantAttachmentGap,
  ] = await Promise.all([
    chatMessages
      .getChatMessageOuterWrapper(userMessageIndex)
      .getPxProperty('paddingTop'),
    chatMessages
      .getChatMessageOuterWrapper(assistantMessageIndex)
      .getPxProperty('paddingTop'),
    chatMessages
      .messageStageElement(assistantMessageIndex, stageNumberInDom)
      .getPxProperty('paddingTop'),
    chatMessages
      .messageStageContentElement(assistantMessageIndex, stageNumberInDom)
      .getPxProperty('paddingTop'),
    chatMessages.showMoreButton.getPxProperty('paddingTop'),
    chatMessages.showMoreButton.getPxProperty('marginTop'),
    chatMessages
      .getChatMessageTableElement(assistantMessageIndex)
      .getPxProperty('marginTop'),
    chatMessages
      .getChatMessageList(assistantMessageIndex)
      .getPxProperty('marginTop'),
    chatMessages
      .getChatMessageBlockquote(assistantMessageIndex)
      .getPxProperty('marginTop'),
    chatMessages
      .getChatMessageCodePre(assistantMessageIndex, 'phyton')
      .getPxProperty('marginTop'),
    getVerticalGap(
      chatMessages.getChatMessageTextBlock(userMessageIndex, 'stages request'),
      chatMessages.getCollapsedChatMessageAttachment(userMessageIndex).first(),
    ),
    getVerticalGap(
      chatMessages.getChatMessageTextBlock(
        assistantMessageIndex,
        richMarkdownContent.split('\n')[0],
      ),
      chatMessages
        .getCollapsedChatMessageAttachment(assistantMessageIndex)
        .first(),
    ),
  ]);

  return {
    userWrapperPadding,
    assistantWrapperPadding,
    stagePadding,
    stageContentPadding,
    showMoreMargin,
    showMorePadding,
    tableMargin,
    listMargin,
    quoteMargin,
    codeMargin,
    userAttachmentGap,
    assistantAttachmentGap,
  };
}

dialTest(
  'Check Compact mode in the Chat history.\n' +
    'Check default settings and tooltip explanation for Compact mode on Conversation settings modal.\n' +
    'Check Compact mode tooltip in the Chat header.\n' +
    'Check Compact mode is not stored for the next chat.\n' +
    'Check Compact mode is stored for Replay chat.\n' +
    'Check Compact mode is stored for Playback chat',
  async ({
    dialHomePage,
    chat,
    conversationData,
    dataInjector,
    localStorageManager,
    conversations,
    conversationDropdownMenu,
    chatHeader,
    chatBar,
    chatMessages,
    agentSettings,
    agentSettingAssertion,
    tooltipAssertion,
    chatSettingsTooltip,
    page,
    conversationSettingsModal,
    fileApiHelper,
    setTestIds,
  }) => {
    setTestIds(
      'EPMDIAL-7439',
      'EPMDIAL-7433',
      'EPMDIAL-7434',
      'EPMDIAL-7436',
      'EPMDIAL-7437',
      'EPMDIAL-7438',
    );
    let conversation: Conversation;
    let baseline: Awaited<ReturnType<typeof measureSpacing>>;

    await dialTest.step(
      'Prepare a conversation with >5 stages, a table, list, quote, code block and attachments on both user and agent messages',
      async () => {
        const userAttachmentUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
        );
        const assistantAttachmentUrl = await fileApiHelper.putFile(
          Attachment.cloudImageName,
        );

        conversation = conversationData.prepareConversationWithStagesInResponse(
          compactModeModel,
          stagesCount,
        );
        conversation.messages[0].custom_content = {
          attachments: [conversationData.getAttachmentData(userAttachmentUrl)],
        };
        conversation.messages[1].content = richMarkdownContent;
        conversation.messages[1].custom_content!.attachments = [
          conversationData.getAttachmentData(assistantAttachmentUrl),
        ];
        conversation.messages[1].custom_content!.stages![0].name = 'Web search';

        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          compactModeModel,
        );
      },
    );

    await dialTest.step(
      'Open the conversation and expand the "Web search" stage',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatMessages.openMessageStage(
          assistantMessageIndex,
          webSearchStageNumber,
        );
      },
    );

    await dialTest.step(
      'Measure the spacing around messages, attachments, stages, table, list, quote and code block before enabling Compact mode',
      async () => {
        baseline = await measureSpacing(chatMessages);
      },
    );

    await dialTest.step(
      'Hover over gear icon and verify Compact mode is off on the tooltip',
      async () => {
        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.compactModeInfo,
          CompactModeState.Off,
          ExpectedMessages.chatInfoCompactModeIsValid,
        );
      },
    );

    await dialTest.step(
      'Open conversation settings and verify Compact mode state and tooltip',
      async () => {
        await chatHeader.openConversationSettingsPopup();
        await agentSettingAssertion.assertCompactModeToggleState(
          ToggleState.off,
        );
        await agentSettingAssertion.assertElementText(
          agentSettings.compactModeDescription,
          'Reduce spacing within messages',
        );
        await agentSettings.compactModeHelpIcon.hoverOver();
        await tooltipAssertion.assertTooltipContent(
          'Proportionally reduce spacing and line gaps within message content to fit more on the screen.',
        );
        await page.mouse.move(0, 0);
      },
    );

    await dialTest.step('Enable Compact mode', async () => {
      await agentSettings.compactModeToggle.click();
      await conversationSettingsModal.applyChanges();
    });

    await dialTest.step(
      'Verify every measured spacing is proportionally reduced',
      async () => {
        const compact = await measureSpacing(chatMessages);
        for (const key of Object.keys(baseline) as (keyof typeof baseline)[]) {
          expect
            .soft(compact[key], `${key} ${ExpectedMessages.spacingIsReduced}`)
            .toBeLessThan(baseline[key]);
        }
      },
    );

    await dialTest.step(
      'Hover over gear icon and verify Compact mode is onn on the tooltip',
      async () => {
        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.compactModeInfo,
          CompactModeState.On,
          ExpectedMessages.chatInfoCompactModeIsValid,
        );
      },
    );

    await dialTest.step(
      'Create a new conversation and verify Compact mode is off',
      async () => {
        await chatBar.createNewEntity();
        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertCompactModeToggleState(
          ToggleState.off,
        );
        await conversationSettingsModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Create a replay conversation and verify Compact mode state is saved',
      async () => {
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay, {
          triggeredHttpMethod: 'POST',
        });
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.startReplay(undefined, true);
        await chatHeader.openConversationSettingsPopup();
        await agentSettingAssertion.assertCompactModeToggleState(
          ToggleState.on,
        );
        await conversationSettingsModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Create a playback conversation and verify Compact mode state is saved',
      async () => {
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.playback);
        await chat.playNextChatMessage();
        await chat.playNextChatMessage();
        await chatHeader.hoverOverChatSettings();
        await tooltipAssertion.assertElementText(
          chatSettingsTooltip.compactModeInfo,
          CompactModeState.On,
          ExpectedMessages.chatInfoCompactModeIsValid,
        );
      },
    );
  },
);
