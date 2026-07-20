import { ChatI18nKeys } from '@/chat/constants/i18n';
import { ChatMessagesAssertion } from '@/src/assertions';
import dialTest from '@/src/core/dialFixtures';
import { Rate } from '@/src/testData';
import { Attributes, ThemeColorAttributes } from '@/src/ui/domData';
import { ChatMessages, DislikeCommentModal } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Conversation } from '@epam/ai-dial-shared';

const dislikeMessage = async (
  chatMessages: ChatMessages,
  chatMessagesAssertion: ChatMessagesAssertion,
  dislikeCommentModal: DislikeCommentModal,
  messageIndex: number,
  comment?: string,
) => {
  await chatMessages.dislikeMessage(messageIndex);
  await chatMessagesAssertion.assertElementState(
    dislikeCommentModal,
    'visible',
  );
  if (comment) {
    await dislikeCommentModal.typeComment(comment);
  }
  await dislikeCommentModal.sendComment();
};

dialTest(
  'Several likes and dislike inside one conversation',
  async ({
    dialHomePage,
    conversationData,
    conversations,
    dataInjector,
    chatMessages,
    chatMessagesAssertion,
    dislikeCommentModal,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7879');
    let historyConversation: Conversation;
    const likedIndices = [2, 6, 10];
    const dislikedWithCommentIndices = [4, 8];
    const dislikedWithoutCommentIndex = 12;

    await dialTest.step(
      'Prepare conversation with 6 user prompt and agent response pairs',
      async () => {
        const conversations: Conversation[] = [];
        for (let i = 1; i <= 6; i++) {
          const conversation = conversationData.prepareDefaultConversation();
          conversations.push(conversation);
          conversationData.resetData();
        }
        historyConversation = conversationData.prepareHistoryConversation(
          ...conversations,
        );
        await dataInjector.createConversations([historyConversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open the conversation and set 3 likes and 3 dislikes with or without a comment',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(historyConversation.name);

        for (const messageIndex of likedIndices) {
          await chatMessages.likeMessage(messageIndex);
        }
        for (const messageIndex of dislikedWithCommentIndices) {
          await dislikeMessage(
            chatMessages,
            chatMessagesAssertion,
            dislikeCommentModal,
            messageIndex,
            GeneratorUtil.randomString(20),
          );
        }
        await dislikeMessage(
          chatMessages,
          chatMessagesAssertion,
          dislikeCommentModal,
          dislikedWithoutCommentIndex,
        );
      },
    );

    await dialTest.step(
      'Verify all likes and dislikes are set correctly inside the chat history',
      async () => {
        for (const messageIndex of likedIndices) {
          await chatMessagesAssertion.assertRate(Rate.like, messageIndex);
        }
        for (const messageIndex of [
          ...dislikedWithCommentIndices,
          dislikedWithoutCommentIndex,
        ]) {
          await chatMessagesAssertion.assertRate(Rate.dislike, messageIndex);
        }
      },
    );
  },
);

dialTest(
  '[Dislike] User clicks on Dislike in agent response. Type comment and click outside the pop-up.\n' +
    'Liked/disliked state is saved for response after page refresh',
  async ({
    dialHomePage,
    conversationData,
    conversations,
    dataInjector,
    chatMessages,
    chatMessagesAssertion,
    dislikeCommentModal,
    localStorageManager,
    page,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7876', 'EPMRTC-7892');
    let historyConversation: Conversation;
    const firstMessageIndex = 2;
    const secondMessageIndex = 4;

    await dialTest.step(
      'Prepare conversation with two prompts and responses',
      async () => {
        const conversations: Conversation[] = [];
        for (let i = 1; i <= 2; i++) {
          const conversation = conversationData.prepareDefaultConversation();
          conversations.push(conversation);
          conversationData.resetData();
        }
        historyConversation = conversationData.prepareHistoryConversation(
          ...conversations,
        );
        await dataInjector.createConversations([historyConversation]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open the conversation, click on Dislike, type comment and click outside the pop-up',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(historyConversation.name);
        await chatMessages.dislikeMessage(firstMessageIndex);
        await chatMessagesAssertion.assertElementState(
          dislikeCommentModal,
          'visible',
        );
        await dislikeCommentModal.typeComment(GeneratorUtil.randomString(20));
        await page.mouse.click(0, 0);
      },
    );

    await dialTest.step(
      'Verify the pop-up is closed, Like and Dislike buttons are still available',
      async () => {
        await chatMessagesAssertion.assertElementState(
          dislikeCommentModal,
          'hidden',
        );
        const likeIcon = chatMessages.getChatMessageRate(
          firstMessageIndex,
          Rate.like,
        );
        await chatMessagesAssertion.assertElementState(likeIcon, 'visible');
        await chatMessagesAssertion.assertElementActionabilityState(
          likeIcon,
          'enabled',
        );
        const dislikeIcon = chatMessages.getChatMessageRate(
          firstMessageIndex,
          Rate.dislike,
        );
        await chatMessagesAssertion.assertElementState(dislikeIcon, 'visible');
        await chatMessagesAssertion.assertElementActionabilityState(
          dislikeIcon,
          'enabled',
        );
      },
    );

    await dialTest.step('Click on Like icon', async () => {
      await chatMessages.likeMessage(firstMessageIndex);
    });

    await dialTest.step(
      'Refresh the page, open the chat again and verify the response still has Liked state',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(historyConversation.name);
        await chatMessagesAssertion.assertRate(Rate.like, firstMessageIndex);
      },
    );

    await dialTest.step(
      'Click on Dislike icon for the new response',
      async () => {
        await dislikeMessage(
          chatMessages,
          chatMessagesAssertion,
          dislikeCommentModal,
          secondMessageIndex,
        );
      },
    );

    await dialTest.step(
      'Refresh the page, open the chat again and verify both responses still have their Liked/Disliked state',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(historyConversation.name);
        await chatMessagesAssertion.assertRate(Rate.like, firstMessageIndex);
        await chatMessagesAssertion.assertRate(
          Rate.dislike,
          secondMessageIndex,
        );
      },
    );
  },
);

dialTest(
  '[Dislike] User clicks on Dislike in agent response. Type huge comment and click on Send.\n' +
    '[Dislike] User clicks on Dislike in agent response. No comment and click on Send.\n' +
    '[Dislike] User clicks on Dislike in agent response. Type comment and click on X.\n' +
    'Like and Dislike highlight and tooltip on hover',
  async ({
    dialHomePage,
    conversationData,
    conversations,
    dataInjector,
    chatMessages,
    chatMessagesAssertion,
    dislikeCommentModal,
    localStorageManager,
    tooltipAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7859', 'EPMRTC-7877', 'EPMRTC-7412', 'EPMRTC-7878');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let thirdConversation: Conversation;
    const messageIndex = 2;
    const hugeComment = Array.from(
      { length: 50 },
      (_, i) =>
        `${' '.repeat(i % 5)}Row ${i + 1}: ${GeneratorUtil.randomString(20)}`,
    ).join('\n');
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textAccentPrimary,
    );

    await dialTest.step(
      'Prepare three conversations with user prompt and agent response',
      async () => {
        firstConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        secondConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        thirdConversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
          thirdConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open first conversation, click on Dislike, type huge multiline comment with indents and click on Send',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(firstConversation.name);
        await chatMessages.dislikeMessage(messageIndex);
        await chatMessagesAssertion.assertElementState(
          dislikeCommentModal,
          'visible',
        );
        await dislikeCommentModal.typeComment(hugeComment);
        await dislikeCommentModal.sendComment();
      },
    );

    await dialTest.step(
      'Verify the pop-up disappears, Dislike icon stays highlighted, Like icon disappears',
      async () => {
        await chatMessagesAssertion.assertElementState(
          dislikeCommentModal,
          'hidden',
        );
        await chatMessagesAssertion.assertRate(Rate.dislike, messageIndex);
      },
    );

    await dialTest.step(
      'Open second conversation, click on Dislike, do not enter any comment and click on Send',
      async () => {
        await conversations.selectEntity(secondConversation.name);
        await chatMessages.dislikeMessage(messageIndex);
        await dislikeCommentModal.sendComment();
      },
    );

    await dialTest.step(
      'Verify the pop-up disappears, Dislike icon stays highlighted, Like icon disappears',
      async () => {
        await chatMessagesAssertion.assertElementState(
          dislikeCommentModal,
          'hidden',
        );
        await chatMessagesAssertion.assertRate(Rate.dislike, messageIndex);
      },
    );

    await dialTest.step(
      'Open third conversation, click on Dislike and verify the pop-up title, hint and Send button',
      async () => {
        await conversations.selectEntity(thirdConversation.name);
        await chatMessages.dislikeMessage(messageIndex);
        await chatMessagesAssertion.assertElementText(
          dislikeCommentModal.title,
          ChatI18nKeys.SendFeedback,
        );
        await chatMessagesAssertion.assertElementAttribute(
          dislikeCommentModal.commentInput,
          Attributes.placeholder,
          ChatI18nKeys.OptionalFeedbackComment,
        );
        await chatMessagesAssertion.assertElementState(
          dislikeCommentModal.sendButton,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Type comment in the pop-up and verify it is entered',
      async () => {
        const comment = GeneratorUtil.randomString(20);
        await dislikeCommentModal.typeComment(comment);
        await chatMessagesAssertion.assertInputValue(
          dislikeCommentModal.commentInput,
          comment,
        );
      },
    );

    await dialTest.step(
      'Click on X and verify the pop-up is closed, Like and Dislike buttons are still available',
      async () => {
        await dislikeCommentModal.close();
        await chatMessagesAssertion.assertElementState(
          dislikeCommentModal,
          'hidden',
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getChatMessageRate(messageIndex, Rate.like),
          'visible',
        );
        await chatMessagesAssertion.assertElementActionabilityState(
          chatMessages.getChatMessageRate(messageIndex, Rate.like),
          'enabled',
        );
        const dislikeIcon = chatMessages.getChatMessageRate(
          messageIndex,
          Rate.dislike,
        );
        await chatMessagesAssertion.assertElementState(dislikeIcon, 'visible');
        await chatMessagesAssertion.assertElementActionabilityState(
          dislikeIcon,
          'enabled',
        );
      },
    );

    await dialTest.step(
      'Click on Dislike again and verify the pop-up is opened with no text from previous steps',
      async () => {
        await chatMessages.dislikeMessage(messageIndex);
        await chatMessagesAssertion.assertInputValue(
          dislikeCommentModal.commentInput,
          '',
        );
      },
    );

    await dialTest.step(
      'Close the pop-up, hover over Like and Dislike icons and verify they are highlighted and tooltip is shown',
      async () => {
        await dislikeCommentModal.close();

        for (const rate of Object.values(Rate)) {
          const icon = chatMessages.getChatMessageRate(messageIndex, rate);
          await icon.hover();
          await tooltipAssertion.assertTooltipContent(
            rate === Rate.like ? ChatI18nKeys.Like : ChatI18nKeys.Dislike,
          );
          await chatMessagesAssertion.assertElementColor(icon, expectedColor);
        }
      },
    );
  },
);
