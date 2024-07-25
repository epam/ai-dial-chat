import sidebar from '@/chat/components/Sidebar';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Overflow, Styles } from '@/src/ui/domData';
import { PromptBarSelectors } from '@/src/ui/selectors';
import { expect } from '@playwright/test';

dialTest.only(
  'Prompt name consists of a maximum of 160 symbols.\n' +
    'Long prompt name is cut in the panel',
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
    setTestIds('EPMRTC-3171', 'EPMRTC-958');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);
    const longPromptName =
      'Lorem ipsum dolor sit amett consectetur adipiscing elit. Nullam ultricies ipsum nullaa nec viverra lectus rutrum id. Sed volutpat ante ac fringilla turpis duis!ABC';
    const expectedPromptName = longPromptName.substring(
      0,
      ExpectedConstants.maxEntityNameLength,
    );
    const longName =
      'This prompt is renamed to very long-long-long name to see how the system cuts the name';

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
          { name: expectedPromptName },
          'visible',
        );
        await errorToastAssertion.assertToastIsHidden();
      },
    );

    await dialTest.step('Rename the prompt to a long name', async () => {
      await prompts.openEntityDropdownMenu(expectedPromptName);
      await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
      await promptModalDialog.setField(promptModalDialog.name, longName);
      await promptModalDialog.saveButton.click();
    });

    await dialTest.step('Check the prompt name in the panel', async () => {
      const promptNameElement = prompts.getPromptName(longName);
      const promptNameOverflow =
        await promptNameElement.getComputedStyleProperty(Styles.text_overflow);
      //TODO find a method with the request to wait for the actual update
      expect
        .soft(promptNameOverflow[0], ExpectedMessages.entityNameIsTruncated)
        .toBe(Overflow.ellipsis);
    });

    await dialTest.step(
      'Hover over the prompt name and check the name in the panel',
      async () => {
        await prompts.getPromptName(longName).hoverOver();
        await promptAssertion.assertEntityDotsMenuState(
          { name: longName },
          'visible',
        );
      },
    );
  },
);
