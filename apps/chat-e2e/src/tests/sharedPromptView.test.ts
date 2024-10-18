import { Prompt } from '@/chat/types/prompt';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedConstants, MenuOptions } from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';

dialSharedWithMeTest(
  'Shared with me. View prompt.\n' +
    'Prompt View form: Export shared prompt.\n' +
    'Prompt View form: Delete shared prompt',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserSharedWithMePrompts,
    additionalShareUserSharedWithMePromptDropdownMenu,
    additionalShareUserConfirmationDialog,
    additionalShareUserPromptPreviewModal,
    additionalUserShareApiHelper,
    additionalShareUserSharedWithMePromptAssertion,
    additionalShareUserSharedPromptPreviewModalAssertion,
    downloadAssertion,
    additionalShareUserConfirmationDialogAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2035', 'EPMRTC-3183', 'EPMRTC-3184');
    let prompt: Prompt;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step('Prepare shared prompt', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        prompt,
      ]);
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
    });

    await dialSharedWithMeTest.step(
      'Select "View" option in dropdown menu for shared prompt',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMePrompts.openEntityDropdownMenu(
          prompt.name,
        );
        await additionalShareUserSharedWithMePromptDropdownMenu.selectMenuOption(
          MenuOptions.view,
          { triggeredHttpMethod: 'GET' },
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Verify prompt preview modal is opened, prompt parameters are valid',
      async () => {
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalState(
          'visible',
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptPreviewModalTitle(
          prompt.name,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptName(
          prompt.name,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptDescription(
          prompt.description,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertSharedPromptContent(
          prompt.content!,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Hover over "Export" button and verify it is highlighted',
      async () => {
        await additionalShareUserPromptPreviewModal.promptExportButton.hoverOver();
        await additionalShareUserSharedPromptPreviewModalAssertion.assertExportButtonColors(
          Colors.controlsBackgroundAccent,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Click on "Export" button and verify prompt is successfully exported',
      async () => {
        const exportedData = await additionalShareUserDialHomePage.downloadData(
          () =>
            additionalShareUserPromptPreviewModal.promptExportButton.click(),
        );
        await downloadAssertion.assertDownloadFileExtension(
          exportedData,
          ExpectedConstants.exportedFileExtension,
        );
        await downloadAssertion.assertJsonFileIsDownloaded(exportedData);
      },
    );

    await dialSharedWithMeTest.step(
      'Hover over "Delete" button and verify it is highlighted',
      async () => {
        await additionalShareUserPromptPreviewModal.promptDeleteButton.hoverOver();
        await additionalShareUserSharedPromptPreviewModalAssertion.assertDeleteButtonColors(
          Colors.controlsBackgroundAccent,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Click on "Delete" button and verify confirmation popup is shown',
      async () => {
        await additionalShareUserPromptPreviewModal.promptDeleteButton.click();
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationDialogTitle(
          ExpectedConstants.deletePromptConfirmationModalTitle,
        );
        await additionalShareUserConfirmationDialogAssertion.assertConfirmationMessage(
          ExpectedConstants.deletePromptConfirmationModalMessage,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Click on "Delete" button and verify prompt is removed from "Share with me" section',
      async () => {
        await additionalShareUserConfirmationDialog.confirm({
          triggeredHttpMethod: 'POST',
        });
        await additionalShareUserSharedWithMePromptAssertion.assertEntityState(
          { name: prompt.name },
          'hidden',
        );
      },
    );
  },
);

dialSharedWithMeTest(
  'Prompt View form: Duplicate shared prompt.\n' +
    'Shared with me. Edit duplicated prompt',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserPrompts,
    additionalShareUserPromptDropdownMenu,
    additionalShareUserPromptPreviewModal,
    additionalShareUserPromptAssertion,
    additionalShareUserPromptModalAssertion,
    additionalShareUserPromptModalDialog,
    apiAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3185', 'EPMRTC-2032');
    let prompt: Prompt;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialSharedWithMeTest.step('Prepare shared prompt', async () => {
      prompt = promptData.preparePrompt(
        GeneratorUtil.randomString(10),
        GeneratorUtil.randomString(10),
      );
      await dataInjector.createPrompts([prompt]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        prompt,
      ]);
    });

    await dialSharedWithMeTest.step(
      'Click on "Duplicate" button on prompt preview modal and verify prompt is duplicated in Recent section',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserPromptPreviewModal.duplicatePrompt();
        await additionalShareUserPromptAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Select "Edit" dropdown menu option for duplicated prompt and verify prompt params are valid',
      async () => {
        await additionalShareUserPrompts.openEntityDropdownMenu(prompt.name);
        await additionalShareUserPromptDropdownMenu.selectMenuOption(
          MenuOptions.edit,
          { triggeredHttpMethod: 'GET' },
        );
        await additionalShareUserPromptModalAssertion.assertPromptName(
          prompt.name,
        );
        await additionalShareUserPromptModalAssertion.assertPromptDescription(
          prompt.description,
        );
        await additionalShareUserPromptModalAssertion.assertPromptContent(
          prompt.content!,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Verify prompt params can be updated',
      async () => {
        const updatedName = GeneratorUtil.randomString(10);
        const updatedDescription = GeneratorUtil.randomString(10);
        const updatedContent = GeneratorUtil.randomString(10);
        const request =
          await additionalShareUserPromptModalDialog.updatePromptDetailsWithButton(
            updatedName,
            updatedDescription,
            updatedContent,
          );
        await additionalShareUserPromptAssertion.assertEntityState(
          { name: updatedName },
          'visible',
        );
        await apiAssertion.assertRequestPromptName(request, updatedName);
        await apiAssertion.assertRequestPromptDescription(
          request,
          updatedDescription,
        );
        await apiAssertion.assertRequestPromptContent(request, updatedContent);
      },
    );
  },
);
