import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Delete folder when there are some prompts inside',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    promptDropdownMenu,
    prompts,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-966');
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    await dataInjector.createPrompts(
      promptInFolder.prompts,
      promptInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.openFolderDropdownMenu(promptInFolder.folders.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();
    expect
      .soft(
        await folderPrompts
          .getFolderByName(promptInFolder.folders.name)
          .isVisible(),
        ExpectedMessages.folderDeleted,
      )
      .toBeFalsy();

    const isPromptVisible = await prompts
      .getPromptByName(promptInFolder.prompts[0].name)
      .isVisible();
    expect.soft(isPromptVisible, ExpectedMessages.promptIsVisible).toBeFalsy();
  },
);

dialTest(
  'Delete folder. Cancel.\n' + 'Delete root prompt folder with nested folders',
  async ({
    dialHomePage,
    folderPrompts,
    promptBar,
    promptDropdownMenu,
    confirmationDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-967', 'EPMRTC-1383');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    for (let i = 1; i <= 3; i++) {
      await promptBar.createNewFolder();
    }
    for (let i = 3; i >= 2; i--) {
      await promptBar.dragAndDropEntityToFolder(
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i),
        ),
        folderPrompts.getFolderByName(
          ExpectedConstants.newFolderWithIndexTitle(i - 1),
        ),
      );
    }
    await folderPrompts.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(2),
    );

    await folderPrompts.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    expect
      .soft(
        await confirmationDialog.getConfirmationMessage(),
        ExpectedMessages.confirmationMessageIsValid,
      )
      .toBe(ExpectedConstants.deleteFolderMessage);
    await confirmationDialog.cancelDialog();
    expect
      .soft(
        await folderPrompts
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible(),
        ExpectedMessages.folderNotDeleted,
      )
      .toBeTruthy();

    await folderPrompts.openFolderDropdownMenu(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm();
    for (let i = 1; i <= 3; i++) {
      expect
        .soft(
          await folderPrompts
            .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
            .isVisible(),
          ExpectedMessages.folderDeleted,
        )
        .toBeFalsy();
    }
  },
);

dialTest(
  'Delete prompt in the folder',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    promptDropdownMenu,
    setTestIds,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-968');
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    await dataInjector.createPrompts(
      promptInFolder.prompts,
      promptInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.expandFolder(promptInFolder.folders.name);
    await folderPrompts.openFolderEntityDropdownMenu(
      promptInFolder.folders.name,
      promptInFolder.prompts[0].name,
    );
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    expect
      .soft(
        await folderPrompts
          .getFolderEntity(
            promptInFolder.folders.name,
            promptInFolder.prompts[0].name,
          )
          .isVisible(),
        ExpectedMessages.promptDeleted,
      )
      .toBeFalsy();
  },
);

dialTest(
  'Delete nested prompt folder with prompt',
  async ({
    dialHomePage,
    folderPrompts,
    dataInjector,
    conversationDropdownMenu,
    prompts,
    confirmationDialog,
    promptData,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1384');
    const levelsCount = 3;
    const levelToDelete = 2;
    let nestedFolders: FolderInterface[];
    const nestedPrompts: Prompt[] = [];

    await dialTest.step(
      'Prepare nested folders with prompts inside each one',
      async () => {
        nestedFolders = promptData.prepareNestedFolder(levelsCount);
        for (let i = 0; i <= levelsCount; i++) {
          const nestedPrompt = promptData.prepareDefaultPrompt();
          nestedPrompts.push(nestedPrompt);
          nestedPrompt.folderId = nestedFolders[i].folderId;
          nestedPrompt.id = `${nestedFolders[i].folderId}/${nestedPrompt.id}`;
          promptData.resetData();
        }
        await dataInjector.createPrompts(nestedPrompts, ...nestedFolders);
      },
    );

    await dialTest.step(
      'Delete 2nd level folder and verify all nested content is deleted as well',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderPrompts.expandFolder(nestedFolder.name);
        }
        await folderPrompts.openFolderDropdownMenu(
          nestedFolders[levelToDelete].name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

        for (let i = levelToDelete; i <= levelsCount; i++) {
          expect
            .soft(
              await folderPrompts
                .getFolderByName(nestedFolders[i].name)
                .isVisible(),
              ExpectedMessages.folderDeleted,
            )
            .toBeFalsy();
          expect
            .soft(
              await prompts.getPromptByName(nestedPrompts[i].name).isVisible(),
              ExpectedMessages.promptDeleted,
            )
            .toBeFalsy();
        }

        for (let i = 0; i <= levelsCount - levelToDelete; i++) {
          expect
            .soft(
              await folderPrompts
                .getFolderByName(nestedFolders[i].name)
                .isVisible(),
              ExpectedMessages.folderNotDeleted,
            )
            .toBeTruthy();
          expect
            .soft(
              await folderPrompts
                .getFolderEntity(nestedFolders[i].name, nestedPrompts[i].name)
                .isVisible(),
              ExpectedMessages.promptNotDeleted,
            )
            .toBeTruthy();
        }
      },
    );
  },
);
