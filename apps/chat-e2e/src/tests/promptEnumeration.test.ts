import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Default prompt numeration, renamed and deleted prompts are not counted\n' +
    'Numeration Continues after 999\n' +
    'Error message is shown if to rename prompt manually to already existed prompt name when prompts are located in root',
  async ({
    dialHomePage,
    prompts,
    promptBar,
    promptDropdownMenu,
    promptModalDialog,
    confirmationDialog,
    errorToast,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-1619',
      'EPMRTC-1620',
      'EPMRTC-1566',
      'EPMRTC-2983',
      'EPMRTC-2986',
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

        await promptBar.createNewPrompt();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getPromptByName(ExpectedConstants.newPromptTitle(4)),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

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

        await promptBar.createNewPrompt();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
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
        for (let i = 2; i <= 3; i++) {
          await prompts.openPromptDropdownMenu(
            ExpectedConstants.newPromptTitle(i),
          );
          await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
          await confirmationDialog.confirm({
            triggeredHttpMethod: 'DELETE',
          });
        }

        await promptBar.createNewPrompt();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
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
        await prompts.openPromptDropdownMenu(renamedPrompt + 1);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          ExpectedConstants.newPromptTitle(999),
        );
        await promptModalDialog.saveButton.click();

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

    await dialTest.step(
      'Try to rename prompt to already existing name and verify error message is shown',
      async () => {
        await prompts.openPromptDropdownMenu(
          ExpectedConstants.newPromptTitle(1000),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          ExpectedConstants.newPromptTitle(999),
        );
        await promptModalDialog.saveButton.click();

        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        const errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedPromptNameErrorMessage(
              ExpectedConstants.newPromptTitle(999),
            ),
          );
      },
    );
  },
);

dialTest.only(
  'Prompt names can be equal on different levels',
  async ({
    dialHomePage,
    prompts,
    promptBar,
    promptModalDialog,
    folderPrompts,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2984');
    const promptValue = 'That is just a test prompt';
    const duplicatedPromptName = ExpectedConstants.newPromptTitle(1);

    await dialTest.step('Create nested folders structure', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();

      for (let i = 1; i <= 2; i++) {
        await promptBar.createNewFolder();
        await expect
          .soft(
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(i),
            ),
            ExpectedMessages.folderIsVisible,
          )
          .toBeVisible();
      }

      await promptBar.drugAndDropFolderToFolder(
        ExpectedConstants.newPromptFolderWithIndexTitle(1),
        ExpectedConstants.newPromptFolderWithIndexTitle(2),
      );
    });

    await dialTest.step(
      'Create new prompts and move them to corresponding folders',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await promptBar.createNewPrompt();
          await promptModalDialog.setField(
            promptModalDialog.prompt,
            promptValue,
          );
          await promptModalDialog.saveButton.click();

          await promptBar.dragAndDropEntityToFolder(
            prompts.getPromptByName(
              duplicatedPromptName
            ),
            folderPrompts.getFolderByName(
              ExpectedConstants.newPromptFolderWithIndexTitle(i),
            ),
          );

          // await promptBar.drugPromptToFolder(
          //   ExpectedConstants.newPromptFolderWithIndexTitle(i),
          //   duplicatedPromptName,
          // );

          await expect
            .soft(
              folderPrompts.getFolderEntity(
                ExpectedConstants.newPromptFolderWithIndexTitle(i),
                duplicatedPromptName
              ),
              ExpectedMessages.promptIsVisible,
            )
            .toBeVisible();
        }

        await promptBar.createNewPrompt();
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          promptValue,
        );
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getPromptByName(duplicatedPromptName),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
      },
    );
  },
);