import { Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { Publication, PublicationRequestModel } from '@/chat/types/publication';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  PublishPath,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { PublishActions } from '@epam/ai-dial-shared';

const publicationsToUnpublish: Publication[] = [];
const levelsCount = 4;

dialAdminTest(
  'Publish folder: folder with 2 chats.\n' +
    'Publish nested structure of folders.\n' +
    'Publish folder containing empty chats.\n' +
    'Publish folder with Replay chat and simple chats.\n' +
    'Publish admin: review all chats inside folder.\n' +
    `Link 'Go to a review' change to 'Continue review" when admin started review with "Go to a review" click.\n` +
    'Publish admin: Approve chat folder.\n' +
    'Organization section: context menu for chat folders',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    folderConversations,
    folderDropdownMenu,
    publishingRequestModal,
    publishingRequestFolderConversationAssertion,
    adminDialHomePage,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationReviewControl,
    adminTooltip,
    adminApproveRequiredConversationsAssertion,
    adminPublishingApprovalModalAssertion,
    adminFolderToApproveAssertion,
    adminChatHeaderAssertion,
    adminChatMessagesAssertion,
    adminOrganizationFolderConversations,
    adminOrganizationFolderDropdownMenuAssertion,
    adminOrganizationFolderConversationAssertions,
    adminTooltipAssertion,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-3372',
      'EPMRTC-3275',
      'EPMRTC-3566',
      'EPMRTC-3496',
      'EPMRTC-3373',
      'EPMRTC-3789',
      'EPMRTC-3225',
      'EPMRTC-3328',
    );
    let nestedFolders: FolderInterface[];
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    let emptyConversation: Conversation;
    let conversationToReplay: Conversation;
    let replayConversation: Conversation;
    let allConversations: Conversation[];
    let publishApiModels: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const requestName = GeneratorUtil.randomPublicationRequestName();
    let orderedConversations: string[] = [];
    let expectedConversationMessagesCount: number;

    await dialTest.step(
      'Prepare a folders hierarchy with 2 conversations, empty and replay conversations on the lowest level',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(levelsCount);
        firstConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        secondConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        emptyConversation = conversationData.prepareEmptyConversation();
        conversationData.resetData();
        conversationToReplay = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        replayConversation =
          conversationData.prepareDefaultReplayConversation(
            conversationToReplay,
          );

        allConversations = [
          firstConversation,
          secondConversation,
          emptyConversation,
          replayConversation,
        ];

        for (const conversation of allConversations) {
          conversation.folderId = nestedFolders[levelsCount - 1].id;
          conversation.id = `${conversation.folderId}/${conversation.id}`;
        }
        expectedConversationMessagesCount = firstConversation.messages.length;

        await dataInjector.createConversations(
          [...allConversations, conversationToReplay],
          ...nestedFolders,
        );
      },
    );

    await dialTest.step(
      'Select "Publish" folder dropdown menu option and verify publishing modal is opened, empty and replay chats are not available for publishing',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.openFolderDropdownMenu(nestedFolders[0].name);
        await folderDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
        for (const conversation of allConversations) {
          await publishingRequestFolderConversationAssertion.assertFolderEntityState(
            { name: nestedFolders[0].name },
            { name: conversation.name },
            conversation.name === emptyConversation.name ||
              conversation.name === replayConversation.name
              ? 'hidden'
              : 'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Set publication request name and send request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName);
        publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
        publicationsToUnpublish.push(publishApiModels.response);
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify publishing request is displayed under "Approve required" section',
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
      'Expand request and verify the whole folders hierarchy is displayed under the request',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        for (const folder of nestedFolders) {
          await adminApproveRequiredConversations.expandFolder(folder.name);
        }
        for (const conversation of allConversations) {
          await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
            { name: nestedFolders[0].name },
            { name: conversation.name },
            conversation.name === emptyConversation.name ||
              conversation.name === replayConversation.name
              ? 'hidden'
              : 'visible',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Verify folders hierarchy with non empty conversations is displayed on "Publication approval" modal, "Approve" button is disabled',
      async () => {
        for (const conversation of allConversations) {
          await adminFolderToApproveAssertion.assertFolderEntityState(
            { name: nestedFolders[0].name },
            { name: conversation.name },
            conversation.name === emptyConversation.name ||
              conversation.name === replayConversation.name
              ? 'hidden'
              : 'visible',
          );
        }
        await adminPublishingApprovalModalAssertion.assertElementActionabilityState(
          adminPublishingApprovalModal.approveButton,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Hover over "Approve" button and verify tooltip is displayed',
      async () => {
        await adminPublishingApprovalModal.approveButton.hoverOver();
        await adminTooltipAssertion.assertElementState(adminTooltip, 'visible');
        await adminTooltipAssertion.assertTooltipContent(
          ExpectedConstants.reviewResourcesTooltip,
        );
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Go to a review" button and verify the first conversation is opened, navigation buttons are available',
      async () => {
        orderedConversations = baseAssertion.sortStringsArray(
          [firstConversation.name, secondConversation.name],
          (f) => f.toLowerCase(),
          'asc',
        );
        await adminPublishingApprovalModalAssertion.assertReviewButtonTitle(
          ExpectedConstants.goToReviewButtonTitle,
        );
        await adminPublishingApprovalModal.goToEntityReview();
        await adminApproveRequiredConversationsAssertion.assertFolderEntitySelectedState(
          { name: nestedFolders[0].name },
          { name: orderedConversations[0] },
          true,
        );
        await adminChatHeaderAssertion.assertHeaderTitle(
          orderedConversations[0],
        );
        await adminChatMessagesAssertion.assertMessagesCount(
          expectedConversationMessagesCount,
        );
        await baseAssertion.assertElementState(
          adminPublicationReviewControl.backToPublicationRequestButton,
          'visible',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.backToPublicationRequestButton,
          'enabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.nextButton,
          'enabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.previousButton,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Next" button and verify the second conversation is opened, back button is available',
      async () => {
        await adminPublicationReviewControl.goNext();
        await adminApproveRequiredConversationsAssertion.assertFolderEntitySelectedState(
          { name: nestedFolders[0].name },
          { name: orderedConversations[1] },
          true,
        );
        await adminChatHeaderAssertion.assertHeaderTitle(
          orderedConversations[1],
        );
        await adminChatMessagesAssertion.assertMessagesCount(
          expectedConversationMessagesCount,
        );
        await baseAssertion.assertElementState(
          adminPublicationReviewControl.backToPublicationRequestButton,
          'visible',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.nextButton,
          'disabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.previousButton,
          'enabled',
        );
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Previous" button and verify the first conversation is opened',
      async () => {
        await adminPublicationReviewControl.goBack({
          isHttpMethodTriggered: false,
        });
        await adminApproveRequiredConversationsAssertion.assertFolderEntitySelectedState(
          { name: nestedFolders[0].name },
          { name: orderedConversations[0] },
          true,
        );
        await adminChatHeaderAssertion.assertHeaderTitle(
          orderedConversations[0],
        );
        await adminChatMessagesAssertion.assertMessagesCount(
          expectedConversationMessagesCount,
        );
        await baseAssertion.assertElementState(
          adminPublicationReviewControl.backToPublicationRequestButton,
          'visible',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.nextButton,
          'enabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.previousButton,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Back to publication request" button and verify approve request modal is displayed, "Continue review" button is available, "Approve" button is enabled',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
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

    await dialAdminTest.step(
      'Approves the request and verify the whole folder hierarchy is displayed under "Organization" section, publish request disappears from "Approve required" section',
      async () => {
        await adminPublishingApprovalModal.approveRequest();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'hidden',
        );
        for (const folder of nestedFolders) {
          await adminOrganizationFolderConversations.expandFolder(folder.name);
        }
        for (const conversation of allConversations) {
          await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
            { name: nestedFolders[0].name },
            { name: conversation.name },
            conversation.name === emptyConversation.name ||
              conversation.name === replayConversation.name
              ? 'hidden'
              : 'visible',
          );
        }
      },
    );

    await dialAdminTest.step(
      'Verify available menu options for the published folder under "Organization" section',
      async () => {
        await adminOrganizationFolderConversations.openFolderDropdownMenu(
          nestedFolders[0].name,
        );
        await adminOrganizationFolderDropdownMenuAssertion.assertMenuOptions([
          MenuOptions.unpublish,
        ]);
      },
    );
  },
);

dialAdminTest(
  'Published folder became available in Change path form for publish request.\n' +
    'Publish chat: Change path: context menu for existing folders.\n' +
    'Publish folder into nested folder structure with depth 4.\n' +
    'Publish folder: update path in publish request.\n' +
    'Publish request toooltips.\n' +
    'admin view: create publication request when open request from Approve required',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    folderConversations,
    folderDropdownMenu,
    publishingRequestModal,
    folderConversationsToPublish,
    selectFolders,
    selectFoldersAssertion,
    publicationApiHelper,
    publishRequestBuilder,
    adminPublicationApiHelper,
    selectFolderModal,
    toastAssertion,
    adminDialHomePage,
    adminPublishingRequestModal,
    adminApproveRequiredConversationsAssertion,
    adminChatHeaderAssertion,
    adminChatMessagesAssertion,
    baseAssertion,
    tooltipAssertion,
    adminPublicationReviewControl,
    adminDataInjector,
    adminApproveRequiredConversations,
    adminConversations,
    adminConversationDropdownMenu,
    adminConversationToPublishAssertion,
    adminPublishingApprovalModalAssertion,
    adminFolderToApproveAssertion,
    adminPublishingApprovalModal,
    adminOrganizationFolderConversations,
    adminOrganizationFolderConversationAssertions,
    setTestIds,
  }) => {
    setTestIds(
      'EPMRTC-3613',
      'EPMRTC-3456',
      'EPMRTC-3460',
      'EPMRTC-3204',
      'EPMRTC-3457',
      'EPMRTC-3943',
    );
    let publishedFolderConversation: FolderConversation;
    let folderConversationToPublish: FolderConversation;
    let adminConversation: Conversation;
    const orgFolder = GeneratorUtil.randomString(5);
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const publicationPath = `${PublishPath.Organization}/${orgFolder}`;

    await dialTest.step(
      'Create two folders with conversation and publish one of them',
      async () => {
        publishedFolderConversation =
          conversationData.prepareDefaultConversationInFolder();
        conversationData.resetData();
        folderConversationToPublish =
          conversationData.prepareDefaultConversationInFolder();
        conversationData.resetData();
        await dataInjector.createConversations(
          [
            ...publishedFolderConversation.conversations,
            ...folderConversationToPublish.conversations,
          ],
          publishedFolderConversation.folders,
          folderConversationToPublish.folders,
        );

        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withConversationResource(
            publishedFolderConversation.conversations[0],
            PublishActions.ADD,
          )
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        publicationsToUnpublish.push(publication);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step(
      'Create publication request for another folder',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await folderConversations.openFolderDropdownMenu(
          folderConversationToPublish.folders.name,
        );
        await folderDropdownMenu.selectMenuOption(MenuOptions.publish);
        await baseAssertion.assertElementState(
          publishingRequestModal,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on "Change path" and verify published folder is visible in the tree and selectable',
      async () => {
        await publishingRequestModal
          .getChangePublishToPath()
          .changeButton.click();
        await selectFoldersAssertion.assertFolderState(
          { name: publishedFolderConversation.folders.name },
          'visible',
        );
        await selectFolderModal.selectFolder(
          publishedFolderConversation.folders.name,
        );
        await selectFoldersAssertion.assertFolderSelectedState(
          { name: publishedFolderConversation.folders.name },
          true,
        );
      },
    );

    await dialTest.step(
      'Open folder dropdown menu and verify available options',
      async () => {
        await selectFolders.openFolderDropdownMenu(
          publishedFolderConversation.folders.name,
        );
        const actualOptions = await folderDropdownMenu.getAllMenuOptions();
        baseAssertion.assertArrayIncludesAll(
          actualOptions,
          [MenuOptions.addNewFolder],
          ExpectedMessages.contextMenuOptionsValid,
        );
      },
    );

    await dialTest.step(
      'Create max length folder hierarchy and verify error toast is shown on attempt to select low-level folder',
      async () => {
        await folderDropdownMenu.selectMenuOption(MenuOptions.addNewFolder);
        await selectFolders.getEditFolderInputActions().clickTickButton();

        for (let i = 1; i <= levelsCount - 2; i++) {
          await selectFolders.openFolderDropdownMenu(
            ExpectedConstants.newFolderWithIndexTitle(1),
            i,
          );
          await folderDropdownMenu.selectMenuOption(MenuOptions.addNewFolder);
          await selectFolders.getEditFolderInputActions().clickTickButton();
        }

        await selectFolderModal.selectFolder(
          ExpectedConstants.newFolderWithIndexTitle(1),
          levelsCount - 1,
        );
        await selectFolderModal.clickSelectFolderButton();
        await toastAssertion.assertToastMessage(
          ExpectedConstants.tooManyNestedFolders,
          ExpectedMessages.tooManyNestedFolders,
        );
      },
    );

    await dialTest.step(
      'Create new folder, select it and verify publish path changed',
      async () => {
        await selectFolderModal.newFolderButton.click();
        await selectFolders.editFolderNameWithTick(orgFolder, {
          isHttpMethodTriggered: false,
        });
        await selectFolderModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await baseAssertion.assertElementText(
          publishingRequestModal.getChangePublishToPath().path,
          publicationPath,
        );
      },
    );

    await dialTest.step(
      'Hover over "Publish to" path and verify tooltip is shown',
      async () => {
        await publishingRequestModal.getChangePublishToPath().path.hoverOver();
        await tooltipAssertion.assertTooltipContent(publicationPath);
      },
    );

    await dialTest.step(
      'Hover over conversation and verify tooltip is shown',
      async () => {
        await folderConversationsToPublish
          .getFolderEntityNameElement(
            folderConversationToPublish.folders.name,
            folderConversationToPublish.conversations[0].name,
          )
          .hoverOver();
        await tooltipAssertion.assertTooltipContent(
          folderConversationToPublish.conversations[0].name,
        );
      },
    );

    await dialTest.step(
      'Hover over conversation folder and verify tooltip is shown',
      async () => {
        await folderConversationsToPublish
          .getFolderName(folderConversationToPublish.folders.name)
          .hoverOver();
        await tooltipAssertion.assertTooltipContent(
          folderConversationToPublish.folders.name,
        );
      },
    );

    await dialTest.step(
      'Set publication request name and send request',
      async () => {
        await publishingRequestModal.requestName.fillInInput(requestName);
        const publishApiModels =
          await publishingRequestModal.sendPublicationRequest();
        publicationsToUnpublish.push(publishApiModels.response);
      },
    );

    await dialAdminTest.step(
      'Prepare conversation for admin user',
      async () => {
        adminConversation = conversationData.prepareDefaultConversation();
        await adminDataInjector.createConversations([adminConversation]);
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify publishing request is displayed under "Approve required" section',
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
      'Expand request and verify conversation inside folder is displayed under the request',
      async () => {
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminApproveRequiredConversations.expandFolder(
          folderConversationToPublish.folders.name,
        );
        await adminApproveRequiredConversationsAssertion.assertFolderEntityState(
          { name: folderConversationToPublish.folders.name },
          { name: folderConversationToPublish.conversations[0].name },
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Verify folders hierarchy is displayed on "Publication approval" modal and "Publish to" path',
      async () => {
        await adminFolderToApproveAssertion.assertFolderEntityState(
          { name: folderConversationToPublish.folders.name },
          { name: folderConversationToPublish.conversations[0].name },
          'visible',
        );
        await adminPublishingApprovalModalAssertion.assertPublishToPath(
          publicationPath,
        );
      },
    );

    await dialAdminTest.step(
      `Create publication request for today's chat and verify request modal with conversation details is displayed`,
      async () => {
        await adminConversations.openEntityDropdownMenu(adminConversation.name);
        await adminConversationDropdownMenu.selectMenuOption(
          MenuOptions.publish,
        );
        await baseAssertion.assertElementState(
          adminPublishingRequestModal,
          'visible',
        );
        await adminConversationToPublishAssertion.assertEntityState(
          { name: adminConversation.name },
          'visible',
        );
        await adminPublishingRequestModal.cancelButton.click();
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Go to a review" button and verify the folder conversation is opened, navigation buttons are disabled',
      async () => {
        await adminPublishingApprovalModal.goToEntityReview();
        await adminApproveRequiredConversationsAssertion.assertFolderEntitySelectedState(
          { name: folderConversationToPublish.folders.name },
          { name: folderConversationToPublish.conversations[0].name },
          true,
        );
        await adminChatHeaderAssertion.assertHeaderTitle(
          folderConversationToPublish.conversations[0].name,
        );
        await adminChatMessagesAssertion.assertMessagesCount(
          folderConversationToPublish.conversations[0].messages.length,
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.nextButton,
          'disabled',
        );
        await baseAssertion.assertElementActionabilityState(
          adminPublicationReviewControl.previousButton,
          'disabled',
        );
      },
    );

    await dialAdminTest.step(
      'Admin clicks on "Back to publication request", approves the request and verify the whole folder hierarchy is displayed under "Organization" section',
      async () => {
        await adminPublicationReviewControl.backToPublicationRequest();
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingApprovalModal.approveRequest();
        for (const folder of [
          orgFolder,
          folderConversationToPublish.folders.name,
        ]) {
          await adminOrganizationFolderConversations.expandFolder(folder);
        }
        await adminOrganizationFolderConversationAssertions.assertFolderEntityState(
          { name: orgFolder },
          { name: folderConversationToPublish.conversations[0].name },
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
