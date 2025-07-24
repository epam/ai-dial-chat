import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { Prompt } from '@epam/ai-dial-shared';

dialAdminTest(
  'Publish single prompt',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    prompts,
    promptDropdownMenu,
    publishingRequestModal,
    publishingRequestModalAssertion,
    selectFolderModal,
    adminDialHomePage,
    adminApproveRequiredPromptsAssertion,
    adminApproveRequiredPrompts,
    adminPublishingApprovalModal,
    adminPublishingApprovalModalAssertion,
    baseAssertion,
    selectFolders,
    adminPublishedPromptPreviewModal,
    adminPromptsToApprove,
    adminPromptToApproveAssertion,
    promptBarOrganizationFolderAssertion,
    organizationFolderPrompts,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    let prompt: Prompt;
    const folderName = GeneratorUtil.randomString(10);
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialTest.step('Prepare a prompt via API', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step('Publish a single prompt', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await prompts.openEntityDropdownMenu(prompt.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.publish);
      await baseAssertion.assertElementState(publishingRequestModal, 'visible');
    });

    await dialTest.step(
      'User clicks on "Change path" and create a new folder',
      async () => {
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderModal.newFolderButton.click();
        await selectFolders.renameEmptyFolderWithEnter(folderName);
        await selectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
      },
    );

    await dialTest.step(
      'Set publication request name and send request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName);
        await publishingRequestModalAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          `${PublishPath.Organization}/${folderName}`,
        );
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify prompt publishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          requestName,
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: prompt.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishToPath,
          `Organization/${folderName}`,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          publishApiModels.response,
        );
        await adminPromptToApproveAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
        await adminPromptToApproveAssertion.assertEntityVersion(
          { name: prompt.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminPromptToApproveAssertion.assertElementState(
          adminPromptsToApprove.promptIcon(prompt.name),
          'visible',
        );
      },
    );

    await dialAdminTest.step('Review the request and approve', async () => {
      await adminPublishingApprovalModal.goToEntityReview({
        isHttpMethodTriggered: false,
      });
      await adminPublishedPromptPreviewModal
        .getPublicationReviewControl()
        .backToPublicationRequestButton.click();
      await adminPublishingApprovalModal.approveRequest();
      await adminApproveRequiredPromptsAssertion.assertFolderState(
        { name: requestName },
        'hidden',
      );
    });

    await dialTest.step(
      'By main user reload the page and check prompt in Organization section inside folder1',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await promptBarOrganizationFolderAssertion.assertFolderState(
          { name: folderName },
          'visible',
        );
        await organizationFolderPrompts.expandFolder(folderName);
        await promptBarOrganizationFolderAssertion.assertFolderEntityState(
          { name: folderName },
          { name: prompt.name },
          'visible',
        );
      },
    );
  },
);
