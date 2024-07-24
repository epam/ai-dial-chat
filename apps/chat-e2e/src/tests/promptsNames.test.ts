import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages, MenuOptions } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { expect } from '@playwright/test';
import {Prompt} from "@/chat/types/prompt";

dialTest.only(
  'Error message appears if to add a dot to the end of prompt name',
  async ({
    dialHomePage,
    prompts,
    promptData,
    dataInjector,
    promptDropdownMenu,
    promptModalDialog,
    errorToastAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2991');
    let prompt: Prompt;

    await dialTest.step('Prepare prompt', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
    });

    await dialTest.step(
      'Rename prompt and add a dot at the end of the name',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          `${ExpectedConstants.newPromptTitle(1)}.`,
        );
        // await promptModalDialog.description.click();
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
            ExpectedMessages.fieldIsHighlightedWithRed,
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
    });
  },
);
