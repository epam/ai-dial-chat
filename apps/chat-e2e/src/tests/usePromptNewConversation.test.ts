import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, MenuOptions } from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialTest.only(
  'Use own prompt for new conversation',
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
         }) => {
    setTestIds('EPMRTC-5486');
    // const promptContent = GeneratorUtil.randomString(20);
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialTest.step('Open Dial and create a new conversation', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
    });

    const initialMessage = GeneratorUtil.randomString(10);

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
        `${initialMessage} ${prompt.content}`
      );
    });
  },
);
