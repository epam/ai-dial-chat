import dialTest from '@/src/core/dialFixtures';
import {ExpectedConstants, ExpectedMessages, MenuOptions} from '@/src/testData';
import {expect} from '@playwright/test';

dialTest.only(
  'Prompt name consists max of 160 symbols',
  async ({
           dialHomePage,
           promptData,
           dataInjector,
           prompts,
           promptDropdownMenu,
           promptModalDialog,
           errorToastAssertion,
           promptAssertion,
           setTestIds,
           promptBar,
         }) => {
    setTestIds('EPMRTC-3171');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);
    const longPromptName =
      'Lorem ipsum dolor sit amett consectetur adipiscing elit. Nullam ultricies ipsum nullaa nec viverra lectus rutrum id. Sed volutpat ante ac fringilla turpis duis!ABC';
    const expectedPromptName = longPromptName.substring(
      0,
      ExpectedConstants.maxEntityNameLength,
    );

    await dialTest.step(
      'Create a prompt and enter text longer than 160 symbols',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await promptBar.createNewPrompt();
        await promptModalDialog.setField(
          promptModalDialog.name,
          longPromptName,
        );
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          ExpectedConstants.newPromptTitle(1),
        );
      },
    );

    await dialTest.step('Save the prompt', async () => {
      await promptModalDialog.saveButton.click();
    });

    await dialTest.step(
      'Verify the prompt name is cut to 160 symbols and no error toast is shown',
      async () => {
        await promptAssertion.assertEntityState(
          {name: expectedPromptName},
          'visible',
        );
        await errorToastAssertion.assertToastIsHidden();
      },
    );
  },
);
