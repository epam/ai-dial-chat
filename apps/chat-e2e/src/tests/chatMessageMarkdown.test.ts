import { Conversation } from '@/chat/types/chat';
import config from '@/config/chat.playwright.config';
import dialTest from '@/src/core/dialFixtures';
import { API, Attachment } from '@/src/testData';
import { FileUtil } from '@/src/utils';
import { markdownToTxt } from 'markdown-to-txt';
import path from 'path';

const resolvedImagePath = path.resolve(
  Attachment.attachmentPath,
  Attachment.sunImageName,
);
const base64ImageUrl = `data:image/png;base64,${FileUtil.getBase64FileContent(resolvedImagePath)}`;
const externalImageUrl = `https://example.com/images/${crypto.randomUUID()}.png`;

dialTest(
  'Displaying base64 images (inline md)',
  async ({
    page,
    dialHomePage,
    setTestIds,
    conversations,
    conversationData,
    dataInjector,
    localStorageManager,
    fileApiHelper,
    chatMessagesAssertion,
  }) => {
    setTestIds('EPMRTC-8108');
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
      'Intercept the fake external URL and serve the real image',
      async () => {
        await page.context().route(externalImageUrl, async (route) => {
          await route.fulfill({
            status: 200,
            headers: {
              'Content-Type': 'image/png',
            },
            path: resolvedImagePath,
          });
        });
      },
    );

    await dialTest.step(
      'Open conversation with the image response and verify image is rendered',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const conversation of imageConversations) {
          await conversations.selectEntity(conversation.name);
          await chatMessagesAssertion.assertMessageImageLoaded(2);
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
    setTestIds('EPMRTC-8109');
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
              `[image](${imageUrl})`,
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
          } else {
            await chatMessages.getAttachmentLink(2).click();
            imgUrl === relativeImageUrl
              ? baseAssertion.assertValue(
                  page.url(),
                  config.use?.baseURL?.concat(expectedUrl as string),
                )
              : baseAssertion.assertValueMatchPattern(page.url(), expectedUrl);
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
    setTestIds('EPMRTC-6142', 'EPMRTC-431', 'EPMRTC-8313');

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
