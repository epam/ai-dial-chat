import { PublicationFunctions } from '@/chat/types/publication';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  API,
  BooleanOperator,
  ExpectedConstants,
  MenuOptions,
  PublishingRulesFilterTarget,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { Conversation, PublishActions } from '@epam/ai-dial-shared';

dialSharedWithMeTest(
  'Modify filters for existing folder when select folder for publication',
  async ({
    conversationData,
    dataInjector,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
    additionalShareUserDataInjector,
    additionalShareUserLocalStorageManager,
    additionalShareUserDialHomePage,
    additionalShareUserConversations,
    additionalShareUserConversationDropdownMenu,
    additionalShareUserPublishingRequestDialog,
    additionalShareUserSelectFolderManagerModalFoldersTree,
    additionalShareUserSelectFolderManagerModal,
    additionalShareUserPublishingRules,
    additionalShareUserPublishingRulesAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-3655');
    const publishFolder = GeneratorUtil.randomString(10);
    const filterValue = 'age';
    let additionalUserConversation: Conversation;

    await dialTest.step(
      'Publish org folder with filter via API, available for AdditionalUser',
      async () => {
        const conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withTargetFolder(publishFolder)
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .withRule({
            source: ExpectedConstants.dialRolesField,
            function: PublicationFunctions.Contain,
            targets: [filterValue],
          })
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step(
      'AdditionalUser creates a new chat via API',
      async () => {
        additionalUserConversation =
          conversationData.prepareDefaultConversation();
        await additionalShareUserDataInjector.createConversations([
          additionalUserConversation,
        ]);
      },
    );

    await dialTest.step(
      'AdditionalUser opens Publish request for the created chat, selects the already published folder in "Change path" form and verifies the filter section',
      async () => {
        await additionalShareUserLocalStorageManager.setShowSideBarPanels();
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserConversations.openEntityDropdownMenu(
          additionalUserConversation.name,
        );
        await additionalShareUserConversationDropdownMenu.selectMenuOption(
          MenuOptions.publish,
        );
        await additionalShareUserPublishingRequestDialog
          .getChangePublishToPath()
          .changeButton.click();
        await additionalShareUserSelectFolderManagerModalFoldersTree
          .folderByPath(publishFolder)
          .click();
        await additionalShareUserSelectFolderManagerModal.clickSelectFolderButton(
          { triggeredApiHost: API.publicationRulesList },
        );
        await additionalShareUserPublishingRulesAssertion.assertLabels({
          publishPath: publishFolder,
          allowAccessLabel: 'visible',
          availabilityLabel: 'hidden',
        });
        await additionalShareUserPublishingRulesAssertion.assertRule(
          {
            target: PublishingRulesFilterTarget.dialRoles,
            fnc: PublicationFunctions.Contain,
            values: [filterValue],
          },
          'visible',
          'visible',
          BooleanOperator.or,
        );
        await additionalShareUserPublishingRulesAssertion.assertElementState(
          additionalShareUserPublishingRules.addRuleButton,
          'visible',
        );
      },
    );
  },
);
