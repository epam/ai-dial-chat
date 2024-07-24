import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import {Colors} from '@/src/ui/domData';
import {expect} from '@playwright/test';

dialTest.only(
  'Error message appears if to add a dot to the end of prompt name.\n' +
  'Prompt name: allowed special characters',
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
    setTestIds('EPMRTC-2991', 'EPMRTC-1278');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);
    const newNameWithDot = `${ExpectedConstants.newPromptTitle(1)}.`;

    await dialTest.step(
      'Rename any prompt and add a dot at the end of the name',
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
      'Check that Name field is red bordered and error message appears',
      async () => {
        const nameBorderColors = await promptModalDialog.name.getAllBorderColors();
        Object.values(nameBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithRed)
              .toBe(Colors.textError);
          });
        });
        await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.name)
          .waitFor();
        await expect
          .soft(
            promptModalDialog.getFieldBottomMessage(promptModalDialog.name),
            ExpectedMessages.promptNameInvalid,
          )
          .toHaveText(ExpectedConstants.nameWithDotErrorMessage);
      },
    );

    await dialTest.step(
      'Fill in prompt body and click on Save button',
      async () => {
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          ExpectedConstants.newPromptTitle(1),
        );
        await promptModalDialog.saveButton.click();
      },
    );

    await dialTest.step('Check that UI error appears', async () => {
      await errorToastAssertion.assertToastIsVisible();
      await errorToastAssertion.assertToastMessage(
        ExpectedConstants.nameWithDotErrorMessage,
        ExpectedMessages.notAllowedNameErrorShown,
      );
      // Closing the toast to move forward
      await errorToast.closeToast();
    });

    await dialTest.step(
      'Fill in prompt-body and add to the name spec chars',
      async () => {
        await promptModalDialog.setField(
          promptModalDialog.name,
          ExpectedConstants.allowedSpecialSymbolsInName(),
        );
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          ExpectedConstants.newPromptTitle(1),
        );
        await promptModalDialog.saveButton.click();
      },
    );

    await dialTest.step(
      'Verify prompt is created and no error toast is shown',
      async () => {
        await promptAssertion.assertEntityState(
          {name: ExpectedConstants.allowedSpecialSymbolsInName()},
          'visible',
        );
        await errorToastAssertion.assertToastIsHidden();
      },
    );
  },
);
