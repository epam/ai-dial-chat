import { Conversation, CopyTableType } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { noSimpleModelSkipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages, ThemeId } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Role } from '@epam/ai-dial-shared';
import { Locator, expect } from '@playwright/test';
import { markdownToTxt } from 'markdown-to-txt';

const expectedChatMessageIndex = 2;

let simpleRequestModel: DialAIEntityModel | undefined;
dialTest.beforeAll(async () => {
  simpleRequestModel = ModelsUtil.getModelForSimpleRequest();
});

dialTest(
  'Check md table in response.\n' +
    'Copy md table as CSV.\n' +
    'Copy md table as TXT.\n' +
    'Copy md table as MD.\n' +
    `[Markdown] Copy the whole MD answer using 'Copy text' button.\n` +
    `[Markdown] Copy the whole MD answer using 'Copy markdown' button`,
  async ({
    dialHomePage,
    setTestIds,
    chatMessages,
    tooltipAssertion,
    localStorageManager,
    conversationData,
    dataInjector,
    conversations,
    chatMessagesAssertion,
  }) => {
    setTestIds(
      'EPMRTC-1153',
      'EPMRTC-3124',
      'EPMRTC-3125',
      'EPMRTC-3126',
      'EPMRTC-8314',
      'EPMRTC-8315',
    );
    let theme: string;
    let tableConversation: Conversation;
    let copyAsCsvIcon: Locator;
    let copyAsTxtIcon: Locator;
    let copyAsMdIcon: Locator;
    let copyIcons: Locator[] = [];

    const expectedTableDimensions = 2;
    const expectedCopyIconTooltips = [
      ExpectedConstants.copyTableTooltip(CopyTableType.CSV),
      ExpectedConstants.copyTableTooltip(CopyTableType.TXT),
      ExpectedConstants.copyTableTooltip(CopyTableType.MD),
    ];
    const expectedCopiedTableContent = [
      '"Country","Capital"\n' +
        '"Canada","Ottawa"\n' +
        '"United States","Washington, D.C."',
      'Country\tCapital\n' +
        'Canada\tOttawa\n' +
        'United States\tWashington, D.C.',
      '| Country | Capital |\n' +
        '| :-- | :-- |\n' +
        '| Canada | Ottawa |\n' +
        '| United States | Washington, D.C. |',
    ];
    let expectedResponseMdContent: string;

    await dialTest.step('Set random application theme', async () => {
      theme = GeneratorUtil.randomArrayElement(Object.keys(ThemeId));
      await localStorageManager.setSettings(theme);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Prepare conversation with table response',
      async () => {
        tableConversation =
          conversationData.prepareConversationWithMdTableContent();
        await dataInjector.createConversations([tableConversation]);
        expectedResponseMdContent = tableConversation.messages.find(
          (m) => m.role === Role.Assistant,
        )!.content;
      },
    );

    await dialTest.step(
      'Verify table data is correctly displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(tableConversation.name);
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageTable(expectedChatMessageIndex),
          'visible',
          ExpectedMessages.tableIsVisible,
        );
        copyAsCsvIcon = chatMessages.getChatMessageTableCopyAsCsvIcon(
          expectedChatMessageIndex,
        );
        await chatMessagesAssertion.assertElementState(
          copyAsCsvIcon,
          'visible',
          ExpectedMessages.tableCopyAsCsvIconIsVisible,
        );

        copyAsTxtIcon = chatMessages.getChatMessageTableCopyAsTxtIcon(
          expectedChatMessageIndex,
        );
        await chatMessagesAssertion.assertElementState(
          copyAsTxtIcon,
          'visible',
          ExpectedMessages.tableCopyAsTxtIconIsVisible,
        );

        copyAsMdIcon = chatMessages.getChatMessageTableCopyAsMdIcon(
          expectedChatMessageIndex,
        );
        await chatMessagesAssertion.assertElementState(
          copyAsMdIcon,
          'visible',
          ExpectedMessages.tableCopyAsMdIconIsVisible,
        );

        await chatMessagesAssertion.assertElementsCount(
          chatMessages.getChatMessageTableHeaderColumns(
            expectedChatMessageIndex,
          ),
          expectedTableDimensions,
          ExpectedMessages.tableColumnsCountIsValid,
        );
        await chatMessagesAssertion.assertElementsCount(
          chatMessages.getChatMessageTableRows(expectedChatMessageIndex),
          expectedTableDimensions * expectedTableDimensions,
          ExpectedMessages.tableRowsCountIsValid,
        );
      },
    );

    await dialTest.step(
      'Verify table rows background color is correct',
      async () => {
        await chatMessagesAssertion.assertElementBackgroundColors(
          chatMessages
            .getChatMessageTableHeaderColumns(expectedChatMessageIndex)
            .first(),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer4, theme),
        );
        await chatMessagesAssertion.assertElementBackgroundColors(
          chatMessages
            .getChatMessageTableRows(expectedChatMessageIndex)
            .first(),
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.bgLayer3, theme),
        );
      },
    );

    await dialTest.step(
      'Verify tooltip is shown on hover over table controls, valid content is copied by click on controls',
      async () => {
        copyIcons = [copyAsCsvIcon, copyAsTxtIcon, copyAsMdIcon];
        for (let i = 0; i < copyIcons.length; i++) {
          await copyIcons[i].hover();
          await tooltipAssertion.assertTooltipContent(
            expectedCopyIconTooltips[i],
          );

          const copied = await dialHomePage.captureNextClipboardWrite(() =>
            copyIcons[i].click(),
          );
          chatMessagesAssertion.assertCopiedMessage(
            copied,
            expectedCopiedTableContent[i],
          );
        }
      },
    );

    //TODO: enable when fixed https://github.com/epam/ai-dial-chat/issues/6235
    await dialTest.step.skip(
      `Click on 'Copy text' btn and verify the response is copied without markdown`,
      async () => {
        const copied = await dialHomePage.captureNextClipboardWrite(() =>
          chatMessages.messageCopyTextButton(expectedChatMessageIndex).click(),
        );
        chatMessagesAssertion.assertCopiedMessage(
          copied,
          markdownToTxt(expectedResponseMdContent),
        );
      },
    );

    await dialTest.step(
      `Click on 'Copy markdown' btn and verify the response is copied with markdown`,
      async () => {
        const copied = await dialHomePage.captureNextClipboardWrite(() =>
          chatMessages
            .messageCopyMarkdownButton(expectedChatMessageIndex)
            .click(),
        );
        chatMessagesAssertion.assertCopiedMessage(
          copied,
          expectedResponseMdContent,
        );
      },
    );
  },
);

//TODO: investigate flaky behaviour
dialTest.fixme(
  'Copy buttons are not shown in MD table if the response is being generated',
  async ({
    dialHomePage,
    setTestIds,
    chatMessages,
    chat,
    conversations,
    conversationData,
    dataInjector,
    localStorageManager,
  }) => {
    dialTest.skip(simpleRequestModel === undefined, noSimpleModelSkipReason);
    setTestIds('EPMRTC-3123');
    let tableConversation: Conversation;

    await dialTest.step('Prepare empty conversation', async () => {
      tableConversation = conversationData.prepareEmptyConversation(
        simpleRequestModel!,
      );
      await dataInjector.createConversations([tableConversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Send request to generate MD table and verify copy icons are not available while response is generating',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(tableConversation.name);
        await chat.sendRequestWithButton(
          'Create md table with european countries, its capitals and population',
          false,
        );
        await chatMessages
          .getChatMessageTable(expectedChatMessageIndex)
          .waitFor();
        await expect
          .soft(
            chatMessages.getChatMessageTableControls(expectedChatMessageIndex),
            ExpectedMessages.tableControlIconsNotVisible,
          )
          .toBeHidden();
      },
    );
  },
);
