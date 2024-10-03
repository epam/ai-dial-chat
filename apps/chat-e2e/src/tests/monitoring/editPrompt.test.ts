import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, MenuOptions } from '@/src/testData';
import { expect } from '@playwright/test';

const newName = 'test prompt';
const newDescr = 'test description';
const newValue = 'what is {{}}';

dialTest(
  'Edit prompt. Save',
  async ({
    dialHomePage,
    promptData,
    prompts,
    dataInjector,
    promptDropdownMenu,
    promptModalDialog,
    promptAssertion,
  }) => {
    let prompt: Prompt;

    await dialTest.step('Prepare a prompt with all fields', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
    });

    await dialTest.step(
      'Select "Edit" from prompt dropdown menu, update all fields, Save and verify prompt with new name is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.updatePromptDetailsWithButton(
          newName,
          newDescr,
          newValue,
        );
        await promptAssertion.assertEntityState({ name: newName }, 'visible');
      },
    );

    await dialTest.step(
      'Open prompt window and verify changed are applied to the fields',
      async () => {
        await prompts.openEntityDropdownMenu(newName);
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
  },
);
