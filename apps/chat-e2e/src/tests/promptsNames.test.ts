import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import {Colors} from '@/src/ui/domData';
import {expect} from '@playwright/test';

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
           errorToast,
           errorToastAssertion,
           promptAssertion,
           setTestIds,
           promptBar,
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
    const expectedNameWithSpaces = 'Prompt 1';

    await dialTest.step(
      'Add a dot at the end of a prompt name',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(promptModalDialog.name, newNameWithDot);
      },
    );

    await dialTest.step(
      'Check that the name field is red-bordered and an error message appears',
      async () => {
        // Retrieve the computed border colors for all sides of the "Name" field
        const nameBorderColors = await promptModalDialog.name.getAllBorderColors();

        // Iterate through each border side (top, bottom, left, right)
        Object.values(nameBorderColors).forEach((borders) => {
          // Iterate through each individual border color within a side
          borders.forEach((borderColor) => {
            // Assert that the current border color matches the expected error color
            expect
              .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithRed)
              .toBe(Colors.textError);
          });
        });

        // Wait for the error message element associated with the "Name" field to appear
        await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.name)
          .waitFor();

        // Assert that the error message element contains the expected error message text
        await expect
          .soft(
            promptModalDialog.getFieldBottomMessage(promptModalDialog.name),
            ExpectedMessages.promptNameInvalid,
          )
          .toHaveText(ExpectedConstants.nameWithDotErrorMessage);
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
      await errorToastAssertion.assertToastIsVisible();
      await errorToastAssertion.assertToastMessage(
        ExpectedConstants.nameWithDotErrorMessage,
        ExpectedMessages.notAllowedNameErrorShown,
      );
      // Wating for (Closing) the toast to move forward
      await errorToast.waitForState({state: 'hidden'});
    });

    await dialTest.step(
      'Type restricted characters one by one in the Rename prompt dialog',
      async () => {
        for (const char of ExpectedConstants.restrictedNameChars.split('')) {
          await promptModalDialog.setField(promptModalDialog.name, char);
          expect
            .soft(
              await promptModalDialog.getName(),
              ExpectedMessages.charactersAreNotDisplayed,
            )
            .toBe('');
        }
      },
    );

    await dialTest.step(
      'Copy and paste restricted characters to the prompt name and verify the name',
      async () => {
        await dialHomePage.copyToClipboard(nameWithRestrictedChars);
        await promptModalDialog.name.click();
        await dialHomePage.pasteFromClipboard();
        expect
          .soft(
            await promptModalDialog.getName(),
            ExpectedMessages.promptNameValid,
          )
          .toBe(expectedPromptName);
        await promptModalDialog.saveButton.click();
        prompt.name = expectedPromptName;
      },
    );

    await dialTest.step(
      'Verify the prompt is created and no error toast is shown',
      async () => {
        await promptAssertion.assertEntityState(
          {name: expectedPromptName},
          'visible',
        );
        await errorToastAssertion.assertToastIsHidden();
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
          {name: prompt.name},
          'visible',
        );
        await errorToastAssertion.assertToastIsHidden();
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
          {name: prompt.name},
          'visible',
        );
        await errorToastAssertion.assertToastIsHidden();
      },
    );

    await dialTest.step(
      'Update the prompt name to " Prompt 1 " (spaces before, after, and in the middle)',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(promptModalDialog.name, nameWithSpaces);
        await promptModalDialog.saveButton.click();
        prompt.name = expectedNameWithSpaces;
      },
    );

    await dialTest.step(
      'Verify the prompt name is "Prompt 1"',
      async () => {
        await promptAssertion.assertEntityState(
          {name: prompt.name},
          'visible',
        );
        await errorToastAssertion.assertToastIsHidden();
      },
    );
  },
);
