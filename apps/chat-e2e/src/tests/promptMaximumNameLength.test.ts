import dialTest from '@/src/core/dialFixtures';
import {
  CollapsedSections,
  ExpectedConstants,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialTest(
  'Prompt name consists of a maximum of 255 bytes (UTF-8).\n' +
    'Long prompt name is cut in the panel.\n' +
    'Prompt folder name consists of a maximum of 255 bytes (UTF-8)',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    prompts,
    promptDropdownMenu,
    promptModalDialog,
    toastAssertion,
    promptAssertion,
    setTestIds,
    promptBarFolderAssertion,
    promptBar,
    folderPrompts,
    localStorageManager,
    promptPreviewModal,
  }) => {
    setTestIds('EPMRTC-3171', 'EPMRTC-958', 'EPMRTC-3168');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);
    const longName = GeneratorUtil.randomString(300);
    const expectedName = longName.substring(
      0,
      ExpectedConstants.maxEntityNameLength,
    );
    const nameUnder160Symbols =
      'This prompt is renamed to very long-long-long name to see how the system cuts the name';

    await dialTest.step(
      'Create a prompt and enter text longer than 255 bytes (UTF-8)',
      async () => {
        await localStorageManager.setPromptCollapsedSection(
          CollapsedSections.Organization,
          CollapsedSections.SharedWithMe,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await promptBar.createNewEntity();
        await promptModalDialog.setField(promptModalDialog.name, longName);
        await promptModalDialog.setField(
          promptModalDialog.prompt,
          ExpectedConstants.newPromptTitle(1),
        );
      },
    );

    await dialTest.step('Save the prompt', async () => {
      await promptModalDialog.saveButton.click();
      await promptPreviewModal.getCloseButton().click();
    });

    await dialTest.step(
      'Verify the prompt name is cut to 255 bytes (UTF-8) and no error toast is shown',
      async () => {
        await promptAssertion.assertEntityState(
          { name: expectedName },
          'visible',
        );
        await toastAssertion.assertToastIsHidden();
      },
    );

    await dialTest.step('Rename the prompt to a long name', async () => {
      await prompts.openEntityDropdownMenu(expectedName);
      await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
      // Wait for the API request to update the prompt name
      await promptModalDialog.updatePromptDetailsWithButton(
        nameUnder160Symbols,
        prompt.description,
        prompt.content!,
      );
      prompt.name = nameUnder160Symbols;
    });

    await dialTest.step('Check the prompt name in the panel', async () => {
      await promptAssertion.assertElementTextIsTruncated(
        prompts.getEntityNameValue(prompt.name),
      );
      await promptPreviewModal.getCloseButton().click();
    });

    await dialTest.step(
      'Hover over the prompt name and check the name in the panel',
      async () => {
        await prompts.getEntityName(prompt.name).hoverOver();
        await promptAssertion.assertEntityDotsMenuState(
          { name: prompt.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Create two folders: Folder_parent -> Folder_child',
      async () => {
        for (let i = 1; i <= 2; i++) {
          await promptBar.createNewFolder();
          await promptBarFolderAssertion.assertFolderState(
            { name: ExpectedConstants.newPromptFolderWithIndexTitle(i) },
            'visible',
          );
        }

        await promptBar.dragAndDropEntityToFolder(
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(2),
          ),
          folderPrompts.getFolderByName(
            ExpectedConstants.newPromptFolderWithIndexTitle(1),
          ),
        );
      },
    );

    await dialTest.step(
      'Edit both folder names with more than 255 bytes (UTF-8) names',
      async () => {
        // Rename Folder_parent
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newPromptFolderWithIndexTitle(1),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.renameEmptyFolderWithTick(longName);

        // Rename folder_child
        await folderPrompts.openFolderDropdownMenu(
          ExpectedConstants.newPromptFolderWithIndexTitle(2),
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.rename);
        await folderPrompts.renameEmptyFolderWithTick(longName);
      },
    );

    await dialTest.step(
      'Check that the folder names are cut to 255 bytes (UTF-8) and no error message appears',
      async () => {
        // Get the actual folder names
        for (let i = 1; i <= 2; i++) {
          await promptBarFolderAssertion.assertFolderState(
            { name: expectedName, index: i },
            'visible',
          );
        }
        // Assert that no error toast is shown
        await toastAssertion.assertToastIsHidden();
      },
    );
  },
);
