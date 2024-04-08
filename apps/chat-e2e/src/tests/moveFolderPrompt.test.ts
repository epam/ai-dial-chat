import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { expect } from '@playwright/test';

dialTest(
  'Prompt is moved to folder created from Move to',
  async ({
    dialHomePage,
    prompts,
    promptDropdownMenu,
    promptData,
    dataInjector,
    folderPrompts,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-962');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
    await promptDropdownMenu.selectMenuOption(MenuOptions.newFolder);

    await folderPrompts.expandFolder(ExpectedConstants.newFolderTitle);
    await folderPrompts
      .getFolderEntity(
        ExpectedConstants.newFolderWithIndexTitle(1),
        prompt.name,
      )
      .waitFor();
  },
);

dialTest(
  'Prompt is moved to folder from Move to list',
  async ({
    dialHomePage,
    prompts,
    promptDropdownMenu,
    promptData,
    dataInjector,
    folderPrompts,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-963');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await promptBar.createNewFolder();
    await folderPrompts.expandFolder(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );

    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.moveTo);
    await prompts.selectMoveToMenuOption(
      ExpectedConstants.newFolderWithIndexTitle(1),
    );
    const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
      ExpectedConstants.newFolderWithIndexTitle(1),
      prompt.name,
    );
    expect
      .soft(isFolderPromptVisible, ExpectedMessages.promptMovedToFolder)
      .toBeTruthy();
  },
);
