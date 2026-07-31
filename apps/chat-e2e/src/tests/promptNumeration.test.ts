import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';

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
    toastAssertion,
    setTestIds,
    localStorageManager,
    promptPreviewModal,
    promptAssertion,
  }) => {
    setTestIds(
      'EPMDIAL-3742',
      'EPMDIAL-3743',
      'EPMDIAL-3744',
      'EPMDIAL-3745',
      'EPMDIAL-3747',
    );
    const promptValue = 'That is just a test prompt';
    const renamedPrompt = 'renamed ';

    await dialTest.step(
      'Create several new prompts and verify their names are incremented',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 1; i <= 3; i++) {
          await promptBar.createNewEntity();
          await promptModalDialog.setField(
            promptModalDialog.prompt,
            promptValue,
          );
          await promptModalDialog.savePrompt({ triggeredHttpMethod: 'POST' });
          await promptPreviewModal.getCloseButton().click();
          await promptAssertion.assertEntityState(
            { name: ExpectedConstants.newPromptTitle(i) },
            'visible',
          );
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
        await promptModalDialog.savePrompt({ triggeredHttpMethod: 'PUT' });
        await promptPreviewModal.getCloseButton().click();
        await promptAssertion.assertEntityState(
          { name: renamedPrompt + 1 },
          'visible',
        );

        await promptBar.createNewEntity();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.savePrompt({ triggeredHttpMethod: 'POST' });
        await promptAssertion.assertEntityState(
          { name: ExpectedConstants.newPromptTitle(4) },
          'visible',
        );
        await promptPreviewModal.getCloseButton().click();

        await prompts.openEntityDropdownMenu(
          ExpectedConstants.newPromptTitle(4),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.setField(
          promptModalDialog.name,
          renamedPrompt + 4,
        );
        await promptModalDialog.savePrompt({ triggeredHttpMethod: 'PUT' });
        await promptPreviewModal.getCloseButton().click();
        await promptAssertion.assertEntityState(
          { name: renamedPrompt + 4 },
          'visible',
        );

        await promptBar.createNewEntity();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.savePrompt({ triggeredHttpMethod: 'POST' });
        await promptPreviewModal.getCloseButton().click();
        await promptAssertion.assertEntityState(
          { name: ExpectedConstants.newPromptTitle(4) },
          'visible',
        );
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

        await promptBar.createNewEntity();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.saveButton.click();
        await promptPreviewModal.getCloseButton().click();
        await promptAssertion.assertEntityState(
          { name: ExpectedConstants.newPromptTitle(5) },
          'visible',
        );
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
        await promptModalDialog.savePrompt({ triggeredHttpMethod: 'PUT' });
        await promptPreviewModal.getCloseButton().click();

        for (let i = 1000; i <= 1001; i++) {
          await promptBar.createNewEntity();
          await promptModalDialog.setField(
            promptModalDialog.prompt,
            promptValue,
          );
          await promptModalDialog.savePrompt({ triggeredHttpMethod: 'POST' });
          await promptPreviewModal.getCloseButton().click();
          await promptAssertion.assertEntityState(
            { name: ExpectedConstants.newPromptTitle(i) },
            'visible',
          );
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
        await toastAssertion.assertToastIsVisible();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.duplicatedPromptNameErrorMessage(
            ExpectedConstants.newPromptTitle(999),
          ),
          ExpectedMessages.notAllowedNameErrorShown,
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
    selectFolderModal,
    selectFolderModalAssertion,
    promptModalDialog,
    folderPrompts,
    toast,
    setTestIds,
    localStorageManager,
    promptPreviewModal,
    confirmationDialog,
    promptAssertion,
    promptBarFolderAssertion,
    toastAssertion,
  }) => {
    setTestIds(
      'EPMDIAL-3746',
      'EPMDIAL-3748',
      'EPMDIAL-3749',
      'EPMDIAL-3750',
      'EPMDIAL-3751',
    );
    let nestedFolders: FolderInterface[];
    let nestedFolderPrompts: Prompt[];
    const duplicatedPromptName = ExpectedConstants.newPromptTitle(1);
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
        await localStorageManager.setShowSideBarPanels();
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
        await promptBar.createNewEntity();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.saveButton.click();
        await promptPreviewModal.getCloseButton().click();

        await promptBar.dragAndDropEntityToFolder(
          prompts.getEntityByName(duplicatedPromptName),
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(1),
          ),
          { isHttpMethodTriggered: true },
        );
        await promptBarFolderAssertion.assertFolderEntityState(
          { name: ExpectedConstants.newPromptFolderWithIndexTitle(1) },
          { name: duplicatedPromptName },
          'visible',
        );

        await promptBar.createNewEntity();
        await promptModalDialog.setField(promptModalDialog.prompt, promptValue);
        await promptModalDialog.saveButton.click();
        await promptPreviewModal.getCloseButton().click();
        await promptAssertion.assertEntityState(
          { name: duplicatedPromptName },
          'visible',
        );
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
        await toastAssertion.assertToastMessage(
          ExpectedConstants.duplicatedPromptNameErrorMessage(
            duplicatedPromptName,
          ),
          ExpectedMessages.notAllowedNameErrorShown,
        );
        await promptModalDialog.getCloseButton().click();
        await confirmationDialog.cancelButton.click();
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'Try to move prompt to folder with already existing name and verify error message is shown',
      async () => {
        await prompts.openEntityDropdownMenu(duplicatedPromptName);
        await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
        await selectFolderModalAssertion.assertElementState(
          selectFolderModal,
          'visible',
        );
        await selectFolderModal.selectFolder(
          ExpectedConstants.newPromptFolderWithIndexTitle(1),
        );
        await selectFolderModal.clickSelectFolderButton();

        // Check for the error message
        await toastAssertion.assertToastMessage(
          ExpectedConstants.duplicatedPromptNameErrorMessage(
            duplicatedPromptName,
          ),
          ExpectedMessages.notAllowedNameErrorShown,
        );
        await selectFolderModal.closeModal.click();

        // Verify the prompt is not moved and stays in Recent
        await promptAssertion.assertEntityState(
          { name: duplicatedPromptName },
          'visible',
        );
        await toast.closeToast();
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
        await toastAssertion.assertToastMessage(
          ExpectedConstants.duplicatedPromptNameErrorMessage(
            duplicatedPromptName,
          ),
          ExpectedMessages.notAllowedNameErrorShown,
        );
        await toast.closeToast();
      },
    );

    await dialTest.step(
      'Try to drag & drop prompt from New folder 1 to Recent and verify error message is shown',
      async () => {
        await promptBar.dragAndDropPromptFromFolder(
          ExpectedConstants.newPromptFolderWithIndexTitle(2),
          duplicatedPromptName,
        );

        // Check for error message
        await toastAssertion.assertToastMessage(
          ExpectedConstants.duplicatedRootPromptNameErrorMessage(
            duplicatedPromptName,
          ),
          ExpectedMessages.notAllowedNameErrorShown,
        );
      },
    );
  },
);
