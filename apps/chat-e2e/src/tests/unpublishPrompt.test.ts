import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  ExpectedPromptModalConst,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { PublicationReviewControl } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { Prompt, PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Unpublish single prompt.\n' +
    'Author field is not displayed on unpublish request.\n' +
    'Unpublish request name can not be blank.\n' +
    'Unpublish request for prompt which was already unpublished.\n' +
    'Publish: 2 or more unpublish requests, each request have Approve button disabled',
  async (
    {
      dialHomePage,
      promptData,
      itemApiHelper,
      localStorageManager,
      organizationPrompts,
      promptDropdownMenu,
      publishingRequestModal,
      publishingRequestModalAssertion,
      promptToPublishAssertion,
      promptsToPublishTree,
      tooltipAssertion,
      adminApproveRequiredPromptsAssertion,
      adminPublishingApprovalModalAssertion,
      adminPublishingApprovalModal,
      adminApproveRequiredPrompts,
      adminPromptsToApprove,
      adminPromptToApproveAssertion,
      adminPublishedPromptPreviewModal,
      adminPublishedPromptPreviewModalAssertion,
      organizationPromptAssertion,
      adminDialHomePage,
      adminLocalStorageManager,
      setTestIds,
      publicationApiHelper,
      adminPublicationApiHelper,
      publishRequestBuilder,
    },
    testInfo,
  ) => {
    setTestIds(
      'EPMRTC-6118',
      'EPMRTC-5658',
      'EPMRTC-6133',
      'EPMRTC-6127',
      'EPMRTC-3514',
    );
    let prompt: Prompt;
    const firstRequestName = GeneratorUtil.randomUnpublishRequestName();
    const secondRequestName = GeneratorUtil.randomUnpublishRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const username =
      process.env.E2E_USERNAME!.split(',')[testInfo.parallelIndex];
    const author = username.substring(0, username.indexOf('@'));
    const expectedErrorColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textError,
    );
    let publicationReviewControlElement: PublicationReviewControl;

    await dialTest.step('Publish a prompt via API', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await itemApiHelper.createPrompts([prompt]);
      const publishRequest = publishRequestBuilder
        .withName(GeneratorUtil.randomPublicationRequestName())
        .withPromptInFolderResource(prompt, PublishActions.ADD_IF_ABSENT)
        .build();
      const publication =
        await publicationApiHelper.createPublishRequest(publishRequest);
      await adminPublicationApiHelper.approveRequest(publication);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open published prompt dropdown menu, select "Unpublish" option and verify Unpublish modal with valid data is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationPrompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await promptToPublishAssertion.assertElementText(
          publishingRequestModal.unpublishFromLabel,
          ExpectedConstants.unpublishFrom,
        );
        await promptToPublishAssertion.assertElementText(
          publishingRequestModal.unpublishFrom,
          PublishPath.Organization,
        );
        await promptToPublishAssertion.assertElementText(
          publishingRequestModal.allowAccessLabel,
          ExpectedConstants.allowAccessLabel,
        );
        await promptToPublishAssertion.assertElementState(
          publishingRequestModal.availabilityLabel,
          'visible',
        );
        await promptToPublishAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
        await promptToPublishAssertion.assertEntityColor(
          { name: prompt.name },
          expectedErrorColor,
        );
        await promptToPublishAssertion.assertEntityCheckboxState(
          { name: prompt.name },
          CheckboxState.checked,
        );
        await promptToPublishAssertion.assertEntityVersion(
          { name: prompt.name },
          ExpectedConstants.defaultAppVersion,
        );
        await promptToPublishAssertion.assertEntityVersionColor(
          { name: prompt.name },
          expectedErrorColor,
        );
        await promptToPublishAssertion.assertElementState(
          promptsToPublishTree.promptIcon(prompt.name),
          'visible',
        );
        await promptToPublishAssertion.assertElementState(
          publishingRequestModal.author,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Set empty or spaces as a request name and verify "Send request" button is disabled',
      async () => {
        for (const name of ['', ' '.repeat(3)]) {
          await publishingRequestModal.requestName.fillInInput(name);
          await publishingRequestModalAssertion.assertSendRequestButtonIsDisabled();
          await publishingRequestModal.sendRequestButton.hoverOver();
          await tooltipAssertion.assertTooltipContent(
            ExpectedConstants.noPublishNameTooltip,
          );
        }
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestModal.requestName.fillInInput(firstRequestName);
      publishApiModels = await publishingRequestModal.sendPublicationRequest();
      await publishingRequestModalAssertion.assertElementState(
        publishingRequestModal,
        'hidden',
      );
    });

    await dialTest.step(
      'Create one more unpublishing request via API',
      async () => {
        const unpublishRequest = publishRequestBuilder
          .withName(secondRequestName)
          .withPromptInFolderResource(prompt, PublishActions.DELETE)
          .build();
        await publicationApiHelper.createUnpublishRequest(unpublishRequest);
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify prompt unpublishing requests are displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        for (const request of [firstRequestName, secondRequestName]) {
          await adminApproveRequiredPromptsAssertion.assertFolderState(
            { name: request },
            'visible',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Expand the first request folder and verify "Publication approval" modal with valid data is displayed, "Approve selected" btn is disabled',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          firstRequestName,
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: firstRequestName },
          { name: prompt.name },
          'visible',
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityColor(
          { name: firstRequestName },
          { name: prompt.name },
          expectedErrorColor,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishToPath,
          PublishPath.Organization,
        );
        await adminPublishingApprovalModalAssertion.assertRequestCreationDate(
          publishApiModels.response,
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.author,
          author,
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.allowAccessLabel,
          ExpectedConstants.allowAccessLabel,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal.availabilityLabel,
          'visible',
        );
        await adminPromptToApproveAssertion.assertEntityState(
          { name: prompt.name },
          'visible',
        );
        await adminPromptToApproveAssertion.assertEntityColor(
          { name: prompt.name },
          expectedErrorColor,
        );
        await adminPromptToApproveAssertion.assertEntityCheckboxState(
          { name: prompt.name },
          CheckboxState.checked,
        );
        await adminPromptToApproveAssertion.assertEntityVersion(
          { name: prompt.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminPromptToApproveAssertion.assertEntityVersionColor(
          { name: prompt.name },
          expectedErrorColor,
        );
        await adminPromptToApproveAssertion.assertElementState(
          adminPromptsToApprove.promptIcon(prompt.name),
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Expand the second request folder and verify "Approve selected" btn is disabled',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          secondRequestName,
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: secondRequestName },
          { name: prompt.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Select the first request, click on "Go to a review" button and verify prompt details are displayed',
      async () => {
        await adminApproveRequiredPrompts.selectFolder(firstRequestName);
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalTitle(
          ExpectedPromptModalConst.promptViewModalTitle,
        );
        await adminPublishedPromptPreviewModalAssertion.assertElementColor(
          adminPublishedPromptPreviewModal.modalTitle,
          expectedErrorColor,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptName(
          prompt.name,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptContent(
          prompt.content!,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptVersion(
          ExpectedConstants.defaultAppVersion,
        );
        await adminPublishedPromptPreviewModalAssertion.assertElementColor(
          adminPublishedPromptPreviewModal.version,
          expectedErrorColor,
        );
        publicationReviewControlElement =
          adminPublishedPromptPreviewModal.getPublicationReviewControl();
        for (const element of [
          publicationReviewControlElement.previousButton,
          publicationReviewControlElement.nextButton,
          publicationReviewControlElement.backToPublicationRequestButton,
          adminPublishedPromptPreviewModal.promptDuplicateButton,
          adminPublishedPromptPreviewModal.promptExportButton,
          adminPublishedPromptPreviewModal.promptInfoButton,
        ]) {
          await adminPublishedPromptPreviewModalAssertion.assertElementState(
            element,
            'visible',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Click on "Back to publication request" button and verify button name is changed to "Continue review"',
      async () => {
        await publicationReviewControlElement.backToPublicationRequestButton.click();
        await adminPublishingApprovalModalAssertion.assertReviewButtonTitle(
          ExpectedConstants.continueReviewButtonTitle,
        );
      },
    );

    await dialAdminTest.step(
      'Approve the request and verify it disappears from the right side panel',
      async () => {
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: firstRequestName },
          'hidden',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Select the second request and verify error message is displayed instead of "Go to a review" btn',
      async () => {
        await adminApproveRequiredPromptsAssertion.assertFolderEntityColor(
          { name: secondRequestName },
          { name: prompt.name },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textSecondary),
        );
        await adminApproveRequiredPrompts.selectFolder(secondRequestName);
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishName,
          secondRequestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.duplicatedUnpublishingError,
          ExpectedConstants.duplicatedUnpublishingError(prompt.name),
        );
      },
    );

    await dialAdminTest.step(
      'Refresh the page by the main user and verify prompt disappears from "Organization" section',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationPromptAssertion.assertEntityState(
          { name: prompt.name },
          'hidden',
        );
      },
    );
  },
);
