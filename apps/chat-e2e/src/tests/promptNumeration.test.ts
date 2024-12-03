import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
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
    let errorMessage;

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
              prompts.getEntityByName(ExpectedConstants.newPromptTitle(i)),
              ExpectedMessages.promptIsVisible,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Rename prompts and verify new prompts still use correct numeration',
      async () => {
        await prompts.openEntityDropdownMenu(
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
            prompts.getEntityByName(renamedPrompt + 1),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

        await promptBar.createNewPrompt();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getEntityByName(ExpectedConstants.newPromptTitle(4)),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

        await prompts.openEntityDropdownMenu(
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
            prompts.getEntityByName(renamedPrompt + 4),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

        await promptBar.createNewPrompt();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getEntityByName(ExpectedConstants.newPromptTitle(4)),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Delete prompts and verify new prompts still use correct numeration',
      async () => {
        for (let i = 2; i <= 3; i++) {
          await prompts.openEntityDropdownMenu(
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
            prompts.getEntityByName(ExpectedConstants.newPromptTitle(5)),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Verify prompt numeration continues correctly after 999',
      async () => {
        await prompts.openEntityDropdownMenu(renamedPrompt + 1);
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
              prompts.getEntityByName(ExpectedConstants.newPromptTitle(i)),
              ExpectedMessages.promptIsVisible,
            )
            .toBeVisible();
        }
      },
    );

    await dialTest.step(
      'Try to rename prompt to already existing name and verify error message is shown',
      async () => {
        await prompts.openEntityDropdownMenu(
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
        errorMessage = await errorToast.getElementContent();
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

dialTest(
  'Prompt names can be equal on different levels\n' +
    'Error message is shown if you try to rename prompt manually to already existed prompt name when prompts are located in the same folder\n' +
    'Error message is shown if you to use "Move to" prompt to folder where the prompt with the same name exists\n' +
    'Error message is shown if you try to drag & drop prompt from the folder to another folder where the prompt with the same name exists\n' +
    'Error message is shown if you try to drag & drop prompt from folder to root where the prompt with the same name exists',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    prompts,
    promptBar,
    promptDropdownMenu,
    promptModalDialog,
    folderPrompts,
    errorToast,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds(
      'EPMRTC-2984',
      'EPMRTC-2987',
      'EPMRTC-2988',
      'EPMRTC-2989',
      'EPMRTC-2990',
    );
    let nestedFolders: FolderInterface[];
    let nestedFolderPrompts: Prompt[];
    const duplicatedPromptName = ExpectedConstants.newPromptTitle(1);
    let errorMessage;
    const promptValue = 'That is just a test prompt';

    await dialTest.step(
      'Create nested folders structure with different prompt names inside',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(2, {
          1: ExpectedConstants.newFolderWithIndexTitle(1),
          2: ExpectedConstants.newFolderWithIndexTitle(2),
        });
        nestedFolderPrompts = promptData.preparePromptsForNestedFolders(
          nestedFolders,
          { 1: ExpectedConstants.newPromptTitle(2), 2: duplicatedPromptName },
        );
        await dataInjector.createPrompts(nestedFolderPrompts, ...nestedFolders);
        await localStorageManager.setPromptCollapsedSection(
          CollapsedSections.Organization,
          CollapsedSections.SharedWithMe,
        );
      },
    );

    await dialTest.step(
      'Verify prompts with equal names can be created in the root folder and Recent section',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await promptBar.createNewPrompt();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.saveButton.click();

        await promptBar.dragAndDropEntityToFolder(
          prompts.getEntityByName(duplicatedPromptName),
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(1),
          ),
        );

        await expect
          .soft(
            folderPrompts.getFolderEntity(
              ExpectedConstants.newPromptFolderWithIndexTitle(1),
              duplicatedPromptName,
            ),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();

        await promptBar.createNewPrompt();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.saveButton.click();
        await expect
          .soft(
            prompts.getEntityByName(duplicatedPromptName),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
      },
    );

    await dialTest.step(
      'Try to rename prompt to already existing name in the same folder and verify error message is shown',
      async () => {
        // Try to rename it
        await folderPrompts.openFolderEntityDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
          ExpectedConstants.newPromptTitle(2),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          duplicatedPromptName,
        );
        await promptModalDialog.saveButton.click();

        // Check for the error message
        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedPromptNameErrorMessage(
              duplicatedPromptName,
            ),
          );
        await promptModalDialog.closeButton.click();
        await errorToast.closeToast();
      },
    );

    await dialTest.step(
      'Try to move prompt to folder with already existing name and verify error message is shown',
      async () => {
        await prompts.openEntityDropdownMenu(duplicatedPromptName);
        await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
        await prompts.selectMoveToMenuOption(
          ExpectedConstants.newPromptFolderWithIndexTitle(1),
          { isHttpMethodTriggered: false },
        );

        // Check for the error message
        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedPromptNameErrorMessage(
              duplicatedPromptName,
            ),
          );

        // Verify the prompt is not moved and stays in Recent
        await expect
          .soft(
            prompts.getEntityByName(duplicatedPromptName),
            ExpectedMessages.promptIsVisible,
          )
          .toBeVisible();
        await errorToast.closeToast();
      },
    );

    await dialTest.step(
      'Try to drag and drop prompt to folder with already existing name and verify error message is shown',
      async () => {
        await promptBar.dragAndDropEntityToFolder(
          folderPrompts.getFolderEntity(
            ExpectedConstants.newPromptFolderWithIndexTitle(1),
            duplicatedPromptName,
            1,
            2,
          ),
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(2),
          ),
          {
            isHttpMethodTriggered: false,
          },
        );

        // Check for error message
        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedPromptNameErrorMessage(
              duplicatedPromptName,
            ),
          );
        await errorToast.closeToast();
      },
    );

    await dialTest.step(
      'Try to drag & drop prompt from New folder 1 to Recent and verify error message is shown',
      async () => {
        await promptBar.dragAndDropPromptFromFolder(
          ExpectedConstants.newPromptFolderWithIndexTitle(2),
          duplicatedPromptName,
          {
            isHttpMethodTriggered: false,
          },
        );

        // Check for error message
        await expect
          .soft(
            errorToast.getElementLocator(),
            ExpectedMessages.errorToastIsShown,
          )
          .toBeVisible();
        errorMessage = await errorToast.getElementContent();
        expect
          .soft(errorMessage, ExpectedMessages.notAllowedNameErrorShown)
          .toBe(
            ExpectedConstants.duplicatedRootPromptNameErrorMessage(
              duplicatedPromptName,
            ),
          );
      },
    );
  },
);
