import { Prompt } from '@/chat/types/prompt';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, MenuOptions } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';

dialTest(
  'Shared icon does not appear in prompt icon if to click on copy icon.\n' +
    'Share form text differs for prompt and folder.\n' +
    'Shared icon does not appear in prompt icon if to close the pop-up on X button.\n' +
    'Shared icon does not appear in prompt icon if to close the pop-up on click out of it.\n' +
    'Shared icon does not appears in prompt icon if to copy using Ctrl+A, Ctrl+C.\n' +
    'Shared icon appears in prompt icon if another user clicks on the link.\n' +
    'Share icon appears in prompt icon only once if to click on copy several times.\n' +
    'Confirmation message if to delete shared prompt',
  async ({
    dialHomePage,
    promptData,
    prompts,
    promptDropdownMenu,
    dataInjector,
    promptBar,
    shareModal,
    additionalUserShareApiHelper,
    confirmationDialogAssertion,
    shareModalAssertion,
    promptAssertion,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-1517',
      'EPMRTC-1817',
      'EPMRTC-1520',
      'EPMRTC-1521',
      'EPMRTC-1518',
      'EPMRTC-3156',
      'EPMRTC-1523',
      'EPMRTC-2812',
    );
    let prompt: Prompt;
    let shareLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare a new prompt', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
    });

    await dialTest.step(
      'Open prompt dropdown menu, choose "Share" option and verify modal window text',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectShareMenuOption();
        await shareModalAssertion.assertMessageContent(
          ExpectedConstants.sharePromptText,
        );
      },
    );

    await dialTest.step(
      'Click on "Cancel" button in modal window and verify no shared icon appears on prompt icon',
      async () => {
        await shareModal.closeButton.click();
        await promptAssertion.assertEntityArrowIconState(
          { name: prompt.name },
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open Share modal again, click outside modal window area and verify no shared icon appears on prompt icon',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectShareMenuOption();
        // eslint-disable-next-line playwright/no-force-option
        await promptBar.draggableArea.click({ force: true });
        await shareModalAssertion.assertModalState('hidden');
        await promptAssertion.assertEntityArrowIconState(
          { name: prompt.name },
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open Share modal again, copy link with keyboard and verify no shared icon appears',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectShareMenuOption();
        await shareModal.shareLinkInput.click();
        await dialHomePage.copyWithKeyboard();
        await shareModal.closeButton.click();
        await promptAssertion.assertEntityArrowIconState(
          { name: prompt.name },
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Open Share modal again, click on "Copy" button in modal window, close it and verify no shared icon appears',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        const shareRequestResponse =
          await promptDropdownMenu.selectShareMenuOption();
        shareLinkResponse = shareRequestResponse!.response;
        await shareModal.copyLinkButton.click();
        await shareModal.closeButton.click();
        await promptAssertion.assertEntityArrowIconState(
          { name: prompt.name },
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Accept invitation link by another user and verify arrow icon appears on conversation icon of the current user',
      async () => {
        await additionalUserShareApiHelper.acceptInvite(shareLinkResponse);
        await dialHomePage.reloadPage();
        await prompts.getEntityArrowIcon(prompt.name).waitFor();
        await promptAssertion.assertEntityArrowIconColor(
          { name: prompt.name },
          Colors.textSecondary,
        );
      },
    );

    await dialTest.step(
      'Open Share modal again, click on "Copy" button in modal window and verify only one purple shared icon is shown on prompt icon',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectShareMenuOption();
        await shareModal.copyLinkButton.click();
        await shareModal.closeButton.click();
        await promptAssertion.assertEntityArrowIconsCount(
          { name: prompt.name },
          1,
        );
      },
    );

    await dialTest.step(
      'Try to delete shared prompt and verify confirmation modal message',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.deleteSharedPromptMessage,
        );
      },
    );
  },
);

dialTest(
  'Shared icon stays in prompt icon if to update description and content of the prompt.\n' +
    'Shared icon removes in prompt icon if to rename prompt.\n' +
    'Shared prompt disappears from Shared with me if the original was renamed',
  async ({
    dialHomePage,
    prompts,
    promptDropdownMenu,
    promptAssertion,
    promptData,
    dataInjector,
    promptModalDialog,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    shareApiAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1524', 'EPMRTC-3157', 'EPMRTC-3180');
    let prompt: Prompt;
    let shareByLinkResponse: ShareByLinkResponseModel;
    const newName = GeneratorUtil.randomString(10);

    await dialTest.step('Prepare prompt and share it with a user', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        prompt,
      ]);
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
    });

    await dialTest.step(
      'Update only prompt description, body and verify arrow icon is still displayed for prompt',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.updatePromptDetailsWithButton(
          prompt.name,
          GeneratorUtil.randomString(10),
          GeneratorUtil.randomString(10),
        );
        await promptAssertion.assertEntityArrowIconState(
          { name: prompt.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Edit prompt name and verify shared icon is displayed on the prompt',
      async () => {
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.edit);
        await promptModalDialog.updatePromptDetailsWithButton(newName);
        await promptAssertion.assertElementState(
          prompts.getEntityByName(newName),
          'visible',
        );
        await promptAssertion.assertEntityArrowIconState(
          { name: newName },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify prompt remained shared with another user',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMePrompts();
        prompt.id = prompt.id.replace(prompt.name, newName);
        await shareApiAssertion.assertSharedWithMeEntityState(
          sharedEntities,
          prompt,
          'visible',
        );
      },
    );
  },
);

dialTest(
  'Shared icon disappears in prompt if the prompt was deleted from "Shared with me" by other',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalSecondUserShareApiHelper,
    promptAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3158');
    let prompt: Prompt;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialTest.step(
      'Prepare prompt and share it with 2 users',
      async () => {
        prompt = promptData.prepareDefaultPrompt();
        await dataInjector.createPrompts([prompt]);
        shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
          prompt,
        ]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
        await additionalSecondUserShareApiHelper.acceptInvite(
          shareByLinkResponse,
        );
      },
    );

    await dialTest.step(
      'Delete prompt from shared for one of the user and verify arrow icon is displayed for main user',
      async () => {
        const sharedEntities =
          await additionalSecondUserShareApiHelper.listSharedWithMePrompts();
        await additionalSecondUserShareApiHelper.deleteSharedWithMeEntities(
          sharedEntities.resources.filter((e) => e.url === prompt.id),
        );

        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await promptAssertion.assertEntityArrowIconState(
          { name: prompt.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Delete prompt from shared for the rest user and verify arrow icon is not displayed for main user',
      async () => {
        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMePrompts();
        await additionalUserShareApiHelper.deleteSharedWithMeEntities(
          sharedEntities.resources.filter((e) => e.url === prompt.id),
        );

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await promptAssertion.assertEntityArrowIconState(
          { name: prompt.name },
          'hidden',
        );
      },
    );
  },
);

dialTest(
  'Shared icon does not appear in prompt if previously shared prompt was deleted and new one with the same name and content create.\n' +
    'Shared prompt disappears from Shared with me if original was deleted',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    itemApiHelper,
    promptAssertion,
    shareApiAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3159', 'EPMRTC-3181');
    let prompt: Prompt;
    let recreatedPrompt: Prompt;

    await dialTest.step('Prepare prompt and share it with user', async () => {
      prompt = promptData.prepareDefaultPrompt();
      recreatedPrompt = JSON.parse(JSON.stringify(prompt));
      await dataInjector.createPrompts([prompt]);

      const shareByLinkResponse =
        await mainUserShareApiHelper.shareEntityByLink([prompt]);
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      const sharedWithMePrompts =
        await additionalUserShareApiHelper.listSharedWithMePrompts();
      await shareApiAssertion.assertSharedWithMeEntityState(
        sharedWithMePrompts,
        prompt,
        'visible',
      );
    });

    await dialTest.step(
      'Delete shared prompt and verify it is not available for user',
      async () => {
        await itemApiHelper.deleteEntity(prompt);
        const sharedWithMePrompts =
          await additionalUserShareApiHelper.listSharedWithMePrompts();
        await shareApiAssertion.assertSharedWithMeEntityState(
          sharedWithMePrompts,
          prompt,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Re-create prompt with the same name and content and verify no arrow icon is displayed for re-created prompt',
      async () => {
        await dataInjector.createPrompts([recreatedPrompt]);
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await promptAssertion.assertEntityState(
          { name: recreatedPrompt.name },
          'visible',
        );
        await promptAssertion.assertEntityArrowIconState(
          { name: recreatedPrompt.name },
          'hidden',
        );
      },
    );
  },
);
