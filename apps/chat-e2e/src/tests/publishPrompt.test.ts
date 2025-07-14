import { Prompt } from '@/chat/types/prompt';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  ExpectedPromptModalConst,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { ThemeColorAttributes } from '@/src/ui/domData';
import { DateUtil, GeneratorUtil } from '@/src/utils';
import { ThemesUtil } from '@/src/utils/themesUtil';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialAdminTest(
  'Publish single prompt: select folder in Organization path\n' +
    'Publish prompt: create folder in Organization path\n' +
    'Publish single prompt: rename folder in Organization\n' +
    'Publish prompt:add, rename and delete options for new folder in Change path\n' +
    'Publication request name: Spaces at the beginning or end of chat name are removed\n' +
    'Publication request name: spaces in the middle of request name sta.\n' +
    'Author field is editable on publication request.\n' +
    'Publish prompt: context menu options available for prompt inside publish request.\n' +
    'Metadata for prompt inside publication request in Approve required section.\n' +
    'Publish prompt: Author field is displayed on request form for admin.\n' +
    `Link 'Go to a review' change to 'Continue review" when admin started review with "Go to a review" click.\n` +
    'Publish admin: approve prompt',
  async (
    {
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
      adminPromptDropdownMenuAssertion,
      adminApproveRequiredPromptDropdownMenu,
      adminPublishingApprovalModal,
      adminInformationModal,
      adminInformationModalAssertion,
      adminPublishingApprovalModalAssertion,
      setTestIds,
      baseAssertion,
      selectFolders,
      adminPublishedPromptPreviewModal,
      adminPromptsToApprove,
      adminPromptToApproveAssertion,
      adminPublishedPromptPreviewModalAssertion,
      promptBarOrganizationFolderAssertion,
      organizationFolderPrompts,
      confirmationDialog,
      folderDropdownMenu,
      localStorageManager,
      adminLocalStorageManager,
    },
    testInfo,
  ) => {
    dialAdminTest.slow();
    setTestIds(
      'EPMRTC-3305',
      'EPMRTC-3595',
      'EPMRTC-3313',
      'EPMRTC-3596',
      'EPMRTC-3604',
      'EPMRTC-3606',
      'EPMRTC-5657',
      'EPMRTC-3326',
      'EPMRTC-5571',
      'EPMRTC-5634',
      'EPMRTC-3794',
      'EPMRTC-3340',
    );
    let prompt1: Prompt;
    let prompt2: Prompt;
    const folderName = GeneratorUtil.randomString(10);
    const orgFolderName = GeneratorUtil.randomString(10);
    const requestName1WithoutLeadingAndTrailingSpaces = `${GeneratorUtil.randomPublicationRequestName()}    ${GeneratorUtil.randomString(7)}`;
    const requestName1WithSpaces = ` ${requestName1WithoutLeadingAndTrailingSpaces} `;
    const requestName2 = GeneratorUtil.randomPublicationRequestName();
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textPrimary,
    );
    const currentDate = DateUtil.getCurrentLocalDate();
    const username =
      process.env.E2E_USERNAME!.split(',')[testInfo.parallelIndex];
    const author = username.substring(0, username.indexOf('@'));

    await dialTest.step('Prepare 2 prompts', async () => {
      prompt1 = promptData.prepareDefaultPrompt();
      promptData.resetData();
      prompt2 = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt1, prompt2]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step('Publish a single prompt', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await prompts.openEntityDropdownMenu(prompt1.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.publish);
      await baseAssertion.assertElementState(publishingRequestModal, 'visible');
    });

    await dialTest.step(
      'User clicks on "Change path", create a new folder, create a child folder and then delete it',
      async () => {
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderModal.newFolderButton.click();
        await selectFolders.renameEmptyFolderWithEnter(folderName);
        await selectFolders.openFolderDropdownMenu(folderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.addNewFolder);
        await selectFolders.renameEmptyFolderWithEnter(`${folderName} 2`);
        await selectFolders.openFolderDropdownMenu(`${folderName} 2`);
        await folderDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm();
        await selectFolders
          .getFolderByName(`${folderName} 2`)
          .waitFor({ state: 'hidden' });
      },
    );

    await dialTest.step(
      'User renames created folder under Organization',
      async () => {
        await selectFolders.openFolderDropdownMenu(folderName);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await selectFolders.renameEmptyFolderWithEnter(orgFolderName);
      },
    );

    await dialTest.step('User selects renamed folder', async () => {
      await selectFolderModal.selectFolder(orgFolderName);
      await selectFolderModal.clickSelectFolderButton({
        triggeredApiHost: API.publicationRulesList,
      });
    });

    await dialTest.step(
      'Set publication request name, check prompt to publish and send request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(
          requestName1WithSpaces,
        );
        await publishingRequestModalAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          `${PublishPath.Organization}/${orgFolderName}`,
        );
        await publishingRequestModalAssertion.assertInputValue(
          publishingRequestModal.author,
          author,
        );
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
        publicationsToUnpublish.push(publishApiModels.response);
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName1WithoutLeadingAndTrailingSpaces },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          requestName1WithoutLeadingAndTrailingSpaces,
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: requestName1WithoutLeadingAndTrailingSpaces },
          { name: prompt1.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publishToPath,
          `Organization/${orgFolderName}`,
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
          expectedColor,
        );
        await adminPromptToApproveAssertion.assertEntityVersion(
          { name: prompt1.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminPromptToApproveAssertion.assertEntityVersionColor(
          { name: prompt1.name },
          expectedColor,
        );
        await adminPromptToApproveAssertion.assertElementState(
          adminPromptsToApprove.promptIcon(prompt1.name),
          'visible',
        );
        await adminPromptToApproveAssertion.assertElementText(
          adminPublishingApprovalModal.publicAuthor,
          author,
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
      'Open prompt publishing request dropdown menu and verify available options',
      async () => {
        await adminApproveRequiredPrompts.openFolderEntityDropdownMenu(
          requestName1WithoutLeadingAndTrailingSpaces,
          prompt1.name,
        );
        await adminPromptDropdownMenuAssertion.assertMenuOptions([
          MenuOptions.use,
          MenuOptions.view,
          MenuOptions.edit,
          MenuOptions.duplicate,
          MenuOptions.export,
          MenuOptions.info,
        ]);
      },
    );

    await dialAdminTest.step(
      'Select "Info" option from request dropdown menu and verify modal data',
      async () => {
        await adminApproveRequiredPromptDropdownMenu.selectMenuOption(
          MenuOptions.info,
          { triggeredHttpMethod: 'GET' },
        );
        await adminInformationModalAssertion.assertFields({
          createdDate: currentDate,
          lastUpdatedDate: currentDate,
          author: author,
        });
        await adminInformationModal.cancelButton.click();
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
          ExpectedPromptModalConst.promptViewModalTitle,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptName(
          prompt1.name,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptContent(
          prompt1.content!,
        );
        for (const element of [
          adminPublishedPromptPreviewModal.getPublicationReviewControl()
            .previousButton,
          adminPublishedPromptPreviewModal.getPublicationReviewControl()
            .nextButton,
          adminPublishedPromptPreviewModal.getPublicationReviewControl()
            .backToPublicationRequestButton,
          adminPublishedPromptPreviewModal.promptExportButton,
        ]) {
          await baseAssertion.assertElementState(element, 'visible');
        }
      },
    );

    await dialAdminTest.step(
      'Click on "Back to a publication" button and verify button name is changed to "Continue review"',
      async () => {
        await adminPublishedPromptPreviewModal
          .getPublicationReviewControl()
          .backToPublicationRequestButton.click();
        await adminPublishingApprovalModalAssertion.assertReviewButtonTitle(
          ExpectedConstants.continueReviewButtonTitle,
        );
      },
    );

    await dialAdminTest.step(
      'Approve the request and verify it disappears from the side panel',
      async () => {
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestName1WithoutLeadingAndTrailingSpaces },
          'hidden',
        );
      },
    );

    await dialTest.step(
      'by user1 reload page and check prompt in Organization section inside folder1',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await promptBarOrganizationFolderAssertion.assertFolderState(
          { name: orgFolderName },
          'visible',
        );
        await organizationFolderPrompts.expandFolder(orgFolderName);
        await promptBarOrganizationFolderAssertion.assertFolderEntityState(
          { name: orgFolderName },
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
        await selectFolderModal.selectFolder(orgFolderName);
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
          `Organization/${orgFolderName}`,
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
          expectedColor,
        );
        await adminPromptToApproveAssertion.assertEntityVersion(
          { name: prompt2.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminPromptToApproveAssertion.assertEntityVersionColor(
          { name: prompt2.name },
          expectedColor,
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
          ExpectedPromptModalConst.promptViewModalTitle,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptName(
          prompt2.name,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptContent(
          prompt2.content!,
        );
        for (const element of [
          adminPublishedPromptPreviewModal.getPublicationReviewControl()
            .previousButton,
          adminPublishedPromptPreviewModal.getPublicationReviewControl()
            .nextButton,
          adminPublishedPromptPreviewModal.getPublicationReviewControl()
            .backToPublicationRequestButton,
          adminPublishedPromptPreviewModal.promptExportButton,
        ]) {
          await baseAssertion.assertElementState(element, 'visible');
        }
        await adminPublishedPromptPreviewModal
          .getPublicationReviewControl()
          .backToPublicationRequestButton.click();
        await adminPublishingApprovalModal.approveRequest();
      },
    );
  },
);

dialAdminTest(
  'Publish prompt: add new folder inside nested folder structure with depth 4\n' +
    'Publish prompt into nested folder structure inside Organization section\n' +
    'Publish request name: tab is changed to space if to use it in chat name\n' +
    'Publication request name: ASCII control characters %00-%1F are changed to space if to use them in publication request name.\n' +
    'Publication request name should be 2 to 160 characters long\n' +
    'Publication request name can not be blank\n' +
    'Publication request name with hieroglyph, specific letters.\n' +
    `Publish prompt:" Author's public name" is displayed on request form for admin.\n` +
    `Author's public name displayed in metadata for prompt from Organization`,
  async (
    {
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
      adminTooltipAssertion,
      adminPublishingApprovalModalAssertion,
      setTestIds,
      baseAssertion,
      selectFolders,
      informationModal,
      informationModalAssertion,
      adminPublishedPromptPreviewModal,
      adminPromptToApproveAssertion,
      adminPublishedPromptPreviewModalAssertion,
      promptBarOrganizationFolderAssertion,
      organizationFolderPrompts,
      folderDropdownMenu,
      publishingRequestModalAssertion,
      tooltipAssertion,
      localStorageManager,
      adminLocalStorageManager,
    },
    testInfo,
  ) => {
    dialAdminTest.slow();
    setTestIds(
      'EPMRTC-3599',
      'EPMRTC-3600',
      'EPMRTC-3601',
      'EPMRTC-3608',
      'EPMRTC-6079',
      'EPMRTC-3603',
      'EPMRTC-3605',
      'EPMRTC-5660',
      'EPMRTC-5653',
    );
    let prompt1: Prompt;
    const folderNameTemplate = GeneratorUtil.randomString(10);
    let folderName = folderNameTemplate;
    const publicationPath = `${PublishPath.Organization}/${folderNameTemplate} 1/${folderNameTemplate} 2/${folderNameTemplate} 3/${folderNameTemplate} 4`;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const requestNameWithTabs = `${requestName} Name\ttext\t1 한글이라는\n고유한\r문자 시스템을\r사용하는데`;
    const requestNameWithoutTabs = `${requestName} Name text 1 한글이라는 고유한 문자 시스템을 사용하는데`;
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textPrimary,
    );
    const username =
      process.env.E2E_USERNAME!.split(',')[testInfo.parallelIndex];
    const author = username.substring(0, username.indexOf('@'));
    const publicAuthor = GeneratorUtil.randomString(10);
    const currentDate = DateUtil.getCurrentLocalDate();
    const requestNames = [
      `${GeneratorUtil.randomString(50)} ${GeneratorUtil.randomString(50)} ${GeneratorUtil.randomString(61)}`,
      '1',
    ];

    await dialTest.step('Prepare a new prompt', async () => {
      prompt1 = promptData.prepareDefaultPrompt();
      await dataInjector.createPrompts([prompt1]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step('Publish a single prompt', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await prompts.openEntityDropdownMenu(prompt1.name);
      await promptDropdownMenu.selectMenuOption(MenuOptions.publish);
      await baseAssertion.assertElementState(publishingRequestModal, 'visible');
      await publishingRequestModal.requestName.fillInInput('');
    });

    await dialTest.step(
      'User clicks on "Change path, creates new folder structure : Folder1->Folder1.1->Folder1.1.1-Folder1.1.1.1',
      async () => {
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderModal.newFolderButton.click();
        await selectFolders.renameEmptyFolderWithEnter(
          `${folderNameTemplate} 1`,
        );
        for (let i = 1; i < 4; i++) {
          await selectFolders.openFolderDropdownMenu(
            `${folderNameTemplate} ${i}`,
          );
          await folderDropdownMenu.selectMenuOption(MenuOptions.addNewFolder);
          await selectFolders.renameEmptyFolderWithEnter(
            `${folderNameTemplate} ${i + 1}`,
          );
        }
        await selectFolders.openFolderDropdownMenu(`${folderNameTemplate} 4`);
        await folderDropdownMenu.selectMenuOption(MenuOptions.addNewFolder);
        // Assertions
        const error = selectFolderModal.getModalError();
        await baseAssertion.assertElementState(error, 'visible');
        await baseAssertion.assertElementText(
          error.errorMessage,
          ExpectedConstants.tooManyNestedFolders,
          ExpectedMessages.tooManyNestedFolders,
        );
        for (let i = 1; i < 4; i++) {
          await selectFolders
            .getFolderByName(`${folderNameTemplate} ${i}`)
            .waitFor({ state: 'visible' });
        }
        folderName = `${folderNameTemplate} 4`;
      },
    );

    await dialTest.step('User selects nested folder', async () => {
      await selectFolderModal.selectFolder(folderName);
      await selectFolderModal.clickSelectFolderButton({
        triggeredApiHost: API.publicationRulesList,
      });
    });

    for (let i = 0; i < requestNames.length; i++) {
      await dialTest.step(
        `Type ${requestNames[i]} symbols in the request name and verify error hint is displayed under the field`,
        async () => {
          await publishingRequestModal.requestName.fillInInput(requestNames[i]);
          await publishingRequestModalAssertion.assertElementText(
            publishingRequestModal.requestNameErrorMessage,
            i === 0
              ? ExpectedConstants.publishRequestNameMaxLengthErrorMessage
              : ExpectedConstants.publishRequestNameMinLengthErrorMessage,
          );
        },
      );
    }

    await dialTest.step('Check empty publication request name', async () => {
      await publishingRequestModalAssertion.assertSendRequestButtonIsDisabled();
      await publishingRequestModal.sendRequestButton.hoverOver();
      await tooltipAssertion.assertTooltipContent(
        ExpectedConstants.noPublishNameTooltip,
      );
      await publishingRequestModal.requestName.fillInInput('   ');
      await publishingRequestModalAssertion.assertSendRequestButtonIsDisabled();
      await publishingRequestModal.sendRequestButton.hoverOver();
      await tooltipAssertion.assertTooltipContent(
        ExpectedConstants.noPublishNameTooltip,
      );
      await publishingRequestModal.requestName.fillInInput(''); // Clear the input field
    });

    await dialTest.step(
      'Set publication request name, update author, check prompt to publish and send request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(
          requestNameWithTabs,
        );
        await publishingRequestModal.author.fillInInput(publicAuthor);
        await baseAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          publicationPath,
        );
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
        publicationsToUnpublish.push(publishApiModels.response);
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: requestNameWithoutTabs },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed',
      async () => {
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          requestNameWithoutTabs,
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: requestNameWithoutTabs },
          { name: prompt1.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPromptToApproveAssertion.assertEntityState(
          { name: prompt1.name },
          'visible',
        );
        await adminPromptToApproveAssertion.assertEntityColor(
          { name: prompt1.name },
          expectedColor,
        );
        await adminPromptToApproveAssertion.assertEntityVersion(
          { name: prompt1.name },
          ExpectedConstants.defaultAppVersion,
        );
        await adminPromptToApproveAssertion.assertEntityVersionColor(
          { name: prompt1.name },
          expectedColor,
        );
      },
    );

    await dialAdminTest.step(
      'Verify author fields are correct and has a tooltip on hovering "?" sign',
      async () => {
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.author,
          author,
        );
        await adminPublishingApprovalModalAssertion.assertElementText(
          adminPublishingApprovalModal.publicAuthor,
          publicAuthor,
        );
        await adminPublishingApprovalModal.publicAuthorHelpIcon.hoverOver();
        await adminTooltipAssertion.assertTooltipContent(
          ExpectedConstants.publicAuthorTooltip,
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
          ExpectedPromptModalConst.promptViewModalTitle,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptName(
          prompt1.name,
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptContent(
          prompt1.content!,
        );
        await adminPublishedPromptPreviewModal
          .getPublicationReviewControl()
          .backToPublicationRequestButton.click();
        await adminPublishingApprovalModal.approveRequest();
      },
    );

    await dialTest.step(
      'By user1 reload page and check prompt in Organization section inside folder1',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        for (let i = 1; i < 4; i++) {
          await organizationFolderPrompts.expandFolder(
            `${folderNameTemplate} ${i}`,
          );
        }
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

    await dialAdminTest.step(
      'Open conversation dropdown menu, select "Info" option and verify modal data',
      async () => {
        await organizationFolderPrompts.openFolderEntityDropdownMenu(
          folderName,
          prompt1.name,
        );
        await promptDropdownMenu.selectMenuOption(MenuOptions.info, {
          triggeredHttpMethod: 'GET',
        });
        await informationModalAssertion.assertFields({
          createdDate: currentDate,
          author: publicAuthor,
        });
        await informationModal.cancelButton.click();
      },
    );
  },
);

dialAdminTest(
  'Metadata for prompt from Organization section.\n' +
    'Metadata for prompt with several versions from Organization section.\n' +
    `[View prompt] 'View prompt' opened for 'Published' prompt.\n` +
    '[View prompt] Unpublish.\n' +
    'Metadata for prompt duplicated from chat from Organization',
  async ({
    promptData,
    adminUserItemApiHelper,
    localStorageManager,
    dialHomePage,
    organizationPrompts,
    promptPreviewModalAssertion,
    promptToPublishAssertion,
    promptPreviewModal,
    publishingRequestModal,
    publishingRequestModalAssertion,
    tooltipAssertion,
    promptPreviewVersionDropdownMenu,
    adminDialHomePage,
    adminLocalStorageManager,
    adminPrompts,
    adminPromptDropdownMenu,
    promptDropdownMenu,
    informationModal,
    informationModalAssertion,
    adminInformationModalAssertion,
    setTestIds,
    adminPublicationApiHelper,
    publishRequestBuilder,
  }) => {
    setTestIds(
      'EPMRTC-5569',
      'EPMRTC-5570',
      'EPMRTC-6156',
      'EPMRTC-6178',
      'EPMRTC-6104',
    );
    let prompt: Prompt;
    const firstVersion = ExpectedConstants.defaultAppVersion;
    const secondVersion = '0.0.2';
    const currentDate = DateUtil.getCurrentLocalDate();
    const author = GeneratorUtil.randomString(10);

    await dialTest.step('Publish a prompt with two versions', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await adminUserItemApiHelper.createPrompts([prompt]);

      for (const version of [firstVersion, secondVersion]) {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withDisplayAuthor(author)
          .withPromptInFolderResource(
            prompt,
            PublishActions.ADD_IF_ABSENT,
            version,
          )
          .build();
        const publication =
          await adminPublicationApiHelper.createPublishRequest(publishRequest);
        publicationsToUnpublish.push(publication);
        await adminPublicationApiHelper.approveRequest(publication);
      }
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Select "Info" option for published prompt from dropdown menu and verify modal data',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationPrompts.openEntityDropdownMenu(prompt.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.info, {
          triggeredHttpMethod: 'GET',
        });
        await informationModalAssertion.assertFields({
          createdDate: currentDate,
          author: author,
        });
        await informationModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Select the prompt, and verify "Prompt View" modal with restricted buttons is opened switch the version, click on "Info" button and verify modal data',
      async () => {
        await organizationPrompts.selectEntity(prompt.name, {
          isHttpMethodTriggered: true,
        });
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        for (const availableButton of [
          promptPreviewModal.promptDuplicateButton,
          promptPreviewModal.promptExportButton,
          promptPreviewModal.promptUnpublishButton,
          promptPreviewModal.promptInfoButton,
        ]) {
          await promptPreviewModalAssertion.assertElementState(
            availableButton,
            'visible',
          );
        }
        for (const notAvailableButton of [
          promptPreviewModal.editPromptButton,
          promptPreviewModal.promptMoveToButton,
          promptPreviewModal.promptShareButton,
          promptPreviewModal.promptPublishButton,
          promptPreviewModal.promptDeleteButton,
        ]) {
          await promptPreviewModalAssertion.assertElementState(
            notAvailableButton,
            'hidden',
          );
        }
      },
    );

    await dialTest.step(
      'Hover over "Unpublish" button and verify it is highlighted and tooltip is shown',
      async () => {
        await promptPreviewModal.promptUnpublishButton.hoverOver();
        await promptPreviewModalAssertion.assertElementColor(
          promptPreviewModal.promptUnpublishButton,
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textAccentPrimary),
        );
        await tooltipAssertion.assertTooltipContent(
          ExpectedPromptModalConst.unpublishButtonTooltip,
        );
      },
    );

    await dialTest.step(
      'Verify unpublish request modal is opened on click the button',
      async () => {
        await promptPreviewModal.promptUnpublishButton.click();
        await publishingRequestModalAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await promptToPublishAssertion.assertEntityColor(
          { name: prompt.name },
          ThemesUtil.getRgbColorByKey(ThemeColorAttributes.textError),
        );
        await publishingRequestModal.cancelButton.click();
        await promptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
      },
    );

    await dialTest.step(
      'Switch the version, click on "Info" button and verify modal data',
      async () => {
        await promptPreviewModal.version.click();
        await promptPreviewVersionDropdownMenu.selectMenuOption(firstVersion, {
          triggeredHttpMethod: 'GET',
        });
        await promptPreviewModal.openPromptInfo();
        await informationModalAssertion.assertFields({
          createdDate: currentDate,
          author: author,
        });
        await informationModal.cancelButton.click();
        await promptPreviewModal.closeButton.click();
      },
    );

    await dialAdminTest.step(
      'Duplicate published prompt, select "Info" option from dropdown menu and verify modal data',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminPrompts.openEntityDropdownMenu(prompt.name);
        await adminPromptDropdownMenu.selectMenuOption(MenuOptions.info, {
          triggeredHttpMethod: 'GET',
        });
        await adminInformationModalAssertion.assertFields({
          createdDate: currentDate,
          lastUpdatedDate: currentDate,
        });
      },
    );
  },
);

dialAdminTest(
  'Publish admin: reject prompt',
  async ({
    promptData,
    adminUserItemApiHelper,
    localStorageManager,
    adminApproveRequiredPromptsAssertion,
    adminPublishingApprovalModalAssertion,
    adminPublishingApprovalModal,
    adminApproveRequiredPrompts,
    adminOrganizationPromptAssertion,
    adminDialHomePage,
    adminLocalStorageManager,
    setTestIds,
    adminPublicationApiHelper,
    publishRequestBuilder,
  }) => {
    setTestIds('EPMRTC-3342');
    let prompt: Prompt;
    const publicationRequestName = GeneratorUtil.randomPublicationRequestName();

    await dialTest.step('Publish a prompt via API', async () => {
      prompt = promptData.prepareDefaultPrompt();
      await adminUserItemApiHelper.createPrompts([prompt]);
      const publishRequest = publishRequestBuilder
        .withName(publicationRequestName)
        .withPromptInFolderResource(prompt, PublishActions.ADD_IF_ABSENT)
        .build();
      await adminPublicationApiHelper.createPublishRequest(publishRequest);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialAdminTest.step(
      'Login as admin and open request details',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: publicationRequestName },
          'visible',
        );
        await adminApproveRequiredPrompts.expandApproveRequiredFolder(
          publicationRequestName,
          {
            isHttpMethodTriggered: true,
            httpHost: API.publicationRequestDetails,
          },
        );
        await adminApproveRequiredPromptsAssertion.assertFolderEntityState(
          { name: publicationRequestName },
          { name: prompt.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.rejectButton,
          'enabled',
        );
      },
    );

    await dialAdminTest.step(
      'Reject the request and verify it disappears from "Approve required" section, prompt is not displayed under "Organization" section',
      async () => {
        await adminPublishingApprovalModal.rejectRequest();
        await adminApproveRequiredPromptsAssertion.assertFolderState(
          { name: publicationRequestName },
          'hidden',
        );
        await adminOrganizationPromptAssertion.assertEntityState(
          { name: prompt.name },
          'hidden',
        );
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
