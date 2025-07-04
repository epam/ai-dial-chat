import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, FolderPrompt, MenuOptions } from '@/src/testData';
import { BaseElement, PublicationReviewControl } from '@/src/ui/webElements';
import { GeneratorUtil, SortingUtil } from '@/src/utils';

dialAdminTest(
  'Publish folder: folder with 2 prompts',
  async ({
    dialHomePage,
    promptData,
    dataInjector,
    folderPrompts,
    folderDropdownMenu,
    publishingRequestModal,
    publishingRequestFolderPromptAssertion,
    adminDialHomePage,
    adminApproveRequiredPrompts,
    adminPublishingApprovalModal,
    adminApproveRequiredPromptsAssertion,
    adminPublishedPromptPreviewModal,
    adminPublishedPromptPreviewModalAssertion,
    adminPublishingApprovalModalAssertion,
    adminFolderPromptsToApproveAssertion,
    publishingRequestModalAssertion,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    setTestIds('EPMRTC-4582');
    let folderPrompt: FolderPrompt;
    const folderName = GeneratorUtil.randomString(10);
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let orderedPrompts: string[] = [];
    let publicationReviewControls: PublicationReviewControl;
    let backToPublicationRequestButton: BaseElement;
    let nextButton: BaseElement;
    let previousButton: BaseElement;

    await dialTest.step('Prepare 2 prompts inside folder', async () => {
      folderPrompt = promptData.preparePromptsInFolder(2, folderName);
      await dataInjector.createPrompts(
        folderPrompt.prompts,
        folderPrompt.folders,
      );
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Select "Publish" folder dropdown menu option and verify publishing modal is opened, folder with both prompts is displayed at the right side',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderPrompts.openFolderDropdownMenu(folderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        for (const prompt of folderPrompt.prompts)
          await publishingRequestFolderPromptAssertion.assertFolderEntityState(
            { name: folderName },
            { name: prompt.name },
            'visible',
          );
      },
    );

    await dialTest.step(
      'Set publication request name and send request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName);
        await publishingRequestModal.sendPublicationRequest();
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify publishing request is displayed under "Approve required" section',
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
      'Expand request and verify the whole folders hierarchy is displayed under the request',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminApproveRequiredPrompts.expandFolder(folderName);
        for (const prompt of folderPrompt.prompts) {
          await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
            { name: folderName },
            { name: prompt.name },
            'visible',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Verify folder with both prompts is displayed on "Publication approval" modal, "Approve" button is disabled',
      async () => {
        for (const prompt of folderPrompt.prompts) {
          await adminFolderPromptsToApproveAssertion.assertFolderEntityState(
            { name: folderName },
            { name: prompt.name },
            'visible',
          );
        }
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Go to a review" button and verify the first prompt is opened, navigation buttons are available',
      async () => {
        orderedPrompts = SortingUtil.sortStringsArray(
          folderPrompt.prompts.map((p) => p.name),
          (f) => f.toLowerCase(),
          'asc',
        );
        await adminPublishingApprovalModalAssertion.assertReviewButtonTitle(
          ExpectedConstants.goToReviewButtonTitle,
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminApproveRequiredPromptsAssertion.assertFolderEntitySelectedState(
          { name: folderName },
          { name: orderedPrompts[0] },
          true,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        publicationReviewControls =
          adminPublishedPromptPreviewModal.getPublicationReviewControl();
        backToPublicationRequestButton =
          publicationReviewControls.backToPublicationRequestButton;
        nextButton = publicationReviewControls.nextButton;
        previousButton = publicationReviewControls.previousButton;
        await adminPublishedPromptPreviewModalAssertion.assertElementState(
          backToPublicationRequestButton,
          'visible',
        );
        await adminPublishedPromptPreviewModalAssertion.assertElementActionabilityState(
          backToPublicationRequestButton,
          'enabled',
        );
        await adminPublishedPromptPreviewModalAssertion.assertElementActionabilityState(
          nextButton,
          'enabled',
        );
        await adminPublishedPromptPreviewModalAssertion.assertElementActionabilityState(
          previousButton,
          'disabled',
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptName(
          orderedPrompts[0],
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptContent(
          folderPrompt.prompts.find((p) => p.name === orderedPrompts[0])!
            .content!,
        );
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Next" button and verify the second prompt is opened, back button is available',
      async () => {
        await publicationReviewControls.goNext();
        await adminApproveRequiredPromptsAssertion.assertFolderEntitySelectedState(
          { name: folderName },
          { name: orderedPrompts[1] },
          true,
        );
        await adminApproveRequiredPromptsAssertion.assertElementState(
          backToPublicationRequestButton,
          'visible',
        );
        await adminApproveRequiredPromptsAssertion.assertElementActionabilityState(
          nextButton,
          'disabled',
        );
        await adminApproveRequiredPromptsAssertion.assertElementActionabilityState(
          previousButton,
          'enabled',
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptName(
          orderedPrompts[1],
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptContent(
          folderPrompt.prompts.find((p) => p.name === orderedPrompts[1])!
            .content!,
        );
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Back to publication request" button and verify approve request modal is displayed, "Continue review" button is available, "Approve" button is enabled',
      async () => {
        await publicationReviewControls.backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertReviewButtonTitle(
          ExpectedConstants.continueReviewButtonTitle,
        );
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'enabled',
        );
      },
    );
  },
);
