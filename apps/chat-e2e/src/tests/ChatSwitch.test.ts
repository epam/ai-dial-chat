import dialTest from '@/src/core/dialFixtures';
import {API, ExpectedConstants, ExpectedMessages, MenuOptions} from '@/src/testData';
import {expect} from '@playwright/test';
import {Conversation} from "@/chat/types/chat";
import {responseThrottlingTimeout} from "@/src/ui/pages";
import {Styles} from "@/src/ui/domData";
import {Cursors} from "@/src/ui/domData";

dialTest.only(
  'Another chat is not available while AI is generating a response.\n' +
  'Chat menu is not available while AI is generating a response',
  async ({
           dialHomePage,
           conversations,
           conversationData,
           dataInjector,
           setTestIds,
           localStorageManager,
           chat,
           chatBar,
           sendMessage,
         }) => {
    setTestIds('EPMRTC-598', 'EPMRTC-599', 'EPMRTC-600');
    const request =
      'give me a sci-fi story with a main topic of your choice. 200 tokens minimum';
    let firstConversation: Conversation;
    let secondConversation: Conversation;

    await dialTest.step('Prepare two empty conversations', async () => {
      firstConversation = conversationData.prepareEmptyConversation();
      conversationData.resetData();
      secondConversation = conversationData.prepareEmptyConversation();
      await dataInjector.createConversations([
        firstConversation,
        secondConversation,
      ]);
      await localStorageManager.setSelectedConversation(firstConversation);
    });

    await dialTest.step(
      'Send request to the first conversation',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.throttleAPIResponse(
          API.chatHost,
          responseThrottlingTimeout,
        );

        await chat.sendRequestWithButton(
          request,
          false,
        );
      }
    )

    await dialTest.step(
      'Verify conversation name cursor is "not-allowed" during the text generation',
      async () => {
        await conversations.getEntityByName(request).hover();
        let style = await conversations.getConversationName(request).getComputedStyleProperty(Styles.cursor);
        expect
          .soft(
            style[0],
            ExpectedMessages.sendButtonCursorIsNotAllowed,
          )
          .toBe(Cursors.notAllowed);

        await conversations.getEntityByName(secondConversation.name).hover();
        style = await conversations.getConversationName(request).getComputedStyleProperty(Styles.cursor);
        expect
          .soft(
            style[0],
            ExpectedMessages.sendButtonCursorIsNotAllowed,
          )
          .toBe(Cursors.notAllowed);;
      },
    )



    await dialTest.step(
      'Verify another conversation is not selectable during the text generation',
      async () => {
        await conversations.selectConversation(secondConversation.name);
        await expect
          .soft(
            conversations.selectedConversation(request),
            ExpectedMessages.conversationIsSelected,
          )
          .toBeHidden();
      },
    )
  },
);
