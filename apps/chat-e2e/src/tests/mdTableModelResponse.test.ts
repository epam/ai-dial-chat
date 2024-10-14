import { Conversation, CopyTableType } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { noSimpleModelSkipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages, Theme } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { Locator, expect } from '@playwright/test';

const expectedChatMessageIndex = 2;

let simpleRequestModel: DialAIEntityModel | undefined;
dialTest.beforeAll(async () => {
  simpleRequestModel = ModelsUtil.getModelForSimpleRequest();
});

dialTest(
  'Check md table in response.\n' +
    'Copy md table as CSV.\n' +
    'Copy md table as TXT.\n' +
    'Copy md table as MD',
  async ({
    dialHomePage,
    setTestIds,
    chatMessages,
    tooltip,
    sendMessage,
    localStorageManager,
    conversationData,
    dataInjector,
  }) => {
    setTestIds('EPMRTC-1153', 'EPMRTC-3124', 'EPMRTC-3125', 'EPMRTC-3126');
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
    const expectedCopiedContent = [
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

    await dialTest.step('Set random application theme', async () => {
      theme = GeneratorUtil.randomArrayElement(Object.keys(Theme));
      await localStorageManager.setSettings(theme);
    });

    await dialTest.step(
      'Prepare conversation with table response',
      async () => {
        tableConversation =
          conversationData.prepareConversationWithMdTableContent();
        await dataInjector.createConversations([tableConversation]);
        await localStorageManager.setSelectedConversation(tableConversation);
      },
    );

    await dialTest.step(
      'Verify table data is correctly displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await expect
          .soft(
            chatMessages.getChatMessageTable(expectedChatMessageIndex),
            ExpectedMessages.tableIsVisible,
          )
          .toBeVisible();

        copyAsCsvIcon = chatMessages.getChatMessageTableCopyAsCsvIcon(
          expectedChatMessageIndex,
        );
        await expect
          .soft(copyAsCsvIcon, ExpectedMessages.tableCopyAsCsvIconIsVisible)
          .toBeVisible();

        copyAsTxtIcon = chatMessages.getChatMessageTableCopyAsTxtIcon(
          expectedChatMessageIndex,
        );
        await expect
          .soft(copyAsTxtIcon, ExpectedMessages.tableCopyAsTxtIconIsVisible)
          .toBeVisible();

        copyAsMdIcon = chatMessages.getChatMessageTableCopyAsMdIcon(
          expectedChatMessageIndex,
        );
        await expect
          .soft(copyAsMdIcon, ExpectedMessages.tableCopyAsMdIconIsVisible)
          .toBeVisible();
        expect
          .soft(
            await chatMessages.getChatMessageTableHeaderColumnsCount(
              expectedChatMessageIndex,
            ),
            ExpectedMessages.tableColumnsCountIsValid,
          )
          .toBe(expectedTableDimensions);
        expect
          .soft(
            await chatMessages.getChatMessageTableRowsCount(
              expectedChatMessageIndex,
            ),
            ExpectedMessages.tableRowsCountIsValid,
          )
          .toBe(expectedTableDimensions * expectedTableDimensions);
      },
    );

    await dialTest.step(
      'Verify table rows background color is correct',
      async () => {
        const tableHeaderBackgroundColor =
          await chatMessages.getChatMessageTableHeadersBackgroundColor(
            expectedChatMessageIndex,
          );
        expect
          .soft(
            tableHeaderBackgroundColor[0],
            ExpectedMessages.tableEntityBackgroundColorIsValid,
          )
          .toBe(
            theme === Theme.dark
              ? Colors.backgroundLayer4Dark
              : Colors.backgroundLayer4Light,
          );

        const tableRowBackgroundColor =
          await chatMessages.getChatMessageTableRowsBackgroundColor(
            expectedChatMessageIndex,
          );
        expect
          .soft(
            tableRowBackgroundColor[0],
            ExpectedMessages.tableEntityBackgroundColorIsValid,
          )
          .toBe(
            theme === Theme.dark
              ? Colors.backgroundLayer3Dark
              : Colors.backgroundLayer3Light,
          );
      },
    );

    await dialTest.step(
      'Verify tooltip is shown on hover over table controls, valid content is copied by click on controls',
      async () => {
        copyIcons = [copyAsCsvIcon, copyAsTxtIcon, copyAsMdIcon];
        for (let i = 0; i < copyIcons.length; i++) {
          await copyIcons[i].hover();
          await expect
            .soft(
              tooltip.getElementLocator(),
              ExpectedMessages.tableControlTooltipIsVisible,
            )
            .toBeVisible();
          expect
            .soft(
              await tooltip.getContent(),
              ExpectedMessages.tooltipContentIsValid,
            )
            .toBe(expectedCopyIconTooltips[i]);

          await copyIcons[i].click();
          await sendMessage.pasteDataIntoMessageInput();
          expect
            .soft(
              await sendMessage.getMessage(),
              ExpectedMessages.copiedContentIsValid,
            )
            .toBe(expectedCopiedContent[i]);
          await sendMessage.clearMessageInput();
        }
      },
    );
  },
);

dialTest(
  'Copy buttons are not shown in MD table if the response is being generated',
  async ({
    dialHomePage,
    setTestIds,
    chatMessages,
    chat,
    localStorageManager,
    conversationData,
    dataInjector,
  }) => {
    dialTest.skip(simpleRequestModel === undefined, noSimpleModelSkipReason);
    setTestIds('EPMRTC-3123');
    let tableConversation: Conversation;

    await dialTest.step('Prepare empty conversation', async () => {
      tableConversation = conversationData.prepareEmptyConversation(
        simpleRequestModel!,
      );
      await dataInjector.createConversations([tableConversation]);
      await localStorageManager.setSelectedConversation(tableConversation);
    });

    await dialTest.step(
      'Send request to generate MD table and verify copy icons are not available while response is generating',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
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
