import { Conversation } from '@/chat/types/chat';
import config from '@/config/chat.playwright.config';
import dialTest from '@/src/core/dialFixtures';
import { API, Attachment, ExpectedMessages } from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { FileUtil } from '@/src/utils';
import { markdownToTxt } from 'markdown-to-txt';
import path from 'path';

const resolvedImagePath = path.resolve(
  Attachment.attachmentPath,
  Attachment.sunImageName,
);
const base64ImageUrl = `data:image/png;base64,${FileUtil.getBase64FileContent(resolvedImagePath)}`;
const externalImageUrl = `https://example.com/images/${crypto.randomUUID()}.png`;
const imageLinkText = 'image';

dialTest(
  'Displaying base64 images (inline md)',
  async ({
    dialHomePage,
    setTestIds,
    conversations,
    conversationData,
    dataInjector,
    localStorageManager,
    fileApiHelper,
    chatMessages,
    chatMessagesAssertion,
  }) => {
    setTestIds('EPMDIAL-6101');
    let imageConversations: Conversation[] = [];

    await dialTest.step(
      'Upload an image and prepare conversations with different image references via API',
      async () => {
        const relativeImageUrl = await fileApiHelper.putFile(
          Attachment.sunImageName,
        );
        for (const imageUrl of [
          relativeImageUrl,
          externalImageUrl,
          base64ImageUrl,
        ]) {
          const conversation =
            conversationData.prepareConversationWithTextContent(
              `![image](${imageUrl})`,
            );
          conversationData.resetData();
          imageConversations.push(conversation);
        }
        await dataInjector.createConversations(imageConversations);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation with the image response and verify image is rendered',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const conversation of imageConversations) {
          await conversations.selectEntity(conversation.name);
          if (conversation.messages[1].content.includes(externalImageUrl)) {
            await chatMessagesAssertion.assertElementState(
              chatMessages.getChatMessageImage(2),
              'hidden',
            );
          } else {
            await chatMessagesAssertion.assertMessageImageLoaded(2);
          }
        }
      },
    );
  },
);

dialTest(
  'Displaying links to base64 images (inline md)',
  async ({
    page,
    dialHomePage,
    setTestIds,
    conversations,
    baseAssertion,
    conversationData,
    dataInjector,
    localStorageManager,
    fileApiHelper,
    chatMessages,
    chatMessagesAssertion,
  }) => {
    setTestIds('EPMDIAL-6106');
    let imageConversationsMap: Map<string, Conversation> = new Map();
    let relativeImageUrl: string;
    let expectedUrl: string | RegExp = '';

    await dialTest.step(
      'Upload an image and prepare conversations with different image references via API',
      async () => {
        relativeImageUrl = await fileApiHelper.putFile(Attachment.sunImageName);
        for (const imageUrl of [
          relativeImageUrl,
          externalImageUrl,
          base64ImageUrl,
        ]) {
          const conversation =
            conversationData.prepareConversationWithTextContent(
              `[${imageLinkText}](${imageUrl})`,
            );
          conversationData.resetData();
          imageConversationsMap.set(imageUrl, conversation);
        }
        await dataInjector.createConversations(
          imageConversationsMap.values().toArray(),
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step('Open Dial', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    for (const [imgUrl, conversation] of imageConversationsMap) {
      await dialTest.step(
        `Open conversation with ${imgUrl} image url response and verify it is opened on a ${imgUrl === externalImageUrl ? 'new' : 'same'} tab`,
        async () => {
          await conversations.selectEntity(conversation.name);
          switch (imgUrl) {
            case relativeImageUrl:
              expectedUrl = `${API.api}/${imgUrl}`;
              break;
            case base64ImageUrl:
              expectedUrl = new RegExp(
                `^blob:${config.use?.baseURL}\\/[\\da-f-]{36}$`,
              );
              break;
            case externalImageUrl:
              expectedUrl = externalImageUrl;
              break;
          }
          await chatMessagesAssertion.assertMessageImageLink(2, expectedUrl);
          if (imgUrl === externalImageUrl) {
            await chatMessagesAssertion.assertMessageImageOpenedInNewTab(2);
            const popupPromise = page.waitForEvent('popup');
            await chatMessages.getAttachmentLink(2).click();
            const popup = await popupPromise;
            await popup.waitForLoadState('domcontentloaded');
            baseAssertion.assertValue(popup.url(), expectedUrl as string);
          } else if (imgUrl === base64ImageUrl) {
            // Base64 image links are downloaded with the link text as a name, not navigated to
            await chatMessagesAssertion.assertMessageImageDownloadName(
              2,
              `${imageLinkText}.png`,
            );
          } else {
            await chatMessages.getAttachmentLink(2).click();
            baseAssertion.assertValue(
              page.url(),
              config.use?.baseURL?.concat(expectedUrl as string),
            );
            await dialHomePage.navigateBack();
          }
        },
      );
    }
  },
);

dialTest(
  'LaTex syntax support in response.\n' +
    `[Code block] Copy the whole answer (the message with code block) using 'Copy text' button.\n` +
    `[Code block] Copy the whole answer (the message with code block) using 'Copy markdown' button`,
  async ({
    dialHomePage,
    setTestIds,
    conversations,
    conversationData,
    dataInjector,
    localStorageManager,
    chatMessages,
    chatMessagesAssertion,
  }) => {
    setTestIds('EPMDIAL-6111', 'EPMDIAL-6075', 'EPMDIAL-6076');

    let conversation: Conversation;
    const codeTitle = 'latex';
    const codeContent = `1. Inline:\n\\( E = mc^2 \\)`;
    const markdownResponse =
      'Sure — here is **LaTeX formula**:\n\n```' +
      `${codeTitle}\n${codeContent}`;
    const rowResponse = markdownToTxt(markdownResponse);

    await dialTest.step(
      'Prepare conversations with LaTex formula in the response',
      async () => {
        conversation =
          conversationData.prepareConversationWithTextContent(markdownResponse);
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation and verify LaTex is displayed as a code block',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatMessagesAssertion.assertElementText(
          chatMessages.getChatMessageCodeTitleContainer(2),
          codeTitle,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageCodeTitleCopyButton(2),
          'visible',
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageCodeTitleDownloadButton(2),
          'visible',
        );
        await chatMessagesAssertion.assertElementText(
          chatMessages.getChatMessageCode(2),
          codeContent,
        );
      },
    );

    await dialTest.step(
      `Click on 'Copy text' btn and verify the response is copied without markdown`,
      async () => {
        const copiedText = await dialHomePage.captureNextClipboardWrite(() =>
          chatMessages.messageCopyTextButton(2).click(),
        );
        chatMessagesAssertion.assertCopiedMessage(copiedText, rowResponse);
      },
    );

    await dialTest.step(
      `Click on 'Copy markdown' btn and verify the response is copied with markdown`,
      async () => {
        const copiedMarkdown = await dialHomePage.captureNextClipboardWrite(
          () => chatMessages.messageCopyMarkdownButton(2).click(),
        );
        chatMessagesAssertion.assertCopiedMessage(
          copiedMarkdown,
          markdownResponse,
        );
      },
    );
  },
);

dialTest(
  'Markdown recognition in the model output',
  async ({
    dialHomePage,
    setTestIds,
    conversations,
    conversationData,
    dataInjector,
    localStorageManager,
    chatMessages,
    baseAssertion,
  }) => {
    setTestIds('EPMDIAL-6107');

    const dollarResponse = '$2 + $3 is equal to $5.';
    const poemLines = [
      'Roses are red,',
      'Violets are blue,',
      'Sugar is sweet,',
      'And so are you.',
    ];
    const poemResponse = poemLines.join('\n');
    const dollarMessageIndex = 2;
    const poemMessageIndex = 4;
    let conversation: Conversation;

    await dialTest.step(
      'Prepare conversation with several prompts: one response contains a dollar amount, another - a multi-line poem',
      async () => {
        const dollarConversation =
          conversationData.prepareConversationWithTextContent(dollarResponse);
        conversationData.resetData();
        const poemConversation =
          conversationData.prepareConversationWithTextContent(poemResponse);
        conversation = conversationData.prepareHistoryConversation(
          dollarConversation,
          poemConversation,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation and verify the dollar amounts are rendered literally as a single row, not swallowed as LaTeX',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await baseAssertion.assertElementText(
          chatMessages.getChatMessageContent(dollarMessageIndex),
          dollarResponse,
          ExpectedMessages.messageContentIsValid,
        );
      },
    );

    await dialTest.step(
      'Verify the poem is rendered with each line preserved as a separate row',
      async () => {
        baseAssertion.assertValuesAreEqual(
          await chatMessages.getChatMessageContentLines(poemMessageIndex),
          poemLines,
          ExpectedMessages.messageContentIsValid,
        );
      },
    );
  },
);

dialTest(
  'Md is collapsed',
  async ({
    dialHomePage,
    setTestIds,
    conversations,
    conversationData,
    dataInjector,
    localStorageManager,
    chatMessages,
    chatMessagesAssertion,
  }) => {
    setTestIds('EPMDIAL-6096');

    const codeBlock = '```ruby\nputs "Hello World"\n```';
    const expectedSummaries = [
      'Root collapsed sections',
      'First level collapsed sections',
      'Second level collapsed sections',
    ];
    const secondLevelSection =
      `<details>\n<summary>${expectedSummaries[2]}</summary>\n\n` +
      `${codeBlock}\n\n` +
      `</details>`;
    const firstLevelSection =
      `<details>\n<summary>${expectedSummaries[1]}</summary>\n\n` +
      `${codeBlock}\n\n` +
      `${secondLevelSection}\n\n` +
      `</details>`;
    const rootSection =
      `<details>\n<summary>${expectedSummaries[0]}</summary>\n\n` +
      'You can add text within a collapsed section.\n\n' +
      'You can add an image or a code block, too.\n\n' +
      `${codeBlock}\n\n` +
      `${firstLevelSection}\n\n` +
      `</details>`;
    const messageIndex = 2;
    let conversation: Conversation;

    await dialTest.step(
      'Prepare conversation with a response containing root, first level and second level nested collapsed sections',
      async () => {
        conversation =
          conversationData.prepareConversationWithTextContent(rootSection);
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open conversation and verify all collapsed sections are rendered, collapsed by default',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await chatMessagesAssertion.assertElementsCount(
          chatMessages.getChatMessageDetailsSection(messageIndex),
          expectedSummaries.length,
          ExpectedMessages.collapsedSectionsCountIsValid,
        );
        for (let i = 1; i <= expectedSummaries.length; i++) {
          await chatMessagesAssertion.assertElementText(
            chatMessages.getChatMessageDetailsSummary(messageIndex, i),
            expectedSummaries[i - 1],
            ExpectedMessages.collapsedSectionSummaryIsValid,
          );
        }
        await chatMessagesAssertion.assertElementAttributeAbsence(
          chatMessages.getChatMessageDetailsSection(messageIndex, 1),
          Attributes.open,
          ExpectedMessages.collapsedSectionIsCollapsed,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageDetailsSummary(messageIndex, 1),
          'visible',
          ExpectedMessages.sectionIsVisible,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageDetailsSummary(messageIndex, 2),
          'hidden',
          ExpectedMessages.sectionIsNotVisible,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageDetailsSummary(messageIndex, 3),
          'hidden',
          ExpectedMessages.sectionIsNotVisible,
        );
      },
    );

    await dialTest.step(
      'Expand the root section and verify the first level section becomes visible, still collapsed',
      async () => {
        await chatMessages.expandDetailsSummary(messageIndex, 1);
        await chatMessagesAssertion.assertElementAttribute(
          chatMessages.getChatMessageDetailsSection(messageIndex, 1),
          Attributes.open,
          '',
          ExpectedMessages.collapsedSectionIsExpanded,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageDetailsSummary(messageIndex, 1),
          'visible',
          ExpectedMessages.sectionIsVisible,
        );
        await chatMessagesAssertion.assertElementAttributeAbsence(
          chatMessages.getChatMessageDetailsSummary(messageIndex, 2),
          Attributes.open,
          ExpectedMessages.collapsedSectionIsCollapsed,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageDetailsSummary(messageIndex, 3),
          'hidden',
          ExpectedMessages.sectionIsNotVisible,
        );
      },
    );

    await dialTest.step(
      'Expand the first level section and verify the second level section becomes visible, still collapsed',
      async () => {
        await chatMessages.expandDetailsSummary(messageIndex, 2);
        await chatMessagesAssertion.assertElementAttribute(
          chatMessages.getChatMessageDetailsSection(messageIndex, 2),
          Attributes.open,
          '',
          ExpectedMessages.collapsedSectionIsExpanded,
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageDetailsSummary(messageIndex, 3),
          'visible',
          ExpectedMessages.sectionIsVisible,
        );
        await chatMessagesAssertion.assertElementAttributeAbsence(
          chatMessages.getChatMessageDetailsSummary(messageIndex, 3),
          Attributes.open,
          ExpectedMessages.collapsedSectionIsCollapsed,
        );
      },
    );

    await dialTest.step(
      'Expand the second level section and verify it becomes visible',
      async () => {
        await chatMessages.expandDetailsSummary(messageIndex, 3);
        await chatMessagesAssertion.assertElementAttribute(
          chatMessages.getChatMessageDetailsSection(messageIndex, 3),
          Attributes.open,
          '',
          ExpectedMessages.collapsedSectionIsExpanded,
        );
      },
    );
  },
);
