import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { Button } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Conversation } from '@epam/ai-dial-shared';

dialTest(
  `Stage with info > XXkb contains text 'Content is too large to display (exceeds 100 KB).' Updated value.\n` +
    'Stage with info > XXkb. Copy.\n' +
    'Stage with info > XXkb. Download',
  async ({
    dialHomePage,
    downloadAssertion,
    setTestIds,
    conversationData,
    conversations,
    dataInjector,
    chatMessages,
    chatMessagesAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-6048', 'EPMDIAL-6049', 'EPMDIAL-6050');
    let stageConversation: Conversation;
    const stageContent = GeneratorUtil.randomString(35000);
    //NEXT_PUBLIC_STAGE_CONTENT_LIMIT=20 is configured on review/e2e envs
    const stageContentLimit = 20;
    const messageIndex = 2;
    const stageIndex = 1;
    const expectedBtnColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.bgAccentPrimaryAlpha,
    );
    let copyBtn: Button;
    let downloadBtn: Button;

    await dialTest.step(
      'Prepare stage conversation with size exceeded NEXT_PUBLIC_STAGE_CONTENT_LIMIT env value',
      async () => {
        stageConversation =
          conversationData.prepareConversationWithStagesInResponse(
            undefined,
            1,
            stageContent,
          );
        await dataInjector.createConversations([stageConversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Select created conversation, expand the stage and verify "Too large" label is displayed, Copy and Download btns are available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(stageConversation.name);
        await chatMessages.openMessageStage(messageIndex, stageIndex);
        await chatMessagesAssertion.assertElementText(
          chatMessages.messageStageContent(messageIndex, stageIndex),
          ExpectedConstants.stageContentLimitExceeded(stageContentLimit),
        );
        copyBtn = chatMessages.messageStageContentCopyButton(
          messageIndex,
          stageIndex,
        );
        downloadBtn = chatMessages.messageStageContentDownloadButton(
          messageIndex,
          stageIndex,
        );
        await chatMessagesAssertion.assertElementState(copyBtn, 'visible');
        await chatMessagesAssertion.assertElementState(downloadBtn, 'visible');
      },
    );

    await dialTest.step(
      'Verify Copy btn is highlighted on hover and the content is copied on click',
      async () => {
        await copyBtn.hoverOver();
        await chatMessagesAssertion.assertElementBackgroundColors(
          copyBtn,
          expectedBtnColor,
        );
        await copyBtn.click();
        chatMessagesAssertion.assertValue(
          await dialHomePage.readTextFromClipboard(),
          stageContent,
        );
      },
    );

    await dialTest.step(
      'Verify Download btn is highlighted on hover and the content is downloaded on click',
      async () => {
        await downloadBtn.hoverOver();
        await chatMessagesAssertion.assertElementBackgroundColors(
          downloadBtn,
          expectedBtnColor,
        );
        const downloadedData = await dialHomePage.downloadData(() =>
          downloadBtn.click(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(downloadedData);
      },
    );
  },
);

dialTest(
  'Stage with error',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    conversations,
    dataInjector,
    chatMessages,
    chatMessagesAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-6040');
    let errorStageConversation: Conversation;
    const messageIndex = 2;
    const stageIndex = 1;

    await dialTest.step('Prepare a conversation with error stage', async () => {
      errorStageConversation =
        conversationData.prepareConversationWithStagesInResponse(
          undefined,
          1,
          undefined,
          'failed',
        );
      await dataInjector.createConversations([errorStageConversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Select created conversation and verify stage is collapsed, error icon is shown on the title',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(errorStageConversation.name);
        const messageStage = chatMessages.getCollapsedMessageStage(
          messageIndex,
          stageIndex,
        );
        await chatMessagesAssertion.assertElementState(messageStage, 'visible');
        await chatMessagesAssertion.assertElementText(
          messageStage,
          errorStageConversation.messages.find((m) => m.role === 'assistant')!
            .custom_content!.stages![0].name,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getStageErrorIcon(messageIndex, stageIndex),
          'visible',
        );
      },
    );

    await dialTest.step(
      'Expand the stage and verify the content is displayed',
      async () => {
        await chatMessages.openMessageStage(messageIndex, stageIndex);
        await chatMessagesAssertion.assertElementState(
          chatMessages.messageStageContent(messageIndex, stageIndex),
          'visible',
        );
      },
    );
  },
);
