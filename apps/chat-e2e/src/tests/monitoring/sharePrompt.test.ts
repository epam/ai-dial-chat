import { Prompt } from '@/chat/types/prompt';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedConstants } from '@/src/testData';

dialSharedWithMeTest(
  'Share prompt',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    additionalShareUserSharedWithMePromptAssertion,
    additionalShareUserSharedPromptPreviewModalAssertion,
    dialHomePage,
    prompts,
    promptDropdownMenu,
    shareModalAssertion,
  }) => {
    let prompt: Prompt;
    let shareLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare a new prompt', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
    });

    await dialTest.step(
      'Open prompt dropdown menu, choose "Share" option and copy link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded({
          isNewConversationVisible: true,
        });
        await prompts.openEntityDropdownMenu(prompt.name);
        const shareRequestResponse =
          await promptDropdownMenu.selectShareMenuOption();
        shareLinkResponse = shareRequestResponse!.response;
        await shareModalAssertion.assertModalState('visible');
      },
    );

    await dialSharedWithMeTest.step(
      'Open share link by another user and verify prompt stays under expanded "Shared with me" section and prompt details popup is opened',
      async () => {
        await additionalShareUserDialHomePage.navigateToUrl(
          ExpectedConstants.sharedConversationUrl(
            shareLinkResponse.invitationLink,
          ),
        );
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMePromptAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );

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
  },
);
