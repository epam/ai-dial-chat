import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest.only(
  'Default prompt numeration, renamed and deleted prompts are not counted',
  async ({
    dialHomePage,
    prompts,
    promptBar,
    promptDropdownMenu,
    promptModalDialog,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-1619',
      'EPMRTC-1620',
      'EPMRTC-1566',
      'EPMRTC-2983',
    );
    const promptValue = 'That is just a test prompt';
    const renamedPrompt = 'renamed ';

    await dialTest.step(
      'Create several new prompts and verify their names are incremented',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 1; i <= 3; i++) {
          await promptBar.createNewPrompt();
          await promptModalDialog.setField(
            promptModalDialog.prompt,
            promptValue,
          );
          await promptModalDialog.saveButton.click();
          await expect
            .soft(
              prompts.getPromptByName(ExpectedConstants.newPromptTitle(i)),
              ExpectedMessages.promptIsVisible,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Rename prompts and verify new prompts still use correct numeration',
      async () => {
        await prompts.openPromptDropdownMenu(
          ExpectedConstants.newPromptTitle(1),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          renamedPrompt + 1,
        );
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getPromptByName(renamedPrompt + 1),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

        // Create Prompt 4 (should still be Prompt 4 even though Prompt 1 was renamed)
        await promptBar.createNewPrompt();
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          promptValue,
        );
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getPromptByName(ExpectedConstants.newPromptTitle(4)),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

        // Rename Prompt 4
        await prompts.openPromptDropdownMenu(
          ExpectedConstants.newPromptTitle(4),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          renamedPrompt + 4,
        );
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getPromptByName(renamedPrompt + 4),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

        // Create another Prompt 4 (should reuse the index 4)
        await promptBar.createNewPrompt();
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          promptValue,
        );
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getPromptByName(ExpectedConstants.newPromptTitle(4)),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Delete prompts and verify new prompts still use correct numeration',
      async () => {
        // Delete Prompt 2 and Prompt 3
        for (let i = 2; i <= 3; i++) {
          await prompts.openPromptDropdownMenu(
            ExpectedConstants.newPromptTitle(i),
          );
          await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
          await confirmationDialog.confirm({
            triggeredHttpMethod: 'DELETE',
          });
        }

        // Create Prompt 5 (should be Prompt 5 even though previous prompts were deleted)
        await promptBar.createNewPrompt();
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          promptValue,
        );
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getPromptByName(ExpectedConstants.newPromptTitle(5)),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Verify prompt numeration continues correctly after 999',
      async () => {
        // Rename Prompt 1 to "Prompt 999"
        await prompts.openPromptDropdownMenu(renamedPrompt + 1);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          ExpectedConstants.newPromptTitle(999),
        );
        await promptModalDialog.saveButton.click();

        // Create Prompt 1000 and Prompt 1001
        for (let i = 1000; i <= 1001; i++) {
          await promptBar.createNewPrompt();
          await promptModalDialog.setField(
            promptModalDialog.prompt,
            promptValue,
          );
          await promptModalDialog.saveButton.click();
          await expect
            .soft(
              prompts.getPromptByName(ExpectedConstants.newPromptTitle(i)),
              ExpectedMessages.promptIsVisible,
            )
            .toBeVisible();
        }
      },
    );
  },
);