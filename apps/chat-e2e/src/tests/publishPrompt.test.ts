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
    'Metadata for prompt inside publication request in Approve required section',
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
      adminApproveRequiredPromptDropdownMenu,
      adminPublishingApprovalModal,
      adminInformationModal,
      adminInformationModalAssertion,
      adminPublishingApprovalModalAssertion,
      setTestIds,
      baseAssertion,
      selectFolders,
      adminPublishedPromptPreviewModal,
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
      'EPMRTC-5571',
    );
    let prompt1: Prompt;
    let prompt2: Prompt;
    const folderName = GeneratorUtil.randomString(10);
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
      'User clicks on "Change path", hover 3 dots on folder1_new, create folder2, then delete it',
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
      'User reloads the page and reopens the modal in order to workaround the 2803 issue',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await prompts.openEntityDropdownMenu(prompt1.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
      },
    );

    await dialTest.step(
      'User creates folder and rename it under Organization, user renames folder',
      async () => {
        await selectFolderModal.newFolderButton.click();
        await selectFolders.renameEmptyFolderWithEnter(`${folderName}_rename`);
        await selectFolders.openFolderDropdownMenu(`${folderName}_rename`);
        await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
        await selectFolders.renameEmptyFolderWithEnter(folderName);
      },
    );

    await dialTest.step(
      'User reloads the page and reopens the modal in order to workaround the 2803 issue',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await prompts.openEntityDropdownMenu(prompt1.name);
        await promptDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderModal.newFolderButton.click();
        await selectFolders.renameEmptyFolderWithEnter(folderName);
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
        await publishingRequestModal.requestName.fillInInput(
          requestName1WithSpaces,
        );
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
      'Select "Info" option from request dropdown menu and verify modal data',
      async () => {
        await adminApproveRequiredPrompts.openFolderEntityDropdownMenu(
          requestName1WithoutLeadingAndTrailingSpaces,
          prompt1.name,
        );
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
          ExpectedConstants.promptViewModalTitle,
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
        await adminPublishedPromptPreviewModal
          .getPublicationReviewControl()
          .backToPublicationRequestButton.click();
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
          ExpectedConstants.promptViewModalTitle,
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
    'The first 160 symbols from the input text is used as publication request name #1661\n' +
    'Publication request name can not be blank\n' +
    'Publication request name with hieroglyph, specific letters.\n' +
    `Author's public name displayed in metadata for prompt from Organization`,
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
  }) => {
    dialAdminTest.slow();
    setTestIds(
      'EPMRTC-3599',
      'EPMRTC-3600',
      'EPMRTC-3601',
      'EPMRTC-3602',
      'EPMRTC-3603',
      'EPMRTC-3605',
      'EPMRTC-5653',
    );
    let prompt1: Prompt;
    const folderNameTemplate = GeneratorUtil.randomString(10);
    let folderName = folderNameTemplate;
    const publicationPath = `${PublishPath.Organization}/${folderNameTemplate} 1/${folderNameTemplate} 2/${folderNameTemplate} 3/${folderNameTemplate} 4`;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const requestNameWithTabs = `${requestName} Name\ttext\t1 한글이라는 고유한 문자 시스템을 사용하는데`;
    const requestNameWithoutTabs = `${requestName} Name text 1 한글이라는 고유한 문자 시스템을 사용하는데`;
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const expectedColor = ThemesUtil.getRgbColorByKey(
      ThemeColorAttributes.textPrimary,
    );
    const author = GeneratorUtil.randomString(10);
    const currentDate = DateUtil.getCurrentLocalDate();

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

    //TODO
    //Blocked by 1661
    // await dialTest.step(
    //   'Type long solid text of 200 symbols with spaces without enters, it should be truncated to 160 symbols',
    //   async () => {
    //     const longName = `${GeneratorUtil.randomString(50)} ${GeneratorUtil.randomString(49)} ${GeneratorUtil.randomString(99)}`;
    //     await publishingRequestModal.requestName.fillInInput(longName);
    //     await publishingRequestModal.getChangePublishToPath().changeButton.click(); // Click "Change Path" to move focus
    //     const truncatedName =  await publishingRequestModal.requestName.getElementLocator().inputValue();
    //     await baseAssertion.assertStringTruncatedTo160(longName, truncatedName);
    //   },
    // );

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
        await publishingRequestModal.author.fillInInput(author);
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
      'Click on "Go to a review" button and verify conversation details are displayed',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview({
          isHttpMethodTriggered: false,
        });
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalState(
          'visible',
        );
        await adminPublishedPromptPreviewModalAssertion.assertPromptPreviewModalTitle(
          ExpectedConstants.promptViewModalTitle,
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
      'by user1 reload page and check prompt in Organization section inside folder1',
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
          author: author,
        });
        await informationModal.cancelButton.click();
      },
    );
  },
);

dialAdminTest(
  'Metadata for prompt from Organization section.\n' +
    'Metadata for prompt with several versions from Organization section.\n' +
    'Metadata for prompt duplicated from chat from Organization',
  async ({
    promptData,
    adminUserItemApiHelper,
    localStorageManager,
    dialHomePage,
    organizationPrompts,
    promptPreviewModal,
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
    setTestIds('EPMRTC-5569', 'EPMRTC-5570', 'EPMRTC-6104');
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
          .withPromptResource(prompt, PublishActions.ADD_IF_ABSENT, version)
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
      'Select the prompt, switch the version, click on "Info" button and verify modal data',
      async () => {
        await organizationPrompts.selectEntity(prompt.name, {
          isHttpMethodTriggered: true,
        });
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

dialTest.afterAll(
  async ({ publicationApiHelper, adminPublicationApiHelper }) => {
    for (const publication of publicationsToUnpublish) {
      const unpublishResponse =
        await publicationApiHelper.createUnpublishRequest(publication);
      await adminPublicationApiHelper.approveRequest(unpublishResponse);
    }
  },
);
