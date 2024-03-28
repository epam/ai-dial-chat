import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import { isApiStorageType } from '@/src/hooks/global-setup';
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

dialTest(
  'Create new prompt',
  async ({
    dialHomePage,
    promptBar,
    prompts,
    conversationSettings,
    promptModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-945', 'EPMRTC-956', 'EPMRTC-1452');
    await dialTest.step(
      'Hover over "New prompt" button and verify cursor type and color highlight.\n' +
        'Prompt name can not be empty.\n' +
        'Prompt body can not be empty',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await conversationSettings.waitForState();
        await promptBar.hoverOverNewEntity();
        const newPromptCursor = await promptBar.getNewEntityCursor();
        expect
          .soft(
            newPromptCursor[0],
            ExpectedMessages.newPromptButtonCursorIsPointer,
          )
          .toBe(Cursors.pointer);

        const newPromptColor = await promptBar.getNewEntityBackgroundColor();
        expect
          .soft(newPromptColor, ExpectedMessages.newPromptButtonIsHighlighted)
          .toBe(Colors.backgroundAccentTertiary);
      },
    );

    await dialTest.step(
      'Click "New prompt" button and verify Name and Prompt fields have asterisk',
      async () => {
        await promptBar.createNewPrompt();
        expect
          .soft(
            await promptModalDialog.isFieldHasAsterisk(
              ExpectedConstants.promptNameLabel,
            ),
            ExpectedMessages.fieldIsRequired,
          )
          .toBeTruthy();
        expect
          .soft(
            await promptModalDialog.isFieldHasAsterisk(
              ExpectedConstants.promptContentLabel,
            ),
            ExpectedMessages.fieldIsRequired,
          )
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Clear Name field and verify error message is shown, field has red border, Save button is disabled',
      async () => {
        await promptModalDialog.setField(promptModalDialog.name, '');
        await promptModalDialog.description.click();
        const nameBorderColors =
          await promptModalDialog.name.getAllBorderColors();
        Object.values(nameBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithRed)
              .toBe(Colors.textError);
          });
        });

        await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.name)
          .waitFor();
        const nameErrorMessage = await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.name)
          .textContent();
        expect
          .soft(nameErrorMessage, ExpectedMessages.fieldIsHighlightedWithRed)
          .toBe(ExpectedConstants.requiredFieldErrorMessage);

        expect
          .soft(
            await promptModalDialog.saveButton.isElementEnabled(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Set spaces in Name field and verify error message is shown, field has red border, Save button is disabled',
      async () => {
        await promptModalDialog.setField(promptModalDialog.name, '   ');
        await promptModalDialog.description.click();
        const nameBorderColors =
          await promptModalDialog.name.getAllBorderColors();
        Object.values(nameBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithRed)
              .toBe(Colors.textError);
          });
        });

        await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.name)
          .waitFor();
        const nameErrorMessage = await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.name)
          .textContent();
        expect
          .soft(nameErrorMessage, ExpectedMessages.fieldIsHighlightedWithRed)
          .toBe(ExpectedConstants.requiredFieldErrorMessage);

        expect
          .soft(
            await promptModalDialog.getName(),
            ExpectedMessages.promptNameUpdated,
          )
          .toBe('');
        expect
          .soft(
            await promptModalDialog.saveButton.isElementEnabled(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Type value in Name field and verify error message disappears, field has blue border, Save button is enabled',
      async () => {
        await promptModalDialog.setField(promptModalDialog.name, newName);
        const nameBorderColors =
          await promptModalDialog.name.getAllBorderColors();
        Object.values(nameBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithBlue)
              .toBe(Colors.controlsBackgroundAccent);
          });
        });

        await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.name)
          .waitFor({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'Set cursor in prompt field and verify error message is shown, field has red border, Save button is disabled',
      async () => {
        await promptModalDialog.setField(promptModalDialog.prompt, '');
        await promptModalDialog.description.click();
        const promptBorderColors =
          await promptModalDialog.prompt.getAllBorderColors();
        Object.values(promptBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithRed)
              .toBe(Colors.textError);
          });
        });

        await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.prompt)
          .waitFor();
        const nameErrorMessage = await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.prompt)
          .textContent();
        expect
          .soft(nameErrorMessage, ExpectedMessages.fieldIsHighlightedWithRed)
          .toBe(ExpectedConstants.requiredFieldErrorMessage);

        expect
          .soft(
            await promptModalDialog.saveButton.isElementEnabled(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Set spaces in prompt field and verify error message is shown, field has red border, Save button is disabled',
      async () => {
        await promptModalDialog.setField(promptModalDialog.prompt, '   ');
        await promptModalDialog.description.click();
        const promptBorderColors =
          await promptModalDialog.prompt.getAllBorderColors();
        Object.values(promptBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithRed)
              .toBe(Colors.textError);
          });
        });

        await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.prompt)
          .waitFor();
        const nameErrorMessage = await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.prompt)
          .textContent();
        expect
          .soft(nameErrorMessage, ExpectedMessages.fieldIsHighlightedWithRed)
          .toBe(ExpectedConstants.requiredFieldErrorMessage);

        expect
          .soft(
            await promptModalDialog.getPrompt(),
            ExpectedMessages.promptValueUpdated,
          )
          .toBe('');
        expect
          .soft(
            await promptModalDialog.saveButton.isElementEnabled(),
            ExpectedMessages.buttonIsDisabled,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Type value in Prompt field and verify error message disappears, field has blue border, Save button is enabled',
      async () => {
        await promptModalDialog.setField(promptModalDialog.prompt, newValue);
        const promptBorderColors =
          await promptModalDialog.prompt.getAllBorderColors();
        Object.values(promptBorderColors).forEach((borders) => {
          borders.forEach((borderColor) => {
            expect
              .soft(borderColor, ExpectedMessages.fieldIsHighlightedWithBlue)
              .toBe(Colors.controlsBackgroundAccent);
          });
        });

        await promptModalDialog
          .getFieldBottomMessage(promptModalDialog.prompt)
          .waitFor({ state: 'hidden' });

        expect
          .soft(
            await promptModalDialog.saveButton.isElementEnabled(),
            ExpectedMessages.buttonIsEnabled,
          )
          .toBeTruthy();
      },
    );

    await dialTest.step(
      'Set Description field value, click Save and verify prompt is created',
      async () => {
        await promptModalDialog.setField(
          promptModalDialog.description,
          newDescr,
        );
        await promptModalDialog.saveButton.click();
        await prompts.getPromptByName(newName).waitFor();
      },
    );
  },
);

dialTest(
  'Prompt menu',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-952');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

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
  },
);

dialTest(
  'Edit prompt. Cancel',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    promptModalDialog,
    promptBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-953');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

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
  },
);

dialTest(
  'Edit prompt. Save',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    promptModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-954');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
    await promptModalDialog.updatePromptDetailsWithButton(
      newName,
      newDescr,
      newValue,
    );

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
  },
);

dialTest(
  'Edit prompt on Enter.\n' + 'Special characters are allowed in prompt name',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    promptModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-955', 'EPMRTC-1278');
    const nameWithSpecialSymbols = '!@$^()_[]"\'.<>-`~';
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

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

dialTest(
  'Delete prompt located in the root',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    setTestIds,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-969');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
    expect
      .soft(
        await prompts.getPromptByName(prompt.name).isVisible(),
        ExpectedMessages.promptDeleted,
      )
      .toBeFalsy();
  },
);

dialTest(
  'Delete prompt. Cancel',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    setTestIds,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-970');
    const prompt = promptData.prepareDefaultPrompt();
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await prompts.openPromptDropdownMenu(prompt.name);
    await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
    await confirmationDialog.cancelDialog();
    expect
      .soft(
        await prompts.getPromptByName(prompt.name).isVisible(),
        ExpectedMessages.promptNotDeleted,
      )
      .toBeTruthy();
  },
);

dialTest(
  'Clear prompts. Cancel',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    promptData,
    dataInjector,
    folderConversations,
    folderPrompts,
    promptBar,
    confirmationDialog,
    prompts,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-971');
    const singlePrompt = promptData.prepareDefaultPrompt();
    promptData.resetData();
    const promptInFolder = promptData.prepareDefaultPromptInFolder();

    const singleConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();

    await dataInjector.createPrompts(
      [singlePrompt, ...promptInFolder.prompts],
      promptInFolder.folders,
    );
    await dataInjector.createConversations(
      [singleConversation, ...conversationInFolder.conversations],
      conversationInFolder.folders,
    );

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await promptBar.createNewFolder();
    await folderPrompts.expandFolder(promptInFolder.folders.name);
    await folderConversations.expandFolder(conversationInFolder.folders.name);
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
      .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
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
  },
);

dialTest(
  'Clear prompts. Clear',
  async ({
    dialHomePage,
    conversations,
    conversationData,
    promptData,
    dataInjector,
    localStorageManager,
    folderConversations,
    folderPrompts,
    promptBar,
    confirmationDialog,
    prompts,
    chatBar,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-972');
    let i = 2;
    const singlePrompt = promptData.prepareDefaultPrompt();
    promptData.resetData();
    const promptInFolder = promptData.prepareDefaultPromptInFolder();
    promptData.resetData();
    const singleConversation = conversationData.prepareDefaultConversation();
    conversationData.resetData();
    const conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    if (isApiStorageType) {
      await dataInjector.createPrompts([
        singlePrompt,
        ...promptInFolder.prompts,
      ]);
      await dataInjector.createConversations([
        singleConversation,
        ...conversationInFolder.conversations,
      ]);
    } else {
      await dataInjector.updatePrompts(
        [singlePrompt, ...promptInFolder.prompts],
        promptInFolder.folders,
      );
      await dataInjector.updateConversations(
        [singleConversation, ...conversationInFolder.conversations],
        conversationInFolder.folders,
      );
    }
    await localStorageManager.updateSelectedConversation(singleConversation);

    await dialHomePage.reloadPage();
    await dialHomePage.waitForPageLoaded();
    await chatBar.createNewFolder();
    for (let i = 1; i <= 4; i++) {
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
    await folderPrompts.expandFolder(promptInFolder.folders.name);
    await folderConversations.expandFolder(conversationInFolder.folders.name);
    await conversations
      .getConversationByName(singleConversation.name)
      .waitFor();

    await promptBar.deleteAllEntities();
    await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });

    while (i > 0) {
      if (i === 1) {
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .waitFor({ state: 'hidden' });
        await folderConversations.expandFolder(
          conversationInFolder.folders.name,
        );
      } else {
        await folderConversations
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(1))
          .waitFor();
      }
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
        .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(4))
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

      for (let i = 1; i <= 3; i++) {
        const isNestedPromptFolderVisible = await folderPrompts
          .getFolderByName(ExpectedConstants.newFolderWithIndexTitle(i))
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
  },
);

dialTest(
  `[UI] Delete all prompts button doesn't exist if not prompts are created`,
  async ({ dialHomePage, promptBar, setTestIds }) => {
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
  },
);

dialTest(
  'Use prompt with parameters.\n' +
    'Check that equal parameter does not appear several times to be filled in.\n' +
    'Check that parameter after equal parameter is filled in',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    sendMessage,
    variableModalDialog,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1012', 'EPMRTC-2007', 'EPMRTC-2911');
    const promptDescription = 'Prompt description';
    const aVariable = 'A';
    const bVariable = 'B';
    const cVariable = 'C';
    const promptContent = (a: string, b: string, c: string) =>
      `Calculate ${a} + ${b} - ${a} + ${c}`;
    const prompt = promptData.preparePrompt(
      promptContent(`{{${aVariable}}}`, `{{${bVariable}}}`, `{{${cVariable}}}`),
      promptDescription,
    );
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await sendMessage.messageInput.fillInInput('/');
    await sendMessage
      .getPromptList()
      .selectPrompt(prompt.name, { triggeredHttpMethod: 'GET' });

    const promptName = await variableModalDialog.getName();
    expect.soft(promptName, ExpectedMessages.promptNameValid).toBe(prompt.name);

    const promptDescr = await variableModalDialog.getDescription();
    expect
      .soft(promptDescr, ExpectedMessages.promptDescriptionValid)
      .toBe(prompt.description);

    let varValue = 0;
    for (const variable of [aVariable, bVariable, cVariable]) {
      const promptVariablePlaceholder =
        await variableModalDialog.getVariablePlaceholder(variable);
      expect
        .soft(
          promptVariablePlaceholder,
          ExpectedMessages.promptVariablePlaceholderValid,
        )
        .toBe(ExpectedConstants.promptPlaceholder(variable));

      varValue += 10;
      await variableModalDialog.setVariable(variable, varValue.toString());
    }

    const actualMessage = await sendMessage.getMessage();
    expect
      .soft(actualMessage, ExpectedMessages.promptApplied)
      .toBe(promptContent('10', '20', '30'));
  },
);

dialTest(
  'Check that all parameters in prompt are required',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
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
    await dataInjector.createPrompts([prompt]);

    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await sendMessage.messageInput.fillInInput('/');
    await sendMessage
      .getPromptList()
      .selectPrompt(prompt.name, { triggeredHttpMethod: 'GET' });

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
  },
);

dialTest(
  'Search prompt when no folders',
  async ({
    dialHomePage,
    dataInjector,
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

    await dialTest.step('Prepare prompts with different content', async () => {
      firstPrompt = promptData.prepareDefaultPrompt(promptContent);
      promptData.resetData();
      secondPrompt = promptData.preparePrompt('', promptContent);
      promptData.resetData();
      thirdPrompt = promptData.preparePrompt(promptContent);
      promptData.resetData();
      fourthPrompt = promptData.prepareDefaultPrompt();
      promptData.resetData();
      fifthPrompt = promptData.prepareDefaultPrompt(
        'Prompt_!@$^&()_[]"\'.<>-`~',
      );

      await dataInjector.createPrompts([
        firstPrompt,
        secondPrompt,
        thirdPrompt,
        fourthPrompt,
        fifthPrompt,
      ]);
    });

    await dialTest.step(
      'Type not matching search term and in "Search prompt.." field and verify no results found',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await promptBarSearch.setSearchValue(notMatchingSearchTerm);
        const noResult =
          await promptBar.noResultFoundIcon.getElementInnerContent();
        expect
          .soft(noResult, ExpectedMessages.noResultsFound)
          .toBe(ExpectedConstants.noResults);
      },
    );

    await dialTest.step(
      'Clear search field and verify all prompts displayed',
      async () => {
        await promptBarSearch.setSearchValue('');
        const resultCount = await prompts.getPromptsCount();
        expect
          .soft(resultCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(5);
      },
    );

    await dialTest.step(
      'Type search term in the field and verify all prompts displayed',
      async () => {
        for (const term of [searchTerm, searchTerm.toUpperCase()]) {
          await promptBarSearch.setSearchValue(term);
          const resultCount = await prompts.getPromptsCount();
          expect
            .soft(resultCount, ExpectedMessages.searchResultCountIsValid)
            .toBe(isApiStorageType ? 1 : 3);
        }
      },
    );

    await dialTest.step(
      'Type search term in the field and verify all prompts displayed',
      async () => {
        await promptBarSearch.setSearchValue(specialSymbolSearchTerm);
        const resultCount = await prompts.getPromptsCount();
        expect
          .soft(resultCount, ExpectedMessages.searchResultCountIsValid)
          .toBe(1);
      },
    );
  },
);
