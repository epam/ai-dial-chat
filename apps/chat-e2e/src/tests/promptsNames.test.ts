import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';

dialTest(
  'Error message appears if to add a dot to the end of prompt name.\n' +
    'Prompt name: allowed special characters.\n' +
    'Prompt name: restricted special characters are not allowed to be entered while renaming.\n' +
    'Prompt name: restricted special characters are removed from prompt name if to copy-paste.\n' +
    'Prompt name: smiles, hieroglyph, specific letters in name.\n' +
    'Prompt name: spaces in the middle of prompt name stay',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    prompts,
    promptDropdownMenu,
    promptModalDialog,
    toast,
    toastAssertion,
    promptAssertion,
    setTestIds,
    promptModalAssertion,
  }) => {
    setTestIds(
      'EPMRTC-2991',
      'EPMRTC-1278',
      'EPMRTC-2993',
      'EPMRTC-2994',
      'EPMRTC-2997',
      'EPMRTC-3085',
    );
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);
    const newNameWithDot = `${ExpectedConstants.newPromptTitle(1)}.`;
    const nameWithRestrictedChars = `Prompt${ExpectedConstants.restrictedNameChars}_name`;
    const expectedPromptName = 'Prompt_name';
    const longNameWithEmojis =
      '😂👍🥳 😷 🤧 🤠 🥴😇 😈 ⭐あおㅁㄹñ¿äß😂👍🥳 😷 🤧 🤠 🥴😇 😈 ⭐あおㅁㄹñ¿äß😂👍🥳 😷 🤧 🤠 🥴😇 😈 ⭐あおㅁㄹñ¿äß';
    const nameWithSpaces = ' Prompt 1 ';
    const expectedNameWithSpaces = nameWithSpaces.trim();

    await dialTest.step('Add a dot at the end of a prompt name', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await prompts.openEntityDropdownMenu(prompt.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
      await promptModalDialog.setField(promptModalDialog.name, newNameWithDot);
    });

    await dialTest.step(
      'Check that the name field is red-bordered and an error message appears',
      async () => {
        await promptModalAssertion.assertNameFieldIsInvalid(
          ExpectedConstants.nameWithDotErrorMessage,
        );
      },
    );

    await dialTest.step(
      'Fill in the prompt body and click the Save button',
      async () => {
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          ExpectedConstants.newPromptTitle(1),
        );
        await promptModalDialog.saveButton.click();
      },
    );

    await dialTest.step('Check that a UI error appears', async () => {
      await toastAssertion.assertToastIsVisible();
      await toastAssertion.assertToastMessage(
        ExpectedConstants.nameWithDotErrorMessage,
        ExpectedMessages.notAllowedNameErrorShown,
      );
      // Wating for (Closing) the toast to move forward
      await toast.waitForState({ state: 'hidden' });
    });

    await dialTest.step(
      'Type restricted characters one by one in the Rename prompt dialog',
      async () => {
        for (const char of ExpectedConstants.restrictedNameChars.split('')) {
          await promptModalDialog.setField(promptModalDialog.name, char);
          await promptModalAssertion.assertNameFieldIsEmpty();
        }
      },
    );

    await dialTest.step(
      'Copy and paste restricted characters to the prompt name and verify the name',
      async () => {
        await dialHomePage.copyToClipboard(nameWithRestrictedChars);
        await promptModalDialog.name.click();
        await dialHomePage.pasteFromClipboard();
        await promptModalAssertion.assertPromptName(expectedPromptName);
        await promptModalDialog.saveButton.click();
        prompt.name = expectedPromptName;
      },
    );

    await dialTest.step(
      'Verify the prompt is created and no error toast is shown',
      async () => {
        await promptAssertion.assertEntityState(
          { name: expectedPromptName },
          'visible',
        );
        await toastAssertion.assertToastIsHidden();
      },
    );

    await dialTest.step(
      'Add special characters to the prompt name',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          ExpectedConstants.allowedSpecialSymbolsInName(),
        );
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          ExpectedConstants.newPromptTitle(1),
        );
        await promptModalDialog.saveButton.click();
        prompt.name = ExpectedConstants.allowedSpecialSymbolsInName();
      },
    );

    await dialTest.step(
      'Verify the prompt is created and no error toast is shown',
      async () => {
        await promptAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
        await toastAssertion.assertToastIsHidden();
      },
    );

    await dialTest.step(
      'Update the prompt name to a long name with emojis',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          longNameWithEmojis,
        );
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          ExpectedConstants.newPromptTitle(1),
        );
        await promptModalDialog.saveButton.click();
        prompt.name = longNameWithEmojis;
      },
    );

    await dialTest.step(
      'Verify the prompt is renamed successfully and the name looks fine on the Prompt panel',
      async () => {
        await promptAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
        await toastAssertion.assertToastIsHidden();
      },
    );

    await dialTest.step(
      'Update the prompt name to " Prompt 1 " (spaces before, after, and in the middle)',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          nameWithSpaces,
        );
        await promptModalDialog.saveButton.click();
        prompt.name = expectedNameWithSpaces;
      },
    );

    await dialTest.step('Verify the prompt name is "Prompt 1"', async () => {
      await promptAssertion.assertEntityState({ name: prompt.name }, 'visible');
      await toastAssertion.assertToastIsHidden();
    });
  },
);
