import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  CheckboxState,
  ExpectedConstants,
  FolderPrompt,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

dialAdminTest(
  'Unpublish request for folder with more than one prompt',
  async (
    {
      dialHomePage,
      promptData,
      dataInjector,
      localStorageManager,
      organizationFolderPrompts,
      adminOrganizationPromptAssertion,
      organizationFolderPromptAssertions,
      folderDropdownMenu,
      publishingRequestModal,
      publishingRequestModalAssertion,
      publishingRequestFolderPromptAssertion,
      adminApproveRequiredPromptsAssertion,
      adminPublishingApprovalModalAssertion,
      adminFolderPromptsToApproveAssertion,
      adminPublishingApprovalModal,
      adminApproveRequiredPrompts,
      adminPublishedPromptPreviewModal,
      adminPublishedPromptPreviewModalAssertion,
      adminDialHomePage,
      adminLocalStorageManager,
      setTestIds,
      publicationApiHelper,
      adminPublicationApiHelper,
      publishRequestBuilder,
    },
    testInfo,
  ) => {
    setTestIds('EPMRTC-6122');
    let folderPrompt: FolderPrompt;
    const unpublishRequestName = GeneratorUtil.randomUnpublishRequestName();
    let unpublishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const username =
      process.env.E2E_USERNAME!.split(',')[testInfo.parallelIndex];
    const author = username.substring(0, username.indexOf('@'));
    const expectedErrorColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textError,
    );

    await dialTest.step(
      'Publish a folder with two prompts via API',
      async () => {
        folderPrompt = promptData.preparePromptsInFolder(2);
        await dataInjector.createPrompts(
          folderPrompt.prompts,
          folderPrompt.folders,
        );
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withPromptInFolderResource(
            folderPrompt.prompts[0],
            PublishActions.ADD_IF_ABSENT,
          )
          .withPromptInFolderResource(
            folderPrompt.prompts[1],
            PublishActions.ADD_IF_ABSENT,
          )
          .build();
        const folderPublicationRequest =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(
          folderPublicationRequest,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open published folder dropdown menu, select "Unpublish" option and verify Unpublish modal with valid data is displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderPrompts.openFolderDropdownMenu(
          folderPrompt.folders.name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModalAssertion.assertGeneralInfo({
          unpublishFrom: PublishPath.Organization,
          authorLabel: 'hidden',
        });
        for (const prompt of folderPrompt.prompts) {
          await publishingRequestFolderPromptAssertion.assertFolderEntityToPublish(
            { name: folderPrompt.folders.name },
            { name: prompt.name },
            {
              expectedState: 'visible',
              expectedColor: expectedErrorColor,
              expectedCheckboxState: CheckboxState.checked,
            },
          );
        }
      },
    );

    await dialTest.step('Set a valid request name and submit', async () => {
      await publishingRequestModal.requestName.fillInInput(
        unpublishRequestName,
      );
      unpublishApiModels =
        await publishingRequestModal.sendPublicationRequest();
      await publishingRequestModalAssertion.assertElementState(
        publishingRequestModal,
        'hidden',
      );
    });

    await dialAdminTest.step(
      'Login as admin and verify prompt unpublishing requests are displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: unpublishRequestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand the request folder and verify "Publication approval" modal with valid data is displayed',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          unpublishRequestName,
        );
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: folderPrompt.folders.name },
          'visible',
        );
        await adminApproveRequiredPrompts.expandFolder(
          folderPrompt.folders.name,
        );
        for (const prompt of folderPrompt.prompts) {
          await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
            { name: folderPrompt.folders.name },
            { name: prompt.name },
            'visible',
          );
          await adminApproveRequiredPromptsAssertion.assertFolderEntityColor(
            { name: folderPrompt.folders.name },
            { name: prompt.name },
            expectedErrorColor,
          );
        }
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertGeneralInfo({
          publishTo: PublishPath.Organization,
          requestCreated: unpublishApiModels.response,
          author: author,
        });
        for (const prompt of folderPrompt.prompts) {
          await adminFolderPromptsToApproveAssertion.assertFolderEntityToPublish(
            { name: folderPrompt.folders.name },
            { name: prompt.name },
            {
              expectedState: 'visible',
              expectedColor: expectedErrorColor,
              expectedCheckboxState: CheckboxState.checked,
              expectedVersion: ExpectedConstants.defaultAppVersion,
              expectedVersionColor: expectedErrorColor,
            },
          );
        }
      },
    );

    await dialAdminTest.step(
      'Admin reviews the request and approve',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        const publicationReviewControlElement =
          adminPublishedPromptPreviewModal.getPublicationReviewControl();
        await publicationReviewControlElement.goNext();
        await publicationReviewControlElement.backToPublicationRequestButton.click();
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: unpublishRequestName },
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Refresh the page by the main user and verify the folder disappears from "Organization" section',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderPromptAssertions.assertFolderState(
          { name: folderPrompt.folders.name },
          'hidden',
        );
        for (const prompt of folderPrompt.prompts) {
          await adminOrganizationPromptAssertion.assertEntityState(
            { name: prompt.name },
            'hidden',
          );
        }
      },
    );
  },
);
