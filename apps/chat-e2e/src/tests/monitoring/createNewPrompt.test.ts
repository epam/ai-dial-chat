import dialTest from '@/src/core/dialFixtures';

dialTest(
  'Create new prompt',
  async ({ dialHomePage, promptBar, promptModalDialog, promptAssertion }) => {
    const newName = 'test prompt';
    const newDescr = 'test description';
    const newValue = 'what is {{}}';

    await dialTest.step('Click "New prompt" button', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({
        isNewConversationVisible: true,
      });
      await promptBar.createNewPrompt();
    });

    await dialTest.step(
      'Fill in required fields, click Save and verify prompt is created',
      async () => {
        await promptModalDialog.setField(promptModalDialog.name, newName);
        await promptModalDialog.setField(promptModalDialog.prompt, newValue);
        await promptModalDialog.setField(
          promptModalDialog.description,
          newDescr,
        );
        await promptModalDialog.saveButton.click();
        await promptAssertion.assertEntityState({ name: newName }, 'visible');
      },
    );
  },
);
