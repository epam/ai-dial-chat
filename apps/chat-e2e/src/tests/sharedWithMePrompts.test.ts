import { Prompt } from '@/chat/types/prompt';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedConstants, MenuOptions } from '@/src/testData';
import { Colors } from '@/src/ui/domData';

dialSharedWithMeTest(
  'Shared with me. Share prompt.\n' +
    'Shared with me section is opened automatically if to click on the link.\n' +
    'Shared with me. Shared Prompt with parameters is used in message box.\n' +
    'Delete prompt from shared with me',
  async ({
    additionalShareUserDialHomePage,
    additionalShareUserSendMessage,
    promptData,
    dataInjector,
    mainUserShareApiHelper,
    additionalShareUserSharedWithMePrompts,
    additionalShareUserConfirmationDialog,
    additionalShareUserPromptPreviewModal,
    additionalShareUserVariableModalDialog,
    additionalShareUserSharedWithMePromptAssertion,
    additionalShareUserSharedPromptPreviewModalAssertion,
    additionalShareUserVariableModalAssertion,
    additionalShareUserSendMessageAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1857', 'EPMRTC-2036', 'EPMRTC-1935', 'EPMRTC-3173');
    let prompt: Prompt;
    let shareByLinkResponse: ShareByLinkResponseModel;
    const promptTemplate = (param: string) => `Hi ${param}`;
    const promptParam = 'where';
    const promptParamValue = 'there';
    const promptContent = promptTemplate(
      `{{${promptParam}|${promptParamValue}}}`,
    );
    const promptDescription = 'prompt description';

    await dialSharedWithMeTest.step('Prepare shared prompt link', async () => {
      prompt = promptData.preparePrompt(promptContent, promptDescription);
      await dataInjector.createPrompts([prompt]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        prompt,
      ]);
    });

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify prompt stays under expanded "Shared with me" section and prompt details popup is opened',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareByLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded({
          isPromptShared: true,
        });
        await additionalShareUserSharedWithMePromptAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
        await additionalShareUserSharedWithMePromptAssertion.assertSharedEntityBackgroundColor(
          { name: prompt.name },
          Colors.backgroundAccentTertiaryAlphaDark,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertPromptPreviewModalTitle(
          prompt.name,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertPromptName(
          prompt.name,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertPromptDescription(
          promptDescription,
        );
        await additionalShareUserSharedPromptPreviewModalAssertion.assertPromptContent(
          promptContent,
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Create new conversation, type "/" in the request field, select shared prompt and verify it applied',
      async () => {
        await additionalShareUserPromptPreviewModal.closeButton.click();
        await additionalShareUserSendMessage.messageInput.fillInInput('/');
        await additionalShareUserSendMessage
          .getPromptList()
          .selectPromptWithKeyboard(prompt.name, {
            triggeredHttpMethod: 'GET',
          });

        await additionalShareUserVariableModalAssertion.assertVariableModalState(
          'visible',
        );
        await additionalShareUserVariableModalAssertion.assertPromptVariableLabel(
          promptParam,
        );
        await additionalShareUserVariableModalAssertion.assertPromptVariableValue(
          promptParam,
          promptParamValue,
        );

        await additionalShareUserVariableModalDialog.submitButton.click();
        await additionalShareUserSendMessageAssertion.assertMessageValue(
          promptTemplate(promptParamValue),
        );
      },
    );

    await dialSharedWithMeTest.step(
      'Delete prompt from "Shared with me" section and verify it is not visible any more',
      async () => {
        await additionalShareUserSharedWithMePrompts.openEntityDropdownMenu(
          prompt.name,
        );
        await additionalShareUserSharedWithMePrompts
          .getDropdownMenu()
          .selectMenuOption(MenuOptions.delete);
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

dialTest(
  'Shared prompt disappears from Shared with me if the original was unshared',
  async ({
    dialHomePage,
    prompts,
    promptData,
    promptDropdownMenu,
    confirmationDialog,
    dataInjector,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    shareApiAssertion,
    promptAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3179');
    let prompt: Prompt;
    let shareByLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare prompt and share it with a user', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
      shareByLinkResponse = await mainUserShareApiHelper.shareEntityByLink([
        prompt,
      ]);
      await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
    });

    await dialTest.step(
      'Unshare prompt via dropdown menu and verify it is not shared any more with a user',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await prompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.unshare);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'POST' });
        await promptAssertion.assertEntityArrowIconState(
          { name: prompt.name },
          'hidden',
        );

        const sharedEntities =
          await additionalUserShareApiHelper.listSharedWithMePrompts();
        await shareApiAssertion.assertSharedWithMeEntityState(
          sharedEntities,
          prompt,
          'hidden',
        );
      },
    );
  },
);
