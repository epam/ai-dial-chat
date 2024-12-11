import { Prompt } from '@/chat/types/prompt';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';

const publicationsToUnpublish: Publication[] = [];

dialAdminTest.only(
  'Publish single prompt: select folder in Organization path\n' +
    'Publish prompt: create folder in Organization path\n' +
    'Publish single prompt: rename folder in Organization',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    prompts,
    promptDropdownMenu,
    publishingRequestModal,
    selectFolderModal,
    adminDialHomePage,
    adminApproveRequiredPromptsAssertion,
    adminApproveRequiredPrompts,
    adminPublishingApprovalModal,
    adminPublishingApprovalModalAssertion,
    setTestIds,
    baseAssertion,
    selectFolders,
    publishedPromptPreviewModal,
    adminPromptToApproveAssertion,
    adminPublishedPromptPreviewModalAssertion,
    promptBarOrganizationFolderAssertion,
    organizationFolderPrompts,
    confirmationDialog,
    folderDropdownMenu,
  }) => {
    dialAdminTest.slow();
    setTestIds('EPMRTC-3305', 'EPMRTC-3595', 'EPMRTC-3313');
    let prompt1: Prompt;
    let prompt2: Prompt;
    const folderName = GeneratorUtil.randomString(10);
    const requestName1 = GeneratorUtil.randomPublicationRequestName();
    const requestName2 = GeneratorUtil.randomPublicationRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialTest.step('Prepare a new prompt', async () => {
      prompt1 = promptData.prepareDefaultPrompt();
      promptData.resetData();
      prompt2 = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt1, prompt2]);
    });

    await dialTest.step('Publish a single prompt', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      // await promptBar.createNewPrompt();
      await prompts.openEntityDropdownMenu(prompt1.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.publish);
      await baseAssertion.assertElementState(publishingRequestModal, 'visible');
    });

    await dialTest.step(
      'Click on "Change path", create folder and rename it under Organization',
      async () => {
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderModal.newFolderButton.click();
        await selectFolders.editFolderNameWithEnter(`${folderName}_rename`);
      },
    );

    await dialTest.step(
      'User hover on folder1 and click on 3 dots, select Rename option, user renames folder',
      async () => {
        await selectFolders.openFolderDropdownMenu(`${folderName}_rename`);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await selectFolders.editFolderNameWithEnter(folderName);
      },
    );

    await dialTest.step(
      'hover 3 dots on folder1_new, create folder2, then delete it',
      async () => {
        await (await selectFolders.getFolderDropdownMenu(folderName)).hover();
        await selectFolderModal.newFolderButton.click();
        await selectFolders.editFolderNameWithEnter(`${folderName} 2`);
        await selectFolders.openFolderDropdownMenu(`${folderName} 2`);
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();
        await selectFolders
          .getFolderByName(`${folderName} 2`)
          .waitFor({ state: 'hidden' });
      },
    );

    await dialTest.step('User selects renamed folder', async () => {
      await selectFolderModal.selectFolder(folderName);
      await selectFolderModal.clickSelectFolderButton({
        triggeredApiHost: API.publicationRulesList,
      });
    });

    await dialTest.step(
      'Set publication request name, check prompt to publish and send request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName1);
        await baseAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          `${PublishPath.Organization}/${folderName}`,
        );
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
        publicationsToUnpublish.push(publishApiModels.response);
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName1 },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          requestName1,
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: requestName1 },
          { name: prompt1.name },
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
          { name: prompt1.name },
          'visible',
        );
        await adminPromptToApproveAssertion.assertEntityColor(
          { name: prompt1.name },
          Colors.textPrimary,
        );
        await adminPromptToApproveAssertion.assertEntityVersion(
          { name: prompt1.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminPromptToApproveAssertion.assertEntityVersionColor(
          { name: prompt1.name },
          Colors.textPrimary,
        );
        //TODO
        // await adminPromptToApproveAssertion.assertTreeEntityIcon(
        //   { name: prompt1.name },
        //   expectedConversationIcon,
        // );
        await adminPromptToApproveAssertion.assertElementState(
          adminPublishingApprovalModal.goToReviewButton,
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementState(
          adminPublishingApprovalModal.approveButton,
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
        await adminPromptToApproveAssertion.assertElementState(
          adminPublishingApprovalModal.rejectButton,
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.rejectButton,
          'enabled',
        );
      },
    );

    await dialAdminTest.step(
      'Click on "Go to a review" button and verify conversation details are displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalTitle(
          prompt1.name,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptName(
          prompt1.name,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptContent(
          prompt1.content!,
        );
        for (const element of [
          publishedPromptPreviewModal.previousButton,
          publishedPromptPreviewModal.nextButton,
          publishedPromptPreviewModal.backToPublicationButton,
          publishedPromptPreviewModal.promptExportButton,
        ]) {
          await baseAssertion.assertElementState(element, 'visible');
        }
        await publishedPromptPreviewModal.backToPublicationButton.click();
        await adminPublishingApprovalModal.approveRequest();
      },
    );

    await dialTest.step(
      'by user1 reload page and check prompt in Organization section inside folder1',
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
          { name: prompt1.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Publish a second prompt to an existing folder',
      async () => {
        await prompts.openEntityDropdownMenu(prompt2.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderModal.selectFolder(folderName);
        await selectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
      },
    );

    await dialTest.step(
      'Set publication request name, check prompt to publish and send request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName2);
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
        publicationsToUnpublish.push(publishApiModels.response);
      },
    );
    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminDialHomePage.reloadPage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName2 },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          requestName2,
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: requestName2 },
          { name: prompt2.name },
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
          { name: prompt2.name },
          'visible',
        );
        await adminPromptToApproveAssertion.assertEntityColor(
          { name: prompt2.name },
          Colors.textPrimary,
        );
        await adminPromptToApproveAssertion.assertEntityVersion(
          { name: prompt2.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminPromptToApproveAssertion.assertEntityVersionColor(
          { name: prompt2.name },
          Colors.textPrimary,
        );
        await adminPromptToApproveAssertion.assertElementState(
          adminPublishingApprovalModal.goToReviewButton,
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementState(
          adminPublishingApprovalModal.approveButton,
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
        await adminPromptToApproveAssertion.assertElementState(
          adminPublishingApprovalModal.rejectButton,
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.rejectButton,
          'enabled',
        );
      },
    );

    await dialAdminTest.step(
      'Click on "Go to a review" button and verify conversation details are displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalTitle(
          prompt2.name,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptName(
          prompt2.name,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptContent(
          prompt2.content!,
        );
        for (const element of [
          publishedPromptPreviewModal.previousButton,
          publishedPromptPreviewModal.nextButton,
          publishedPromptPreviewModal.backToPublicationButton,
          publishedPromptPreviewModal.promptExportButton,
        ]) {
          await baseAssertion.assertElementState(element, 'visible');
        }
        await publishedPromptPreviewModal.backToPublicationButton.click();
        await adminPublishingApprovalModal.approveRequest();
      },
    );
  },
);

dialTest.afterAll(
  async ({ publicationApiHelper, adminPublicationApiHelper }) => {
    for (const publication of publicationsToUnpublish) {
      const unpublishResponse =
        await publicationApiHelper.createUnpublishRequest(publication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);
