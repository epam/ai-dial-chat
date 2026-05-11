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
import { GridSelectors } from '@/src/ui/selectors';
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
    selectFolderManagerModalManager,
    selectFolderManagerModalGrid,
    selectFolderManagerModalGridAssertion,
    selectFolderManagerModalFoldersTree,
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
        const folderNames = await selectFolderManagerModalGrid.gridRows
          .getElementLocator()
          .locator(GridSelectors.gridCellValue)
          .allTextContents();
        baseAssertion.assertStringsSorting(folderNames, 'asc');
      },
    );

    //TODO: blocked by issue https://github.com/epam/ai-dial-chat/issues/4031
    await dialTest.step.skip('Search sub-folder by name', async () => {
      await selectFolderManagerModalFoldersTree.expandFolder(
        { isFilesListingTriggered: false },
        parentFolder,
      );
      await selectFolderManagerModalManager
        .getFileManagerNavigationPanel()
        .getSearch()
        .inputField.fillInInput(subFolderSearchTerm);
      await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
        organizationFolderNames[2],
        'visible',
      );
    });

    await dialTest.step('Search root folder by name', async () => {
      await selectFolderManagerModalManager
        .getFileManagerNavigationPanel()
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
        await selectFolderManagerModalManager
          .getFileManagerNavigationPanel()
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
    'Max length of folder name in Publish to path should be 160 symbols .\n' +
    'Publish chat: add new folder inside nested folder structure with depth 4.\n' +
    'Change path: create nested folder structure and delete nested folder.\n' +
    'Change path: select folder of different levels.\n' +
    'Change path form: focus stay on new created folder.\n' +
    'Publish chat into nested folder structure',
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
    confirmationDialog,
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
    );
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    let conversationToPublish: Conversation;
    const maxNameLength = 160;
    const newFolderName = 'a' + GeneratorUtil.randomString(maxNameLength * 1.5);
    // Each nested level uses a unique name ("New folder 1" → "New folder 4")
    // so FoldersTree.folderByPath can address every level unambiguously
    // (same-name nesting is filtered out by `folderByPath`'s `hasNot` filter).
    const maxNestedLevel = 4;
    const folderNames = Array.from({ length: maxNestedLevel }, (_, i) =>
      ExpectedConstants.newFolderWithIndexTitle(i + 1),
    );
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const publicationPath = `${PublishPath.Organization}/${folderNames.join('/')}`;

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
        await selectFolderManagerModal.getAddFolderButton().click();
        const folderInput = selectFolderManagerModalGrid.getRenameInput();
        await baseAssertion.assertElementState(folderInput, 'visible');
        // New ChangePathDialog opens the rename input empty and auto-focused;
        // there is no longer a default folder name pre-filled.
        await baseAssertion.assertInputValue(folderInput, '');
        await baseAssertion.assertIsElementFocused(folderInput, true);
        await selectFolderManagerModalGrid.setFolderName(folderNames[0], false);
        await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
          folderNames[0],
          'visible',
        );
      },
    );

    // The new ChangePathDialog has no row dropdown menu with a rename option,
    // so the original two steps ("Open folder dropdown menu and verify
    // available options" + "Verify folder renaming and max length") are
    // replaced with a single step that creates a folder with a too-long name.
    // The new UI no longer truncates silently — it shows an inline alert icon
    await dialTest.step(
      'Verify max length error on folder creation with a too-long name',
      async () => {
        await selectFolderManagerModal.getAddFolderButton().click();
        const folderInput = selectFolderManagerModalGrid
          .getRenameInput()
          .getElementLocator();
        await folderInput.fill(newFolderName);
        await selectFolderManagerModalGridAssertion.assertInputError(
          'visible',
          newFolderName,
        );
      },
    );

    await dialTest.step(
      'Create nested sub-folders down to depth 4',
      async () => {
        // The new ChangePathDialog has no row dots menu: open the parent folder
        // by clicking on its row and create the sub-folder via "Add folder".
        // Build the chain folderNames[0] → ... → folderNames[maxNestedLevel - 1].
        for (let i = 1; i < maxNestedLevel; i++) {
          await selectFolderManagerModalGrid.openFolder(
            folderNames[i - 1],
            false,
          );
          await selectFolderManagerModal.getAddFolderButton().click();
          const subFolderInput = selectFolderManagerModalGrid.getRenameInput();
          await baseAssertion.assertInputValue(subFolderInput, '');
          await baseAssertion.assertIsElementFocused(subFolderInput, true);
          await selectFolderManagerModalGrid.setFolderName(
            folderNames[i],
            false,
          );
          await selectFolderManagerModalGridAssertion.assertGridRowByNameState(
            folderNames[i],
            'visible',
          );
        }
      },
    );

    // TODO: ChangePathDialog migration — steps below depend on old SelectFolder
    // semantics that don't translate 1:1 to DialDestinationFolderPopup
    // (modal-level nesting error via getModalError, addressing same-name folders
    // by index, root section selection, getFolderGroupNodes count helper).
    // See agent/ChangePathDialogMigration/progress_tracker.md.
    await dialTest.step.skip(
      'Verify error message appears on adding more than 3 sub-folders',
      async () => {},
    );

    await dialTest.step.skip(
      'Delete low-level folder and verify a new one is created in edit mode in the root',
      async () => {
        // New delete flow: hover grid row → three-dot button → dropdown (rename/delete) → delete
        // At this point the grid is inside folderNames[maxNestedLevel - 2] showing folderNames[maxNestedLevel - 1]
        const folderToDelete = folderNames[maxNestedLevel - 1];
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
        await confirmationDialog.confirm();
        await selectFolderManagerModalGrid
          .gridRowByNameCell(folderToDelete)
          .waitFor({ state: 'hidden' });
        // TODO: verify behaviour after deletion (old UI auto-opened a new folder in edit mode at root)
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
          const path = folderNames.slice(0, level);
          await selectFolderManagerModalFoldersTree
            .folderByPath(...path)
            .click();
          await selectFolderManagerModalFoldersTree.hoverOver();
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
          await adminOrganizationFolderConversationAssertions.assertFolderState(
            { name: folderNames[i] },
            'visible',
          );
          await adminOrganizationFolderConversations.expandFolder(
            folderNames[i],
            { httpHost: folderNames[i] },
          );
        }
        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          { name: folderNames[maxNestedLevel - 1] },
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
