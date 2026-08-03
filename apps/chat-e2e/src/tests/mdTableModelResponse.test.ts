import { Conversation, CopyTableType } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { noSimpleModelSkipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages, ThemeId } from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { Properties } from '@/src/ui/domData/properties';
import { keys } from '@/src/ui/keyboard';
import { BaseElement } from '@/src/ui/webElements';
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
    `[Markdown] Copy the whole MD answer using 'Copy markdown' button.\n` +
    `[Markdown] Copy the whole MD answer using Hotkeys`,
  async ({
    dialHomePage,
    setTestIds,
    page,
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
      'EPMDIAL-6101',
    );
    let theme: string;
    let tableConversation: Conversation;
    let copyAsCsvIcon: Locator;
    let copyAsTxtIcon: Locator;
    let copyAsMdIcon: Locator;
    let copyIcons: Locator[] = [];
    let tableElement: Locator;

    const expectedTableDimensions = 2;
    const expectedCopyIconTooltips = [
      ExpectedConstants.copyTableTooltip(CopyTableType.CSV),
      ExpectedConstants.copyTableTooltip(CopyTableType.TXT),
      ExpectedConstants.copyTableTooltip(CopyTableType.MD),
    ];
    const txtContent =
      'Country\tCapital\n' +
      'Canada\tOttawa\n' +
      'United States\tWashington, D.C.';
    const expectedCopiedTableContent = [
      '"Country","Capital"\n' +
        '"Canada","Ottawa"\n' +
        '"United States","Washington, D.C."',
      txtContent,
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
        tableElement = chatMessages.getChatMessageTable(
          expectedChatMessageIndex,
        );
        await chatMessagesAssertion.assertElementState(
          tableElement,
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

    await dialTest.step(
      'Select the table, copy it with Ctrl+C and verify clipboard content',
      async () => {
        await tableElement.selectText();
        await page.keyboard.press(keys.ctrlPlusC);
        const copiedText = await dialHomePage.readTextFromClipboard();
        chatMessagesAssertion.assertCopiedMessage(
          copiedText.trim(),
          txtContent,
        );
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

dialTest(
  'Download md table as CSV.\n' + 'Download renamed csv file',
  async ({
    dialHomePage,
    setTestIds,
    chatMessages,
    chatMessagesAssertion,
    tooltipAssertion,
    localStorageManager,
    conversationData,
    dataInjector,
    conversations,
    downloadTableCsvModal,
    baseAssertion,
    downloadAssertion,
  }) => {
    setTestIds('EPMRTC-9686', 'EPMRTC-9687');

    let tableConversation: Conversation;
    const expectedDownloadIconTooltip =
      ExpectedConstants.downloadTableAsCsvTooltip;
    const expectedCsvContent =
      '"Country","Capital"\n' +
      '"Canada","Ottawa"\n' +
      '"United States","Washington, D.C."';
    let downloadIcon: Locator;

    await dialTest.step(
      'Prepare conversation with table response',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        tableConversation =
          conversationData.prepareConversationWithMdTableContent();
        await dataInjector.createConversations([tableConversation]);
      },
    );

    await dialTest.step(
      'Hover over Download button and verify tooltip is shown, button is highlighted',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(tableConversation.name);
        downloadIcon = chatMessages.getChatMessageTableDownloadIcon(
          expectedChatMessageIndex,
        );
        await chatMessagesAssertion.assertElementState(
          downloadIcon,
          'visible',
          ExpectedMessages.tableDownloadIconIsVisible,
        );
        await downloadIcon.hover();
        await tooltipAssertion.assertTooltipContent(
          expectedDownloadIconTooltip,
        );
        await chatMessagesAssertion.assertElementColor(
          downloadIcon,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
      },
    );

    await dialTest.step(
      'Click on Download button and verify "Download table as CSV" pop-up is shown with suggested file name',
      async () => {
        await downloadIcon.click();
        await baseAssertion.assertElementState(
          downloadTableCsvModal,
          'visible',
          ExpectedMessages.downloadTableCsvModalIsVisible,
        );
        await baseAssertion.assertElementText(
          downloadTableCsvModal.title,
          ExpectedConstants.downloadTableAsCsvModalHeading,
        );
        await baseAssertion.assertElementState(
          downloadTableCsvModal.getCancelButton(),
          'visible',
        );
        await baseAssertion.assertElementState(
          downloadTableCsvModal.confirmButton,
          'visible',
        );
        await baseAssertion.assertInputValue(
          downloadTableCsvModal.filenameInput,
          ExpectedConstants.downloadedCsvTableDefaultName,
        );
      },
    );

    await dialTest.step(
      'Click on Download button in the pop-up and verify the downloaded file contains the whole md table',
      async () => {
        const downloadedData = await dialHomePage.downloadData(() =>
          downloadTableCsvModal.confirmButton.click(),
        );
        await downloadAssertion.assertPlainFileIsDownloaded(downloadedData);
        downloadAssertion.assertDownloadedFileContent(
          downloadedData,
          expectedCsvContent,
        );
        downloadAssertion.assertDownloadFilename(
          downloadedData,
          ExpectedConstants.downloadedCsvTableDefaultName,
        );
      },
    );

    const updatedFilename = `${GeneratorUtil.randomString(7)}.csv`;

    await dialTest.step(
      'Click on Download button again, update the file name leaving the extension and click Download',
      async () => {
        await downloadIcon.click();
        await baseAssertion.assertElementState(
          downloadTableCsvModal,
          'visible',
          ExpectedMessages.downloadTableCsvModalIsVisible,
        );
        await downloadTableCsvModal.filenameInput.fillInInput(updatedFilename);
        const renamedDownloadedData = await dialHomePage.downloadData(() =>
          downloadTableCsvModal.confirmButton.click(),
        );
        downloadAssertion.assertDownloadFilename(
          renamedDownloadedData,
          updatedFilename,
        );
      },
    );
  },
);

dialTest(
  `[MD table] Scroll inside the table appears when it's 68vh`,
  async ({
    dialHomePage,
    setTestIds,
    page,
    chatMessages,
    chatMessagesAssertion,
    localStorageManager,
    conversationData,
    dataInjector,
    conversations,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-6102');
    const rowsCount = 50;
    let tableConversation: Conversation;
    let bodyScrollContainer: BaseElement;
    let headerScrollContainer: BaseElement;
    const maxTableHeight = 0.68;
    const roundingTolerance = 2;

    await dialTest.step(
      'Prepare conversation with a table tall enough to exceed 68% of the viewport height',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        tableConversation =
          conversationData.prepareConversationWithLargeMdTableContent(
            rowsCount,
          );
        await dataInjector.createConversations([tableConversation]);
      },
    );

    await dialTest.step(
      'Open conversation and verify the table body height is capped at 68% of the current viewport and becomes scrollable',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(tableConversation.name);
        bodyScrollContainer =
          chatMessages.getChatMessageTableBodyScrollContainer(
            expectedChatMessageIndex,
          );
        headerScrollContainer =
          chatMessages.getChatMessageTableHeaderScrollContainer(
            expectedChatMessageIndex,
          );
        await chatMessagesAssertion.assertElementState(
          bodyScrollContainer,
          'visible',
        );

        const viewportSize = page.viewportSize();
        const expectedMaxBodyHeight = viewportSize!.height * maxTableHeight;

        const bodyBoundingBox =
          await bodyScrollContainer.getElementBoundingBox();
        baseAssertion.assertNumberIsLessThanOrEqual(
          bodyBoundingBox!.height,
          expectedMaxBodyHeight + roundingTolerance,
          ExpectedMessages.tableBodyHeightNotExceedViewportHeight,
        );
        baseAssertion.assertNumberIsGreaterThan(
          bodyBoundingBox!.height,
          expectedMaxBodyHeight - roundingTolerance,
          ExpectedMessages.tableBodyHeightIsCloseToMaxCap,
        );
        baseAssertion.assertBooleanCondition(
          await bodyScrollContainer.isElementScrollableVertically(),
          true,
          ExpectedMessages.tableBodyIsVerticallyScrollable,
        );
      },
    );

    await dialTest.step(
      'Scroll the table body and verify the header stays fixed above the scrollable area',
      async () => {
        const headerBoundingBoxBefore =
          await headerScrollContainer.getElementBoundingBox();

        await bodyScrollContainer.scrollToTheEnd();
        await baseAssertion.assertScrollPosition(
          headerScrollContainer,
          Properties.scrollTop,
          0,
        );

        const headerBoundingBoxAfter =
          await headerScrollContainer.getElementBoundingBox();
        baseAssertion.assertValue(
          headerBoundingBoxAfter!.y,
          headerBoundingBoxBefore!.y,
          ExpectedMessages.tableHeaderPositionNotChanged,
        );
      },
    );
  },
);
