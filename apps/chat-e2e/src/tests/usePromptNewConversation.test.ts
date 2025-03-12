import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedMessages,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialTest.only(
  'Use own prompt for new conversation\n' +
    'Use own prompt for chat with history',
  async ({
    dialHomePage,
    header,
    prompts,
    promptDropdownMenu,
    sendMessageAssertion,
    setTestIds,
    promptData,
    dataInjector,
    sendMessage,
    chat,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-5486', 'EPMRTC-5487');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);
    const initialMessage = GeneratorUtil.randomString(10);
    const message = GeneratorUtil.randomString(10);
    await localStorageManager.setShowSideBarPanels();

    await dialTest.step('Open Dial and create a new conversation', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    await dialTest.step('Type initial message', async () => {
      await sendMessage.messageInput.fillInInput(initialMessage);
      await sendMessageAssertion.assertMessageValue(initialMessage);
    });

    await dialTest.step('Use prompt from context menu', async () => {
      await prompts.openEntityDropdownMenu(prompt.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.use, {
        triggeredHttpMethod: 'GET',
      });
      await sendMessageAssertion.assertMessageValue(
        `${initialMessage} ${prompt.content}`,
      );
    });

    await dialTest.step(
      'Type message, get response, type data, and use prompt from context menu',
      async () => {
        await sendMessage.clearMessageInput();
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(message);
        await sendMessage.messageInput.fillInInput(initialMessage);
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.use);
        await sendMessageAssertion.assertMessageValue(
          `${initialMessage} ${prompt.content}`,
        );
      },
    );
  },
);
