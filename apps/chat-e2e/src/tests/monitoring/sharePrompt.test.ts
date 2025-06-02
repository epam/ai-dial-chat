import { Prompt } from '@/chat/types/prompt';
import { ShareByLinkResponseModel } from '@/chat/types/share';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import { ExpectedConstants, ExpectedPromptModalConst } from '@/src/testData';

dialSharedWithMeTest(
  'Share prompt',
  async ({
    additionalShareUserDialHomePage,
    promptData,
    dataInjector,
    additionalShareUserSharedWithMePromptAssertion,
    additionalShareUserPromptPreviewModalAssertion,
    dialHomePage,
    prompts,
    promptDropdownMenu,
    shareModalAssertion,
    localStorageManager,
  }) => {
    let prompt: Prompt;
    let shareLinkResponse: ShareByLinkResponseModel;

    await dialTest.step('Prepare a new prompt', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open prompt dropdown menu, choose "Share" option and copy link',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
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
        await additionalShareUserDialHomePage.waitForPageLoaded({
          isPromptShared: true,
          skipSidebars: true,
        });
        await additionalShareUserSharedWithMePromptAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );

        await additionalShareUserPromptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await additionalShareUserPromptPreviewModalAssertion.assertPromptPreviewModalTitle(
          ExpectedPromptModalConst.promptViewModalTitle,
        );
        await additionalShareUserPromptPreviewModalAssertion.assertPromptName(
          prompt.name,
        );
        await additionalShareUserPromptPreviewModalAssertion.assertPromptDescription(
          prompt.description,
        );
        await additionalShareUserPromptPreviewModalAssertion.assertPromptContent(
          prompt.content!,
        );
      },
    );
  },
);
