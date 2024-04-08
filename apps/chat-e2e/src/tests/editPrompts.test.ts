import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, MenuOptions } from '@/src/testData';
import { expect } from '@playwright/test';

const newName = 'test prompt';
const newDescr = 'test description';
const newValue = 'what is {{}}';

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
