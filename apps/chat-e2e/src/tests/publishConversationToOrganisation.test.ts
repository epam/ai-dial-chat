import { Conversation } from '@/chat/types/chat';
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
import { GeneratorUtil } from '@/src/utils';

const publicationsToUnpublish: Publication[] = [];

dialAdminTest(
  'Publish chat: select folder in Organization path.\n' +
    'Publish:Folders have alphabetical order in Organization structure and in Change path pop-up.\n' +
    'Change path: search for folders',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    publishingRequestModal,
    selectFolderModal,
    selectFolders,
    selectFoldersAssertion,
    adminOrganizationFolderConversationAssertions,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminOrganizationFolderConversations,
    adminApproveRequiredConversationsAssertion,
    adminPublishingApprovalModalAssertion,
    setTestIds,
  }) => {
    dialAdminTest.slow();
    setTestIds('EPMRTC-3198', 'EPMRTC-3515', 'EPMRTC-4061');
    const publishRequestConversations: Conversation[] = [];
    const subFolder = 'subfolder 3.1';
    const subFolderSearchTerm = subFolder.split(' ')[1];
    const organizationFolderNames = [
      'AFolder',
      'B Folder',
      `c_folder/${subFolder}`,
    ];
    const parentFolder = organizationFolderNames[2].split('/')[0];
    const folderSearchTerm = organizationFolderNames[0].substring(0, 3);
    const folderToPublish = organizationFolderNames[1];
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let conversationToPublish: Conversation;
    const requestName = GeneratorUtil.randomPublicationRequestName();

    await dialTest.step(
      'Create three publications to the different folders',
      async () => {
        for (let i = 1; i <= 3; i++) {
          publishRequestConversations.push(
            conversationData.prepareDefaultConversation(),
          );
          conversationData.resetData();
        }
        await dataInjector.createConversations(publishRequestConversations);

        for (let i = 1; i <= 3; i++) {
          const publishRequest = publishRequestBuilder
            .withName(GeneratorUtil.randomPublicationRequestName())
            .withTargetFolder(organizationFolderNames[i - 1])
            .withConversationResource(publishRequestConversations[i - 1])
            .build();
          const publication =
            await publicationApiHelper.createPublishRequest(publishRequest);
          publicationsToUnpublish.push(publication);
          await adminPublicationApiHelper.approveRequest(publication);
        }
      },
    );

    await dialTest.step('Prepare a new conversation to publish', async () => {
      conversationToPublish = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversationToPublish]);
      await localStorageManager.setSelectedConversation(conversationToPublish);
    });

    await dialTest.step(
      'Open Publishing modal, click on "Change path" and verify folders sorting',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversationToPublish.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFoldersAssertion.assertStringsSorting(
          await selectFolders.getFolderNames(),
          'asc',
        );
      },
    );

    await dialTest.step('Search sub-folder by name', async () => {
      await selectFolders.expandFolder(parentFolder);
      await selectFolderModal.searchInput.fillInInput(subFolderSearchTerm);
      await selectFoldersAssertion.assertSearchResultRepresentation(
        organizationFolderNames[2],
      );
    });

    await dialTest.step('Search root folder by name', async () => {
      await selectFolderModal.searchInput.fillInInput(folderSearchTerm);
      await selectFoldersAssertion.assertSearchResultRepresentation(
        organizationFolderNames[0],
      );
    });

    await dialTest.step(
      'Select folder, fill in name and submit the request',
      async () => {
        await selectFolderModal.searchInput.fillInInput('');
        await selectFolderModal.selectFolder(folderToPublish);
        await selectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await publishingRequestModal.requestName.fillInInput(requestName);
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
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request folder and verify "Publication approval" modal is displayed, publish path is correct',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: conversationToPublish.name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertPublishingApprovalModalState(
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertPublishToPath(
          `${PublishPath.Organization}/${folderToPublish}`,
        );
      },
    );

    await dialAdminTest.step(
      'Review publication, go back, approve publication and verify folder is displayed under "Organization" section',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await adminOrganizationFolderConversationAssertions.assertFolderState(
          { name: folderToPublish },
          'visible',
        );
        await adminOrganizationFolderConversations.expandFolder(
          folderToPublish,
        );
        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          { name: folderToPublish },
          { name: conversationToPublish.name },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Verify folders sorting in "Organization" section',
      async () => {
        await selectFoldersAssertion.assertStringsSorting(
          await adminOrganizationFolderConversations.getFolderNames(),
          'asc',
        );
      },
    );
  },
);

dialAdminTest(
  'Publish chat: add, rename and delete options for new folder in Organization.\n' +
    'Max length of folder name in Publish to path should be 160 symbols .\n' +
    'Publish chat: add new folder inside nested folder structure with depth 4.\n' +
    'Change path: select folder of different levels.\n' +
    'Change path form: focus stay on new created folder.\n' +
    'Publish chat into nested folder structure',
  async ({
    dialHomePage,
    conversationData,
    localStorageManager,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    publishingRequestModal,
    selectFolderModal,
    selectFolders,
    folderDropdownMenu,
    folderDropdownMenuAssertion,
    selectFoldersAssertion,
    errorToastAssertion,
    selectFolderModalAssertion,
    changePublishPathAssertion,
    adminOrganizationFolderConversationAssertions,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminOrganizationFolderConversations,
    adminApproveRequiredConversationsAssertion,
    adminPublishingApprovalModalAssertion,
    setTestIds,
  }) => {
    dialAdminTest.slow();
    setTestIds(
      'EPMRTC-3199',
      'EPMRTC-3577',
      'EPMRTC-3458',
      'EPMRTC-4060',
      'EPMRTC-3797',
      'EPMRTC-3459',
    );
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let conversationToPublish: Conversation;
    const maxNestedLevel = 4;
    const maxNameLength = 160;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const newFolderName = GeneratorUtil.randomString(maxNameLength * 1.5);
    const cutNewFolderName = newFolderName.substring(0, maxNameLength);
    const publicationPath = `${PublishPath.Organization}/${cutNewFolderName}/${ExpectedConstants.newFolderWithIndexTitle(1)}/${ExpectedConstants.newFolderWithIndexTitle(2)}/${ExpectedConstants.newFolderWithIndexTitle(3)}`;

    await dialTest.step('Prepare a new conversation to publish', async () => {
      conversationToPublish = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversationToPublish]);
      await localStorageManager.setSelectedConversation(conversationToPublish);
    });

    await dialTest.step(
      'Open Publishing modal, click on "Change path" and create New folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversationToPublish.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderModal.newFolderButton.click();
        await selectFoldersAssertion.assertFolderEditInputState('visible');
        await selectFoldersAssertion.assertFolderEditInputValue(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await selectFolders.getEditFolderInputActions().clickTickButton();
        await selectFoldersAssertion.assertFolderState(
          { name: ExpectedConstants.newFolderWithIndexTitle(1) },
          'visible',
        );
      },
    );

    await dialTest.step(
      'Open folder dropdown menu and verify available options',
      async () => {
        await selectFolders.openFolderDropdownMenu(
          ExpectedConstants.newFolderWithIndexTitle(1),
        );
        await folderDropdownMenuAssertion.assertMenuOptions([
          MenuOptions.rename,
          MenuOptions.delete,
          MenuOptions.addNewFolder,
        ]);
      },
    );

    await dialTest.step('Verify folder renaming and max length', async () => {
      await folderDropdownMenu.selectMenuOption(MenuOptions.rename);
      await selectFolders.editFolderNameWithTick(newFolderName, {
        isHttpMethodTriggered: false,
      });
      await selectFoldersAssertion.assertFolderState(
        { name: cutNewFolderName },
        'visible',
      );
    });

    await dialTest.step('Verify new sub-folder adding', async () => {
      await selectFolders.openFolderDropdownMenu(cutNewFolderName);
      await folderDropdownMenu.selectMenuOption(MenuOptions.addNewFolder);
      await selectFoldersAssertion.assertFolderEditInputValue(
        ExpectedConstants.newFolderWithIndexTitle(1),
      );
      await selectFolders.getEditFolderInputActions().clickTickButton();
      await selectFoldersAssertion.assertFolderState(
        { name: ExpectedConstants.newFolderWithIndexTitle(1) },
        'visible',
      );
    });

    await dialTest.step(
      'Verify error message appears on adding more than 3 sub-folders',
      async () => {
        for (let i = 1; i <= maxNestedLevel - 1; i++) {
          await selectFolders.openFolderDropdownMenu(
            ExpectedConstants.newFolderWithIndexTitle(i),
          );
          await folderDropdownMenu.selectMenuOption(MenuOptions.addNewFolder);
          if (i === maxNestedLevel - 1) {
            await errorToastAssertion.assertToastMessage(
              ExpectedConstants.tooManyNestedFolders,
              ExpectedMessages.tooManyNestedFolders,
            );
          } else {
            await selectFolders.getEditFolderInputActions().clickTickButton();
            await selectFoldersAssertion.assertFolderState(
              { name: ExpectedConstants.newFolderWithIndexTitle(i + 1) },
              'visible',
            );
          }
        }
      },
    );

    await dialTest.step('Verify folders section can be selected', async () => {
      await selectFolderModal.selectRootFoldersSection();
      await selectFolderModalAssertion.assertSectionSelectedState(true);
    });

    await dialTest.step(
      'Verify folder on any level can be selected',
      async () => {
        await selectFolderModal.selectRootFoldersSection();
        await selectFolderModal.selectFolder(cutNewFolderName);
        await selectFoldersAssertion.assertFolderSelectedState(
          { name: cutNewFolderName },
          true,
        );

        for (let i = 1; i <= maxNestedLevel - 1; i++) {
          //TODO:remove the clause when fixed https://github.com/epam/ai-dial-chat/issues/2294
          if (i === maxNestedLevel - 1) {
            await selectFolders.getEditFolderInputActions().clickTickButton();
          }
          await selectFolderModal.selectFolder(
            ExpectedConstants.newFolderWithIndexTitle(i),
          );
          await selectFoldersAssertion.assertFolderSelectedState(
            { name: ExpectedConstants.newFolderWithIndexTitle(i) },
            true,
          );
          await selectFolders.expandFolder(
            ExpectedConstants.newFolderWithIndexTitle(i),
          );
        }
      },
    );

    await dialTest.step(
      'Select low level folder and verify full path is displayed in the "Publish to" field',
      async () => {
        await selectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await changePublishPathAssertion.assertPath(publicationPath);
      },
    );

    await dialTest.step('Enter the name and submit the request', async () => {
      await publishingRequestModal.requestName.fillInInput(requestName);
      publishApiModels = await publishingRequestModal.sendPublicationRequest();
      publicationsToUnpublish.push(publishApiModels.response);
    });

    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Expand request and verify publication path is valid',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: requestName },
          { name: conversationToPublish.name },
          'visible',
        );

        await adminPublishingApprovalModalAssertion.assertPublishingApprovalModalState(
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertPublishToPath(
          publicationPath,
        );
      },
    );

    await dialAdminTest.step(
      'Review publication, go back, approve publication and verify the whole hierarchy is displayed under "Organization" section',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModal.approveRequest();

        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded();
        await adminOrganizationFolderConversationAssertions.assertFolderState(
          { name: cutNewFolderName },
          'visible',
        );
        await adminOrganizationFolderConversations.expandFolder(
          cutNewFolderName,
          { httpHost: cutNewFolderName },
        );
        for (let i = 1; i <= maxNestedLevel - 1; i++) {
          await adminOrganizationFolderConversationAssertions.assertFolderState(
            { name: ExpectedConstants.newFolderWithIndexTitle(i) },
            'visible',
          );
          await adminOrganizationFolderConversations.expandFolder(
            ExpectedConstants.newFolderWithIndexTitle(i),
            { httpHost: ExpectedConstants.newFolderWithIndexTitle(i) },
          );
        }

        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          { name: ExpectedConstants.newFolderWithIndexTitle(3) },
          { name: conversationToPublish.name },
          'visible',
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
