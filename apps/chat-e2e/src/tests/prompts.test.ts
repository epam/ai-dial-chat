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
        MenuOptions.duplicate,
        MenuOptions.export,
        MenuOptions.moveTo,
        MenuOptions.share,
        MenuOptions.publish,
        MenuOptions.delete,
      ]);
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
