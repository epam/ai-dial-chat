import { Conversation } from '@/chat/types/chat';
import config from '@/config/chat.playwright.config';
import dialTest from '@/src/core/dialFixtures';
import { API, Attachment } from '@/src/testData';
import { FileUtil } from '@/src/utils';
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

    await dialTest.step(
      'Open conversation with the image response and verify only external image is opened in a new tab on click',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        let expectedUrl = '';
        for (const [imgUrl, conversation] of imageConversationsMap) {
          await conversations.selectEntity(conversation.name);
          switch (imgUrl) {
            case relativeImageUrl:
              expectedUrl = `${API.api}/${imgUrl}`;
              break;
            case base64ImageUrl:
              expectedUrl = base64ImageUrl;
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
            baseAssertion.assertValue(popup.url(), expectedUrl);
          }
          //TODO: remove 'if' condition when fixed https://github.com/epam/ai-dial-chat/issues/6229
          else if (imgUrl !== base64ImageUrl) {
            await chatMessages.getAttachmentLink(2).click();
            baseAssertion.assertValue(
              page.url(),
              config.use?.baseURL?.concat(expectedUrl),
            );
            await dialHomePage.navigateBack();
          }
        }
      },
    );
  },
);
