import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedConstants, ExpectedMessages, MenuOptions } from '@/src/testData';
import { expect } from '@playwright/test';
import { Conversation } from "@/chat/types/chat";
import { responseThrottlingTimeout } from "@/src/ui/pages";
import { Styles } from "@/src/ui/domData";
import { Cursors } from "@/src/ui/domData";
import {CompareSelectors} from "@/src/ui/selectors";

dialTest.only(
  'Another chat is not available while AI is generating a response.\n' +
  'Chat menu is not available while AI is generating a response.\n' +
  'Switching to another chat is not available while AI is replaying a chat\n' +
  'Switching to another chat is not available while AI is regenerating response in compare mode',
  async ({
           dialHomePage,
           conversations,
           conversationData,
           dataInjector,
           setTestIds,
           localStorageManager,
           chat,
           chatMessages,
           compareConversationSelector,
           compareConversation,
         }) => {
    setTestIds('EPMRTC-598', 'EPMRTC-599', 'EPMRTC-600', 'EPMRTC-601', 'EPMRTC-602');
    const request =
      'give me a sci-fi story with a main topic of your choice. 200 tokens minimum';
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let thirdConversationName: string;

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
        firstConversation.name = request;
      }
    )

    await dialTest.step(
      'Verify conversation name cursor is "not-allowed" during the text generation',
      async () => {
        await conversations.getEntityByName(firstConversation.name).hover();
        let style = await conversations.getConversationName(firstConversation.name).getComputedStyleProperty(Styles.cursor);
        expect
          .soft(
            style[0],
            ExpectedMessages.selectConversationCursorIsNotAllowed,
          )
          .toBe(Cursors.notAllowed);

        await conversations.getEntityByName(secondConversation.name).hover();
        style = await conversations.getConversationName(secondConversation.name).getComputedStyleProperty(Styles.cursor);
        expect
          .soft(
            style[0],
            ExpectedMessages.selectConversationCursorIsNotAllowed,
          )
          .toBe(Cursors.notAllowed);
      },
    )

    await dialTest.step(
      'Verify another conversation is not selectable during the text generation',
      async () => {
        await conversations.getEntityByName(secondConversation.name).click();

        // Assert that the first conversation is still selected
        await expect
          .soft(
            conversations.selectedConversation(firstConversation.name),
            ExpectedMessages.conversationIsSelected,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Select "Replay" option from the first conversation menu',
      async () => {
        await chatMessages.waitForResponseReceived();

        await conversations.openEntityDropdownMenu(firstConversation.name);
        await conversations.selectEntityMenuOption(MenuOptions.replay, {
          triggeredHttpMethod: 'POST',
        });
        thirdConversationName = `${ExpectedConstants.replayConversation}${firstConversation.name}`;
        await chat.startReplay();
      },
    );

    await dialTest.step(
      'Verify conversation name cursor is "not-allowed" during the chat replay',
      async () => {
        await conversations.getEntityByName(secondConversation.name).hover();
        let style = await conversations.getConversationName(secondConversation.name).getComputedStyleProperty(Styles.cursor);
        expect
          .soft(
            style[0],
            ExpectedMessages.selectConversationCursorIsNotAllowed,
          )
          .toBe(Cursors.notAllowed);
      },
    );

    await dialTest.step(
      'Open compare mode for replayed conversation',
      async () => {
        await chatMessages.waitForResponseReceived();
        await conversations.openEntityDropdownMenu(firstConversation.name, 2);
        await conversations.selectEntityMenuOption(MenuOptions.compare);

        await compareConversation.checkShowAllConversations();
        await compareConversationSelector.click();

        // await compareConversationSelector.getListOptions();
        await compareConversationSelector.selectModel(firstConversation.name, true);
        await chat.getCompare().waitForComparedConversationsLoaded();
      }
    );

    await dialTest.step(
      'Verify another conversation is selectable during response regeneration in compare mode',
      async () => {
        await conversations.getEntityByName(secondConversation.name).hover();
        let style = await conversations.getConversationName(secondConversation.name).getComputedStyleProperty(Styles.cursor);
        expect
          .soft(
            style[0],
            ExpectedMessages.selectConversationCursorIsPointer,
          )
          .toBe(Cursors.pointer);

        await conversations.getEntityByName(secondConversation.name).click();
        await expect
          .soft(
            conversations.selectedConversation(secondConversation.name),
            ExpectedMessages.conversationIsSelected,
          )
          .toBeVisible();
      },
    );
  },
);
