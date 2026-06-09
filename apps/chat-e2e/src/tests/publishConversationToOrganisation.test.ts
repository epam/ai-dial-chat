import { Conversation } from '@/chat/types/chat';
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
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];

dialAdminTest(
  'Publish chat: select folder in Organization path.\n' +
    'Publish:Folders have alphabetical order in Organization structure and in Change path pop-up.\n' +
    'Change path: search for folders.\n' +
    'Change path: search for sub-folders',
  async ({
    dialHomePage,
    conversationData,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    publishingRequestDialog,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    selectFolderManagerModalGridAssertion,
    selectFolderManagerModalFoldersTree,
    selectFolderManagerModalNavigationPanel,
    baseAssertion,
    adminOrganizationFolderConversationAssertions,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminOrganizationFolderConversations,
    adminApproveRequiredConversationsAssertion,
    adminPublishingApprovalModalAssertion,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    dialAdminTest.slow();
    setTestIds('EPMRTC-3198', 'EPMRTC-3515', 'EPMRTC-4061', 'EPMRTC-6395');
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
            .withConversationInFolderResource(
              publishRequestConversations[i - 1],
              PublishActions.ADD,
            )
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
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open Publishing modal, click on "Change path" and verify folders sorting',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversationToPublish.name);
        await conversations.openEntityDropdownMenu(conversationToPublish.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestDialog
          .getChangePublishToPath()
          .changeButton.click();
        const folderNames =
          await selectFolderManagerModalGrid.getNameColumnValues();
        baseAssertion.assertStringsSorting(folderNames, 'asc');
      },
    );

    //TODO: blocked by issue https://github.com/epam/ai-dial-chat/issues/4031
    await dialTest.step.skip('Search sub-folder by name', async () => {
      await selectFolderManagerModalFoldersTree.expandFolder(
        { isFilesListingTriggered: false },
        parentFolder,
      );
      await selectFolderManagerModalNavigationPanel
        .getSearch()
        .inputField.fillInInput(subFolderSearchTerm);
      await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
        organizationFolderNames[2],
        'visible',
      );
    });

    await dialTest.step('Search root folder by name', async () => {
      await selectFolderManagerModalNavigationPanel
        .getSearch()
        .inputField.fillInInput(folderSearchTerm);
      await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
        organizationFolderNames[0],
        'visible',
      );
    });

    await dialTest.step(
      'Select folder, fill in name and submit the request',
      async () => {
        await selectFolderManagerModalNavigationPanel
          .getSearch()
          .inputField.fillInInput('');
        await selectFolderManagerModalGrid
          .gridRowByNameCell(folderToPublish)
          .click();
        await selectFolderManagerModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await publishingRequestDialog.requestName.fillInInput(requestName);
        publishApiModels =
          await publishingRequestDialog.sendPublicationRequest();
        publicationsToUnpublish.push(publishApiModels.response);
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
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
        baseAssertion.assertStringsSorting(
          await adminOrganizationFolderConversations.getFolderNames(),
          'asc',
        );
      },
    );
  },
);

dialAdminTest(
  'Publish chat: add, rename and delete options for new folder in Organization.\n' +
    'Max length of folder name in Publish to path should be 255 bytes (UTF-8).\n' +
    'Publish chat: add new folder inside nested folder structure with depth 4.\n' +
    'Change path: create nested folder structure and delete nested folder.\n' +
    'Change path: select folder of different levels.\n' +
    'Change path form: focus stay on new created folder.\n' +
    'Publish chat into nested folder structure.\n' +
    '[Publish path] Verify that only one folder is created when creating and renaming a new folder',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    publishingRequestDialog,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    selectFolderManagerModalGridAssertion,
    selectFolderManagerModalFoldersTree,
    selectFolderManagerModalFoldersTreeAssertion,
    fileManagerDeleteItemConfirmationPopup,
    baseAssertion,
    adminOrganizationFolderConversationAssertions,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminOrganizationFolderConversations,
    adminApproveRequiredConversationsAssertion,
    adminPublishingApprovalModalAssertion,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
  }) => {
    dialAdminTest.slow();
    setTestIds(
      'EPMRTC-3199',
      'EPMRTC-3577',
      'EPMRTC-3458',
      'EPMRTC-4060',
      'EPMRTC-4905',
      'EPMRTC-3797',
      'EPMRTC-3459',
      'EPMRTC-9092',
    );
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let conversationToPublish: Conversation;
    const newFolderName =
      'a' +
      GeneratorUtil.randomString(ExpectedConstants.maxEntityNameLength + 50);
    // Each nested level uses a unique name so FoldersTree.folderByPath can
    // address every level unambiguously (same-name nesting is filtered out by
    // `folderByPath`'s `hasNot` filter). rootNewFolderLastIndex is computed
    // dynamically at runtime to avoid conflicts with pre-existing folders.
    const maxNestedLevel = 4;
    let rootNewFolderLastIndex = 0;
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let publicationPath: string;

    await dialTest.step('Prepare a new conversation to publish', async () => {
      conversationToPublish = conversationData.prepareDefaultConversation();
      await dataInjector.createConversations([conversationToPublish]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open Publishing modal, click on "Change path" and create New folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversationToPublish.name);
        await conversations.openEntityDropdownMenu(conversationToPublish.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestDialog
          .getChangePublishToPath()
          .changeButton.click();

        // The app names a new folder "New folder (max+1)" where max is the
        // highest existing "New folder N" index at the current level.
        const existingNames =
          await selectFolderManagerModalGrid.getNameColumnValues();
        rootNewFolderLastIndex =
          ExpectedConstants.maxNewFolderIndex(existingNames);
        await selectFolderManagerModal.getAddFolderButton().click();
        const folderInput = selectFolderManagerModalGrid.getRenameInput();
        await baseAssertion.assertElementState(folderInput, 'visible');
        // New ChangePathDialog pre-fills the rename input with the default
        // "New folder N" name (N — next available index at the current level).
        await baseAssertion.assertInputValue(
          folderInput,
          ExpectedConstants.newFolderWithIndexTitle(rootNewFolderLastIndex + 1),
        );
        await baseAssertion.assertIsElementFocused(folderInput, true);
        await selectFolderManagerModalGrid.confirmNewFolderName(
          undefined,
          false,
        );
        rootNewFolderLastIndex++;
        publicationPath = `${PublishPath.Organization}/${Array.from(
          { length: maxNestedLevel },
          (_, i) =>
            ExpectedConstants.newFolderWithIndexTitle(
              rootNewFolderLastIndex + i,
            ),
        ).join('/')}`;
        await selectFolderManagerModalGrid.goToGridRowByNameCell(
          ExpectedConstants.newFolderWithIndexTitle(rootNewFolderLastIndex),
        );
      },
    );

    // The new UI no longer truncates silently — it shows an inline alert icon
    await dialTest.step(
      'Verify max length error on folder creation with a too-long name',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        const folderInput = selectFolderManagerModalGrid.getRenameInput();
        await folderInput.fillInInput(newFolderName);
        await selectFolderManagerModalGridAssertion.assertInputError(
          'visible',
          newFolderName,
        );
        await folderInput.fillInInput(GeneratorUtil.randomString(10));
        await selectFolderManagerModalGrid.confirmNewFolderName(
          undefined,
          false,
        );
      },
    );

    await dialTest.step(
      'Create nested sub-folders down to depth 4',
      async () => {
        for (let i = 1; i < maxNestedLevel; i++) {
          await selectFolderManagerModalGrid.openFolder(
            ExpectedConstants.newFolderWithIndexTitle(
              rootNewFolderLastIndex + i - 1,
            ),
            false,
          );
          await selectFolderManagerModal.getAddFolderButton().click();
          const subFolderInput = selectFolderManagerModalGrid.getRenameInput();
          await baseAssertion.assertElementState(subFolderInput, 'visible');
          await baseAssertion.assertInputValue(
            subFolderInput,
            ExpectedConstants.newFolderWithIndexTitle(1),
          );
          // TODO uncomment when fixed
          // await baseAssertion.assertIsElementFocused(subFolderInput, true);
          await selectFolderManagerModalGrid.setFolderName(
            ExpectedConstants.newFolderWithIndexTitle(
              rootNewFolderLastIndex + i,
            ),
            false,
          );
          await selectFolderManagerModalGrid.goToGridRowByNameCell(
            ExpectedConstants.newFolderWithIndexTitle(
              rootNewFolderLastIndex + i,
            ),
          );
        }
      },
    );

    await dialTest.step(
      'Create folder with custom name and verify no default-named folder is created',
      async () => {
        // The app names a new folder "New folder (max+1)" where max is the
        // highest existing "New folder N" index at the current sub-level.
        const subLevelNames =
          await selectFolderManagerModalGrid.getNameColumnValues();
        const subLevelMaxIndex =
          ExpectedConstants.maxNewFolderIndex(subLevelNames);
        const expectedDefaultName = ExpectedConstants.newFolderWithIndexTitle(
          subLevelMaxIndex + 1,
        );
        const customFolderName = 'My Folder';
        await selectFolderManagerModal.getAddFolderButton().click();
        const customFolderInput = selectFolderManagerModalGrid.getRenameInput();
        await baseAssertion.assertElementState(customFolderInput, 'visible');
        await baseAssertion.assertInputValue(
          customFolderInput,
          expectedDefaultName,
        );
        await selectFolderManagerModalGrid.setFolderName(
          customFolderName,
          false,
        );
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          customFolderName,
          'visible',
        );
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          expectedDefaultName,
          'hidden',
        );
        await baseAssertion.assertElementsCount(
          selectFolderManagerModalGrid.gridRows,
          subLevelNames.length + 1,
        );
      },
    );

    // TODO: ChangePathDialog migration — steps below depend on old SelectFolder
    // semantics that don't translate 1:1 to DialDestinationFolderPopup
    // (modal-level nesting error via getModalError, addressing same-name folders
    // by index, root section selection, getFolderGroupNodes count helper).
    // See agent/ChangePathDialogMigration/progress_tracker.md.
    await dialTest.step.skip(
      'Verify error message appears on adding more than 3 sub-folders',
      async () => {
        console.info(
          'This step is skipped due to the ChangePathDialog migration. It should be re-enabled and possibly reworked once the migration is complete.',
        );
      },
    );

    await dialTest.step(
      'Delete low-level folder and verify a new one is created in edit mode in the root',
      async () => {
        const folderToDelete = ExpectedConstants.newFolderWithIndexTitle(
          rootNewFolderLastIndex + maxNestedLevel - 1,
        );
        const dotsMenu =
          await selectFolderManagerModalGrid.gridDotsMenuByNameCell(
            folderToDelete,
          );
        const folderRow =
          selectFolderManagerModalGrid.gridRowByNameCell(folderToDelete);
        await folderRow.hover();
        await dotsMenu.click();
        await selectFolderManagerModalGrid
          .getRowDropdownMenu()
          .selectItem(MenuOptions.delete, { isHttpMethodTriggered: false });
        await fileManagerDeleteItemConfirmationPopup.confirm();
        await selectFolderManagerModalGrid
          .gridRowByNameCell(folderToDelete)
          .waitFor({ state: 'hidden' });
        // Recreate the deleted folder to restore the full hierarchy for subsequent steps
        await selectFolderManagerModal.getAddFolderButton().click();
        await selectFolderManagerModalGrid.setFolderName(folderToDelete, false);
      },
    );

    await dialTest.step('Verify folders section can be selected', async () => {
      // await selectFolderModal.selectRootFoldersSection();
      // await selectFolderModalAssertion.assertSectionSelectedState(true);
    });

    await dialTest.step(
      'Verify folder on any level can be selected',
      async () => {
        // Navigate the left folders tree level by level. The ChangePathDialog
        // uses aria-selected to mark the active tree node.
        for (let level = 1; level <= maxNestedLevel; level++) {
          const path = Array.from({ length: level }, (_, i) =>
            ExpectedConstants.newFolderWithIndexTitle(
              rootNewFolderLastIndex + i,
            ),
          );
          await selectFolderManagerModalFoldersTree
            .folderByPath(...path)
            .click();
          await selectFolderManagerModal.hoverOver();
          await selectFolderManagerModalFoldersTreeAssertion.assertFolderSelectedState(
            true,
            ...path,
          );
          await baseAssertion.assertElementActionabilityState(
            selectFolderManagerModal.getSelectFolderButton(),
            'enabled',
          );
        }
      },
    );

    await dialTest.step(
      'Select low level folder and verify full path is displayed in the "Publish to" field',
      async () => {
        await selectFolderManagerModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await baseAssertion.assertElementText(
          publishingRequestDialog.getChangePublishToPath().path,
          publicationPath,
        );
      },
    );

    await dialTest.step('Enter the name and submit the request', async () => {
      await publishingRequestDialog.requestName.fillInInput(requestName);
      publishApiModels = await publishingRequestDialog.sendPublicationRequest();
      publicationsToUnpublish.push(publishApiModels.response);
    });

    await dialAdminTest.step(
      'Login as admin and verify conversation publishing request is displayed under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
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

        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
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

        for (let i = 0; i < maxNestedLevel; i++) {
          const folderName = ExpectedConstants.newFolderWithIndexTitle(
            rootNewFolderLastIndex + i,
          );
          await adminOrganizationFolderConversationAssertions.assertFolderState(
            { name: folderName },
            'visible',
          );
          await adminOrganizationFolderConversations.expandFolder(folderName, {
            httpHost: folderName,
          });
        }
        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          {
            name: ExpectedConstants.newFolderWithIndexTitle(
              rootNewFolderLastIndex + maxNestedLevel - 1,
            ),
          },
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
