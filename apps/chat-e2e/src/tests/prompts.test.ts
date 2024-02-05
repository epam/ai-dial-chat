import { Prompt } from '@/chat/types/prompt';
import test, { stateFilePath } from '@/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
} from '@/src/testData';
import { Colors, Cursors } from '@/src/ui/domData';
import { expect } from '@playwright/test';

const newName = 'test prompt';
const newDescr = 'test description';
const newValue = 'what is {{}}';

test.describe('Side bar prompt tests', () => {
  test.use({
    storageState: stateFilePath,
  });
  test('Create new prompt', async ({
    dialHomePage,
    promptBar,
    prompts,
    conversationSettings,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-945');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await conversationSettings.waitForState();
    await promptBar.hoverOverNewEntity();
    const newPromptCursor = await promptBar.getNewEntityCursor();
    expect
      .soft(newPromptCursor[0], ExpectedMessages.newPromptButtonCursorIsPointer)
      .toBe(Cursors.pointer);

    const newPromptColor = await promptBar.getNewEntityBackgroundColor();
    expect
      .soft(newPromptColor, ExpectedMessages.newPromptButtonIsHighlighted)
      .toBe(Colors.backgroundAccentTertiary);

    await promptBar.createNewPrompt();
    expect
      .soft(
        await prompts
          .getPromptByName(ExpectedConstants.newPromptTitle(1))
          .isVisible(),
        ExpectedMessages.newPromptCreated,
      )
      .toBeTruthy();
  });

  test('Prompt menu', async ({
    dialHomePage,
    promptData,
    prompts,
    localStorageManager,
    promptDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-952');
    const prompt = promptData.prepareDefaultPrompt();
    await localStorageManager.setPrompts(prompt);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);

    const menuOptions = await promptDropdownMenu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .toEqual([
        MenuOptions.edit,
        MenuOptions.export,
        MenuOptions.moveTo,
        MenuOptions.share,
        MenuOptions.publish,
        MenuOptions.delete,
      ]);
  });

  test('Edit prompt. Cancel', async ({
    dialHomePage,
    promptData,
    prompts,
    localStorageManager,
    promptDropdownMenu,
    promptModalDialog,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-953');
    const prompt = promptData.prepareDefaultPrompt();
    await localStorageManager.setPrompts(prompt);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
    await promptModalDialog.fillPromptDetails(newName, newDescr, newValue);
    await promptBar.click({ force: true });

    const isPromptModalVisible = await promptModalDialog.isVisible();
    await expect
      .soft(isPromptModalVisible, ExpectedMessages.promptModalClosed)
      .toBeFalsy();

    const isPromptVisible = await prompts
      .getPromptByName(prompt.name)
      .isVisible();
    expect
      .soft(isPromptVisible, ExpectedMessages.promptNotUpdated)
      .toBeTruthy();
  });

  test('Edit prompt. Save', async ({
    dialHomePage,
    promptData,
    prompts,
    localStorageManager,
    promptDropdownMenu,
    promptModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-954');
    const prompt = promptData.prepareDefaultPrompt();
    await localStorageManager.setPrompts(prompt);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
    await promptModalDialog.updatePromptDetails(newName, newDescr, newValue);

    const isPromptModalVisible = await promptModalDialog.isVisible();
    await expect
      .soft(isPromptModalVisible, ExpectedMessages.promptModalClosed)
      .toBeFalsy();

    const isPromptVisible = await prompts.getPromptByName(newName).isVisible();
    expect
      .soft(isPromptVisible, ExpectedMessages.promptNotUpdated)
      .toBeTruthy();

    await prompts.openPromptDropdownMenu(newName);
    await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
    expect
      .soft(
        await promptModalDialog.getName(),
        ExpectedMessages.promptNameUpdated,
      )
      .toBe(newName);
    expect
      .soft(
        await promptModalDialog.getDescription(),
        ExpectedMessages.promptDescriptionUpdated,
      )
      .toBe(newDescr);
    expect
      .soft(
        await promptModalDialog.getPrompt(),
        ExpectedMessages.promptValueUpdated,
      )
      .toBe(newValue);
  });

  test(
    'Edit prompt on Enter.\n' + 'Special characters are allowed in prompt name',
    async ({
      dialHomePage,
      promptData,
      prompts,
      localStorageManager,
      promptDropdownMenu,
      promptModalDialog,
      setTestIds,
    }) => {
      setTestIds('EPMRTC-955', 'EPMRTC-1278');
      const nameWithSpecialSymbols = '!@#$%^&*()_+{}[]:;"\',./<>?/*-+`~';
      const prompt = promptData.prepareDefaultPrompt();
      await localStorageManager.setPrompts(prompt);

      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await prompts.openPromptDropdownMenu(prompt.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
      await promptModalDialog.updatePromptDetailsWithEnter(
        nameWithSpecialSymbols,
        newDescr,
        newValue,
      );

      const isPromptModalVisible = await promptModalDialog.isVisible();
      await expect
        .soft(isPromptModalVisible, ExpectedMessages.promptModalClosed)
        .toBeFalsy();

      const isPromptVisible = await prompts
        .getPromptByName(nameWithSpecialSymbols)
        .isVisible();
      expect
        .soft(isPromptVisible, ExpectedMessages.promptNotUpdated)
        .toBeTruthy();

      await prompts.openPromptDropdownMenu(nameWithSpecialSymbols);
      await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
      expect
        .soft(
          await promptModalDialog.getName(),
          ExpectedMessages.promptNameUpdated,
        )
        .toBe(nameWithSpecialSymbols);
      expect
        .soft(
          await promptModalDialog.getDescription(),
          ExpectedMessages.promptDescriptionUpdated,
        )
        .toBe(newDescr);
      expect
        .soft(
          await promptModalDialog.getPrompt(),
          ExpectedMessages.promptValueUpdated,
        )
        .toBe(newValue);
    },
  );

  test('Delete prompt located in the root', async ({
    dialHomePage,
    promptData,
    prompts,
    localStorageManager,
    promptDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-969');
    const prompt = promptData.prepareDefaultPrompt();
    await localStorageManager.setPrompts(prompt);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await prompts.getPromptInput(prompt.name).clickTickButton();
    expect
      .soft(
        await prompts.getPromptByName(prompt.name).isVisible(),
        ExpectedMessages.promptDeleted,
      )
      .toBeFalsy();
  });

  test('Delete prompt. Cancel', async ({
    dialHomePage,
    promptData,
    prompts,
    localStorageManager,
    promptDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-970');
    const prompt = promptData.prepareDefaultPrompt();
    await localStorageManager.setPrompts(prompt);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await prompts.getPromptInput(prompt.name).clickCancelButton();
    expect
      .soft(
        await prompts.getPromptByName(prompt.name).isVisible(),
        ExpectedMessages.promptNotDeleted,
      )
      .toBeTruthy();
  });

  test('Clear prompts. Cancel', async ({
    dialHomePage,
    conversations,
    conversationData,
    promptData,
    localStorageManager,
    folderConversations,
    folderPrompts,
    promptBar,
    confirmationDialog,
    prompts,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-971');
    const emptyPromptFolder = promptData.prepareFolder();
    promptData.resetData();
    const singlePrompt = promptData.prepareDefaultPrompt();
    promptData.resetData();
    const promptInFolder = promptData.prepareDefaultPromptInFolder();

    const singleConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();

    await localStorageManager.setPrompts(
      singlePrompt,
      promptInFolder.prompts[0],
    );
    await localStorageManager.setConversationHistory(
      singleConversation,
      conversationInFolder.conversations[0],
    );
    await localStorageManager.setFolders(
      emptyPromptFolder,
      promptInFolder.folders,
      conversationInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderPrompts.expandCollapseFolder(promptInFolder.folders.name);
    await folderConversations.expandCollapseFolder(
      conversationInFolder.folders.name,
    );
    await promptBar.deleteAllEntities();
    await confirmationDialog.cancelDialog();

    const isFolderConversationVisible =
      await folderConversations.isFolderEntityVisible(
        conversationInFolder.folders.name,
        conversationInFolder.conversations[0].name,
      );
    expect
      .soft(
        isFolderConversationVisible,
        ExpectedMessages.conversationNotDeleted,
      )
      .toBeTruthy();

    const isSingleConversationVisible = await conversations
      .getConversationByName(singleConversation.name)
      .isVisible();
    expect
      .soft(
        isSingleConversationVisible,
        ExpectedMessages.conversationNotDeleted,
      )
      .toBeTruthy();

    const isPromptFolderVisible = await folderPrompts
      .getFolderByName(emptyPromptFolder.name)
      .isVisible();
    expect
      .soft(isPromptFolderVisible, ExpectedMessages.folderNotDeleted)
      .toBeTruthy();

    const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
      promptInFolder.folders.name,
      promptInFolder.prompts[0].name,
    );
    expect
      .soft(isFolderPromptVisible, ExpectedMessages.promptNotDeleted)
      .toBeTruthy();

    const isSinglePromptVisible = await prompts
      .getPromptByName(singlePrompt.name)
      .isVisible();
    expect
      .soft(isSinglePromptVisible, ExpectedMessages.promptNotDeleted)
      .toBeTruthy();
  });

  test('Clear prompts. Clear', async ({
    dialHomePage,
    conversations,
    conversationData,
    promptData,
    localStorageManager,
    folderConversations,
    folderPrompts,
    promptBar,
    confirmationDialog,
    prompts,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-972');
    let i = 2;
    const emptyPromptFolder = promptData.prepareFolder();
    promptData.resetData();
    const singlePrompt = promptData.prepareDefaultPrompt();
    promptData.resetData();
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    promptData.resetData();
    const nestedFolders = promptData.prepareNestedFolder(3);

    const emptyConversationFolder = conversationData.prepareFolder();
    conversationData.resetData();
    const singleConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await localStorageManager.updatePrompts(
      singlePrompt,
      promptInFolder.prompts[0],
    );
    await localStorageManager.updateConversationHistory(
      singleConversation,
      conversationInFolder.conversations[0],
    );
    await localStorageManager.updateFolders(
      emptyPromptFolder,
      emptyConversationFolder,
      promptInFolder.folders,
      conversationInFolder.folders,
      ...nestedFolders,
    );
    await localStorageManager.updateOpenedFolders(
      promptInFolder.folders,
      conversationInFolder.folders,
      ...nestedFolders,
    );
    await localStorageManager.updateSelectedConversation(singleConversation);

    await dialHomePage.reloadPage();
    await dialHomePage.waitForPageLoaded();
    await conversations
      .getConversationByName(singleConversation.name)
      .waitFor();

    await promptBar.deleteAllEntities();
    await confirmationDialog.confirm();

    while (i > 0) {
      await folderConversations
        .getFolderByName(emptyConversationFolder.name)
        .waitFor();
      await folderConversations
        .getFolderEntity(
          conversationInFolder.folders.name,
          conversationInFolder.conversations[0].name,
        )
        .waitFor();
      await conversations
        .getConversationByName(singleConversation.name)
        .waitFor();

      const isPromptFolderVisible = await folderPrompts
        .getFolderByName(emptyPromptFolder.name)
        .isVisible();
      expect
        .soft(isPromptFolderVisible, ExpectedMessages.folderDeleted)
        .toBeFalsy();

      const isFolderPromptVisible = await folderPrompts.isFolderEntityVisible(
        promptInFolder.folders.name,
        promptInFolder.prompts[0].name,
      );
      expect
        .soft(isFolderPromptVisible, ExpectedMessages.promptDeleted)
        .toBeFalsy();

      const isSinglePromptVisible = await prompts
        .getPromptByName(singlePrompt.name)
        .isVisible();
      expect
        .soft(isSinglePromptVisible, ExpectedMessages.promptDeleted)
        .toBeFalsy();

      for (const nestedFolder of nestedFolders) {
        const isNestedPromptFolderVisible = await folderPrompts
          .getFolderByName(nestedFolder.name)
          .isVisible();
        expect
          .soft(isNestedPromptFolderVisible, ExpectedMessages.folderDeleted)
          .toBeFalsy();
      }

      if (i > 1) {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
      }
      i--;
    }
  });

  test(`[UI] Delete all prompts button doesn't exist if not prompts are created`, async ({
    dialHomePage,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-973');
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });

    const isDeleteAllPromptVisible =
      await promptBar.deleteEntitiesButton.isVisible();
    expect
      .soft(
        isDeleteAllPromptVisible,
        ExpectedMessages.deleteAllPromptsButtonNotVisible,
      )
      .toBeFalsy();
  });

  test('Use simple prompt in system prompt', async ({
    dialHomePage,
    promptData,
    localStorageManager,
    entitySettings,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1010');
    const promptContent = 'prompt content';
    const prompt = promptData.preparePrompt(promptContent);
    await localStorageManager.setPrompts(prompt);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await entitySettings.setSystemPrompt('/');
    await entitySettings.getPromptList().selectPrompt(prompt.name);
    const actualPrompt = await entitySettings.getSystemPrompt();
    expect
      .soft(actualPrompt, ExpectedMessages.systemPromptValid)
      .toBe(prompt.content);
  });

  test('Use prompt with parameters', async ({
    dialHomePage,
    promptData,
    localStorageManager,
    sendMessage,
    variableModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1012');
    const promptDescription = 'Prompt description';
    const aVariable = 'A';
    const promptContent = (variable: string) => `Calculate ${variable} * 100`;
    const prompt = promptData.preparePrompt(
      promptContent(`{{${aVariable}}}`),
      promptDescription,
    );
    await localStorageManager.setPrompts(prompt);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await sendMessage.messageInput.fillInInput('/');
    await sendMessage.getPromptList().selectPrompt(prompt.name);

    const promptName = await variableModalDialog.getName();
    expect.soft(promptName, ExpectedMessages.promptNameValid).toBe(prompt.name);

    const promptDescr = await variableModalDialog.getDescription();
    expect
      .soft(promptDescr, ExpectedMessages.promptDescriptionValid)
      .toBe(prompt.description);

    const promptVariablePlaceholder =
      await variableModalDialog.getVariablePlaceholder(aVariable);
    expect
      .soft(
        promptVariablePlaceholder,
        ExpectedMessages.promptVariablePlaceholderValid,
      )
      .toBe(ExpectedConstants.promptPlaceholder(aVariable));

    const variable = '20';
    await variableModalDialog.setVariable(aVariable, variable);

    const actualMessage = await sendMessage.getMessage();
    expect
      .soft(actualMessage, ExpectedMessages.promptApplied)
      .toBe(promptContent(variable));
  });

  test('Check that all parameters in prompt are required', async ({
    dialHomePage,
    promptData,
    localStorageManager,
    sendMessage,
    variableModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1013');
    const promptContent = (first: string, second: string) =>
      `Calculate ${first} * ${second}`;
    const aVariable = 'A';
    const bVariable = 'B';
    const prompt = promptData.preparePrompt(
      promptContent(`{{${aVariable}}}`, `{{${bVariable}}}`),
    );
    await localStorageManager.setPrompts(prompt);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await sendMessage.messageInput.fillInInput('/');
    await sendMessage.getPromptList().selectPrompt(prompt.name);

    const firstVariableValue = '20';
    const secondVariableValue = '30';
    await dialHomePage.acceptBrowserDialog(
      ExpectedConstants.fillVariablesAlertText,
    );
    await variableModalDialog.submitButton.click();
    await variableModalDialog.setVariable(aVariable, firstVariableValue);
    await variableModalDialog.setVariable(bVariable, secondVariableValue);

    const actualMessage = await sendMessage.getMessage();
    expect
      .soft(actualMessage, ExpectedMessages.promptApplied)
      .toBe(promptContent(firstVariableValue, secondVariableValue));
  });

  test('Search prompt when no folders', async ({
    dialHomePage,
    localStorageManager,
    prompts,
    promptData,
    promptBar,
    promptBarSearch,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1173');
    let firstPrompt: Prompt;
    let secondPrompt: Prompt;
    let thirdPrompt: Prompt;
    let fourthPrompt: Prompt;
    let fifthPrompt: Prompt;
    const promptContent = 'Prompt search test';
    const notMatchingSearchTerm = 'abc';
    const searchTerm = 'test';
    const specialSymbolSearchTerm = '@';

    await test.step('Prepare prompts with different content', async () => {
      firstPrompt = promptData.prepareDefaultPrompt(promptContent);
      promptData.resetData();
      secondPrompt = promptData.preparePrompt('', promptContent);
      promptData.resetData();
      thirdPrompt = promptData.preparePrompt(promptContent);
      promptData.resetData();
      fourthPrompt = promptData.prepareDefaultPrompt();
      promptData.resetData();
      fifthPrompt = promptData.prepareDefaultPrompt(
        'Prompt_!@#$%^&*()+=\':",.<>',
      );

      await localStorageManager.setPrompts(
        firstPrompt,
        secondPrompt,
        thirdPrompt,
        fourthPrompt,
        fifthPrompt,
      );
    });

    await test.step('Type not matching search term and in "Search prompt.." field and verify no results found', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await promptBarSearch.setSearchValue(notMatchingSearchTerm);
      const noResult =
        await promptBar.noResultFoundIcon.getElementInnerContent();
      expect
        .soft(noResult, ExpectedMessages.noResultsFound)
        .toBe(ExpectedConstants.noResults);
    });

    await test.step('Clear search field and verify all prompts displayed', async () => {
      await promptBarSearch.setSearchValue('');
      const resultCount = await prompts.getPromptsCount();
      expect
        .soft(resultCount, ExpectedMessages.searchResultCountIsValid)
        .toBe(5);
    });

    await test.step('Type search term in the field and verify all prompts displayed', async () => {
      for (const term of [searchTerm, searchTerm.toUpperCase()]) {
        await promptBarSearch.setSearchValue(term);
        const resultCount = await prompts.getPromptsCount();
        expect
          .soft(resultCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(3);
      }
    });

    await test.step('Type search term in the field and verify all prompts displayed', async () => {
      await promptBarSearch.setSearchValue(specialSymbolSearchTerm);
      const resultCount = await prompts.getPromptsCount();
      expect
        .soft(resultCount, ExpectedMessages.searchResultCountIsValid)
        .toBe(1);
    });
  });
});
