import { BackendResourceType } from '@/chat/types/common';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  FolderPrompt,
  MenuOptions,
  PublishPath,
  PublishingExpectedMessages,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { PublicationReviewControl } from '@/src/ui/webElements';
import { DateUtil, GeneratorUtil, SortingUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Publish folder: folder with 2 prompts.\n' +
    `"Author's public name" is displayed on Info pop-up for published prompt ( published folder with prompt).\n` +
    'Unpublish prompt inside folder.\n' +
    'Unpublish all prompts from folder: folder is deleted from Organization',
  async (
    {
      dialHomePage,
      promptData,
      dataInjector,
      folderPrompts,
      folderDropdownMenu,
      promptDropdownMenu,
      publishingRequestModal,
      publishingRequestFolderPromptAssertion,
      organizationFolderPrompts,
      adminDialHomePage,
      promptsToPublishTree,
      adminApproveRequiredPrompts,
      adminPublishingApprovalModal,
      adminApproveRequiredPromptsAssertion,
      adminPublishedPromptPreviewModal,
      adminPublishedPromptPreviewModalAssertion,
      adminPublishingApprovalModalAssertion,
      adminFolderPromptsToApproveAssertion,
      publishingRequestModalAssertion,
      adminOrganizationFolderPrompts,
      adminPromptDropdownMenu,
      adminInformationModalAssertion,
      adminOrganizationFolderPromptAssertions,
      promptToPublishAssertion,
      promptBarOrganizationFolderAssertion,
      setTestIds,
      localStorageManager,
      adminLocalStorageManager,
      publishRequestBuilder,
      publicationApiHelper,
      adminPublicationApiHelper,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-4582', 'EPMRTC-5875', 'EPMRTC-6120', 'EPMRTC-6121');
    let folderPrompt: FolderPrompt;
    const folderName = GeneratorUtil.randomString(10);
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const author = GeneratorUtil.randomString(10);
    const username =
      process.env.E2E_USERNAME!.split(',')[testInfo.parallelIndex];
    const unpublishAuthor = username.substring(0, username.indexOf('@'));
    let orderedPrompts: string[] = [];
    let publicationReviewControls: PublicationReviewControl;
    const expectedErrorColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textError,
    );
    const firstUnpublishRequestName =
      GeneratorUtil.randomUnpublishRequestName();
    let unpublishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };

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
        for (const prompt of folderPrompt.prompts) {
          await publishingRequestFolderPromptAssertion.assertFolderEntityState(
            { name: folderName },
            { name: prompt.name },
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Set publication request name, update Author field and send the request',
      async () => {
        await publishingRequestModal.author.fillInInput(author);
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
          await adminFolderPromptsToApproveAssertion.assertFolderEntityToPublish(
            { name: folderName },
            { name: prompt.name },
            { expectedState: 'visible' },
          );
        }
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          approveButtonState: 'disabled',
        });
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
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonTitle: ExpectedConstants.goToReviewButtonTitle,
        });
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
        await adminPublishedPromptPreviewModalAssertion.assertButtonsState({
          backToPublicationRequestButtonState: 'enabled',
          nextButtonState: 'enabled',
          previousButtonState: 'disabled',
        });
        await adminPublishedPromptPreviewModalAssertion.assertPromptFields({
          name: orderedPrompts[0],
          content: folderPrompt.prompts.find(
            (p) => p.name === orderedPrompts[0],
          )!.content!,
        });
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
        await adminPublishedPromptPreviewModalAssertion.assertButtonsState({
          backToPublicationRequestButtonState: 'enabled',
          nextButtonState: 'disabled',
          previousButtonState: 'enabled',
        });
        await adminPublishedPromptPreviewModalAssertion.assertPromptFields({
          name: orderedPrompts[1],
          content: folderPrompt.prompts.find(
            (p) => p.name === orderedPrompts[1],
          )!.content!,
        });
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
        await adminPublishingApprovalModalAssertion.assertButtonsState({
          reviewButtonTitle: ExpectedConstants.continueReviewButtonTitle,
          approveButtonState: 'enabled',
        });
      },
    );

    await dialAdminTest.step(
      'Admin approves the request and verify folder disappears from "Approve required" section',
      async () => {
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Open published prompt dropdown menu, select "Info" option and verify Author field is valid',
      async () => {
        await adminOrganizationFolderPrompts.expandFolder(folderName);
        await adminOrganizationFolderPrompts.openFolderEntityDropdownMenu(
          folderName,
          folderPrompt.prompts[0].name,
        );
        await adminPromptDropdownMenu.selectMenuOption(MenuOptions.info, {
          triggeredHttpMethod: 'GET',
        });
        await adminInformationModalAssertion.assertFields({
          createdDate: DateUtil.getCurrentLocalDate(),
          author: author,
        });
      },
    );

    await dialTest.step(
      'By main user, select "Unpublish" option from dropdown menu option for published folder prompt and verify unpublishing modal with valid data is opened',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderPrompts.expandFolder(folderName);
        await organizationFolderPrompts.openFolderEntityDropdownMenu(
          folderName,
          folderPrompt.prompts[0].name,
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await promptToPublishAssertion.assertEntityToPublish(
          { name: folderPrompt.prompts[0].name },
          {
            expectedState: 'visible',
            expectedColor: expectedErrorColor,
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: ExpectedConstants.defaultAppVersion,
            expectedVersionColor: expectedErrorColor,
          },
        );
        await promptToPublishAssertion.assertElementState(
          promptsToPublishTree.promptIcon(folderPrompt.prompts[0].name),
          'visible',
        );
      },
    );

    await dialTest.step('Set a request name and submit', async () => {
      await publishingRequestModal.requestName.fillInInput(
        firstUnpublishRequestName,
      );
      unpublishApiModels =
        await publishingRequestModal.sendPublicationRequest();
      await publishingRequestModalAssertion.assertElementState(
        publishingRequestModal,
        'hidden',
      );
    });

    await dialAdminTest.step(
      'As admin verify publishing request is displayed under "Approve required" section',
      async () => {
        await adminDialHomePage.reloadPage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: firstUnpublishRequestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand unpublish request and verify "Publication approval" modal with valid data is displayed',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          firstUnpublishRequestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminApproveRequiredPrompts.expandFolder(folderName);
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: folderName },
          { name: folderPrompt.prompts[0].name },
          'visible',
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityColor(
          { name: folderName },
          { name: folderPrompt.prompts[0].name },
          expectedErrorColor,
        );
        await adminPublishingApprovalModalAssertion.assertGeneralInfo({
          publishTo: PublishPath.Organization,
          requestCreated: unpublishApiModels.response,
          author: unpublishAuthor,
        });
        await adminFolderPromptsToApproveAssertion.assertFolderEntityToPublish(
          { name: folderName },
          { name: folderPrompt.prompts[0].name },
          {
            expectedState: 'visible',
            expectedColor: expectedErrorColor,
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: ExpectedConstants.defaultAppVersion,
            expectedVersionColor: expectedErrorColor,
          },
        );
      },
    );

    await dialAdminTest.step(
      'Approve the request and verify it disappears from the right side panel, prompt is deleted from "Organization" section',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedPromptPreviewModal
          .getPublicationReviewControl()
          .backToPublicationRequestButton.click();
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: folderName },
          'hidden',
        );
        await adminOrganizationFolderPrompts.expandFolder(folderName);
        await adminOrganizationFolderPromptAssertions.assertFolderEntityState(
          { name: folderName },
          { name: folderPrompt.prompts[0].name },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Refresh the page by the main user and verify prompt disappears from published folder in "Organization" section',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderPrompts.expandFolder(folderName);
        await promptBarOrganizationFolderAssertion.assertFolderEntityState(
          { name: folderName },
          { name: folderPrompt.prompts[0].name },
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Unpublish the second folder prompt via API and verify the folder is not listed among published',
      async () => {
        const unpublishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomUnpublishRequestName())
          .withPromptInFolderResource(
            folderPrompt.prompts[1],
            PublishActions.DELETE,
          )
          .build();
        const unpublishRequestModel =
          await publicationApiHelper.createUnpublishRequest(unpublishRequest);
        await adminPublicationApiHelper.approveRequest(unpublishRequestModel);
        const publishedPromptsList =
          await publicationApiHelper.listPublishedResources(
            BackendResourceType.PROMPT,
          );
        const isFolderPromptPublished = !!publishedPromptsList.items?.find(
          (i) => i.url === unpublishRequestModel!.resources![0].targetUrl,
        );
        promptBarOrganizationFolderAssertion.assertBooleanCondition(
          isFolderPromptPublished,
          false,
          PublishingExpectedMessages.folderIsNotPublished,
        );
      },
    );
  },
);
