import dialTest from '@/src/core/dialFixtures';
import { FolderPrompt, MenuOptions } from '@/src/testData';

dialTest(
  'Delete folder when there are some prompts inside',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    promptDropdownMenu,
    confirmationDialog,
    promptBarFolderAssertion,
    promptAssertion,
  }) => {
    let promptInFolder: FolderPrompt;

    await dialTest.step('Prepare a folder with prompt', async () => {
      promptInFolder = promptData.prepareDefaultPromptInFolder();
      await dataInjector.createPrompts(
        promptInFolder.prompts,
        promptInFolder.folders,
      );
    });

    await dialTest.step(
      'Select "Delete" for folder dropdown menu, confirm and verify folder with prompt are not displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderPrompts.openFolderDropdownMenu(promptInFolder.folders.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();
        await promptBarFolderAssertion.assertFolderState(
          { name: promptInFolder.folders.name },
          'hidden',
        );
        await promptAssertion.assertEntityState(
          { name: promptInFolder.prompts[0].name },
          'hidden',
        );
      },
    );
  },
);
