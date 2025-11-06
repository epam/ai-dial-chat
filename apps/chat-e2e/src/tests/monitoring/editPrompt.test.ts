import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, MenuOptions } from '@/src/testData';

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
    promptModalAssertion,
    promptAssertion,
    promptPreviewModal,
    promptPreviewModalAssertion,
    localStorageManager,
  }) => {
    let prompt: Prompt;

    await dialTest.step('Prepare a prompt with all fields', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
      await localStorageManager.setShowSideBarPanels();
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
        await promptPreviewModalAssertion.assertElementState(
          promptPreviewModal,
          'visible',
        );
        await promptPreviewModalAssertion.assertElementText(
          promptPreviewModal.promptName,
          newName,
          ExpectedMessages.promptNameUpdated,
        );
        await promptPreviewModalAssertion.assertElementText(
          promptPreviewModal.promptDescription,
          newDescr,
          ExpectedMessages.promptDescriptionUpdated,
        );
        await promptPreviewModalAssertion.assertElementText(
          promptPreviewModal.promptContent,
          newValue,
          ExpectedMessages.promptValueUpdated,
        );
        await promptPreviewModal.closeButton.click();
        await promptAssertion.assertEntityState({ name: newName }, 'visible');
      },
    );

    await dialTest.step(
      'Open prompt window and verify changed are applied to the fields',
      async () => {
        await prompts.openEntityDropdownMenu(newName);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalAssertion.assertPromptName(newName);
        await promptModalAssertion.assertPromptDescription(newDescr);
        await promptModalAssertion.assertPromptContent(newValue);
      },
    );
  },
);
