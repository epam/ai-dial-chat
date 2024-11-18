import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import { UploadDownloadData } from '@/src/ui/pages';

dialTest(
  'Export and import prompt inside nested folder',
  async ({
    dialHomePage,
    dataInjector,
    promptBarFolderAssertion,
    folderPrompts,
    promptBar,
    confirmationDialog,
    promptData,
  }) => {
    const levelsCount = 4;
    let nestedFolders: FolderInterface[];
    let nestedPrompts: Prompt[];
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare nested folders with prompts inside',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(levelsCount);
        nestedPrompts =
          promptData.preparePromptsForNestedFolders(nestedFolders);
        await dataInjector.createPrompts(nestedPrompts, ...nestedFolders);
      },
    );

    await dialTest.step(
      'Export all prompts using prompt bar Export button',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await promptBar.createNewFolder();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        exportedData = await dialHomePage.downloadData(() =>
          promptBar.exportButton.click(),
        );
      },
    );

    await dialTest.step(
      'Delete all prompts and folders, re-import again and verify that all entities are displayed',
      async () => {
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await promptBar.deleteEntitiesButton.waitForState({ state: 'hidden' });
        await dialHomePage.importFile(exportedData, () =>
          promptBar.importButton.click(),
        );
        for (let i = 0; i < nestedFolders.length; i++) {
          const nestedFolder = nestedFolders[i];
          await promptBarFolderAssertion.assertFolderState(
            { name: nestedFolder.name },
            'visible',
          );
          await promptBarFolderAssertion.assertFolderEntityState(
            { name: nestedFolder.name },
            { name: nestedPrompts[i].name },
            'visible',
          );
        }
      },
    );
  },
);
