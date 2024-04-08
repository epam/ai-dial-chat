import { FolderInterface } from '@/chat/types/folder';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderPrompt,
  MenuOptions,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Create new prompt folder',
  async ({ dialHomePage, promptBar, folderPrompts, setTestIds }) => {
    setTestIds('EPMRTC-944');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await promptBar.createNewFolder();
    expect
      .soft(
        await folderPrompts
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .isVisible(),
        ExpectedMessages.newFolderCreated,
      )
      .toBeTruthy();
  },
);

dialTest(
  'Prompt folder can expand and collapse',
  async ({
    dialHomePage,
    promptData,
    folderPrompts,
    dataInjector,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-946');
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    await dataInjector.createPrompts(
      promptInFolder.prompts,
      promptInFolder.folders,
    );
    const folderName = promptInFolder.folders.name;

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.expandFolder(folderName);
    let isPromptVisible = await folderPrompts.isFolderEntityVisible(
      folderName,
      promptInFolder.prompts[0].name,
    );
    expect.soft(isPromptVisible, ExpectedMessages.folderExpanded).toBeTruthy();

    await folderPrompts.expandCollapseFolder(folderName);
    isPromptVisible = await folderPrompts.isFolderEntityVisible(
      folderName,
      promptInFolder.prompts[0].name,
    );
    expect.soft(isPromptVisible, ExpectedMessages.folderCollapsed).toBeFalsy();
  },
);

dialTest(
  'Search prompt located in folders',
  async ({
    dialHomePage,
    dataInjector,
    promptData,
    folderPrompts,
    promptBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1174');
    let firstFolderPrompt: FolderPrompt;
    let secondFolderPrompts: FolderPrompt;

    const promptContent = 'Prompt search test';
    const searchTerm = 'test';

    await dialTest.step(
      'Prepare prompts in folders with different content',
      async () => {
        firstFolderPrompt =
          promptData.prepareDefaultPromptInFolder(promptContent);
        promptData.resetData();

        secondFolderPrompts = promptData.preparePromptsInFolder(3);
        secondFolderPrompts.prompts[0].description = promptContent;
        secondFolderPrompts.prompts[1].content = promptContent;

        await dataInjector.createPrompts(
          [...firstFolderPrompt.prompts, ...secondFolderPrompts.prompts],
          firstFolderPrompt.folders,
          secondFolderPrompts.folders,
        );
      },
    );

    await dialTest.step(
      'Type search term in the field and verify all prompts displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await promptBarSearch.setSearchValue(searchTerm);
        const firstFolderResultCount =
          await folderPrompts.getFolderEntitiesCount(
            firstFolderPrompt.folders.name,
          );
        const secondFolderResultCount =
          await folderPrompts.getFolderEntitiesCount(
            secondFolderPrompts.folders.name,
          );
        expect
          .soft(
            firstFolderResultCount + secondFolderResultCount,
            ExpectedMessages.searchResultCountIsValid,
          )
          .toBe(isApiStorageType ? 1 : 3);
      },
    );

    await dialTest.step(
      'Clear search field and verify all prompts displayed',
      async () => {
        await promptBarSearch.setSearchValue('');
        await folderPrompts.expandFolder(secondFolderPrompts.folders.name);
        const firstFolderResultCount =
          await folderPrompts.getFolderEntitiesCount(
            secondFolderPrompts.folders.name,
          );
        const secondFolderResultCount =
          await folderPrompts.getFolderEntitiesCount(
            firstFolderPrompt.folders.name,
          );
        expect
          .soft(
            firstFolderResultCount + secondFolderResultCount,
            ExpectedMessages.searchResultCountIsValid,
          )
          .toBe(4);
      },
    );
  },
);
