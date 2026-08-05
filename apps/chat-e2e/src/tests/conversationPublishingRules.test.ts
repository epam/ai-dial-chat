import { BackendResourceType } from '@/chat/types/common';
import {
  Publication,
  PublicationFunctions,
  PublicationRequestModel,
} from '@/chat/types/publication';
import { getFilterLabel } from '@/chat/utils/app/rules';
import { PublicationApiAssertion } from '@/src/assertions/api/publicationApiAssertion';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  BooleanOperator,
  E2EUserRole,
  ExpectedConstants,
  MenuOptions,
  PublishingRulesFilterTarget,
} from '@/src/testData';
import { Attributes } from '@/src/ui/domData';
import { GeneratorUtil } from '@/src/utils';
import { Conversation, PublishActions } from '@epam/ai-dial-shared';

let organizationFolderName: string;
let conversationToPublish: Conversation;
let setupPublication: Publication;

dialTest.beforeEach(
  'Test setup step',
  async ({
    conversationData,
    dataInjector,
    publishRequestBuilder,
    publicationApiHelper,
    adminPublicationApiHelper,
  }) => {
    await dialTest.step(
      'Publish a simple conversation in Organization folder via API',
      async () => {
        organizationFolderName = GeneratorUtil.randomString(10);
        const conversation = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversation]);
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withTargetFolder(organizationFolderName)
          .withConversationInFolderResource(conversation, PublishActions.ADD)
          .build();
        setupPublication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(setupPublication);
      },
    );

    await dialTest.step(
      'Prepare a new conversation to publish via API',
      async () => {
        conversationToPublish = conversationData.prepareDefaultConversation();
        await dataInjector.createConversations([conversationToPublish]);
      },
    );
  },
);

dialAdminTest(
  'Publish chat: filter - contains',
  async ({
    dialHomePage,
    publicationApiAssertion,
    additionalShareUserPublicationApiAssertion,
    additionalSecondShareUserPublicationApiAssertion,
    conversations,
    conversationDropdownMenu,
    publishingRequestDialog,
    selectFolderManagerModal,
    selectFolderManagerModalFoldersTree,
    publishingRules,
    publishingFilter,
    publishingRulesAssertion,
    setTestIds,
    localStorageManager,
    adminDialHomePage,
    adminLocalStorageManager,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationApiHelper,
    adminPublishingRulesAssertion,
    adminPublishingApprovalModalAssertion,
    adminApproveRequiredConversationsAssertion,
  }) => {
    setTestIds('EPMDIAL-3453');
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const filterValue = 'age';
    let publishRequestResponse: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialTest.step(
      'Open Publishing modal for created conversation, click on "Change path", select available folder and verify rules functionality is enabled',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversationToPublish.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestDialog
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderManagerModalFoldersTree
          .folderByPath(organizationFolderName)
          .click();
        await selectFolderManagerModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await publishingRulesAssertion.assertLabels({
          publishPath: organizationFolderName,
          allowAccessLabel: 'visible',
          availabilityLabel: 'hidden',
        });
        await publishingRulesAssertion.assertElementState(
          publishingRules.rulesList,
          'visible',
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.addRuleButton,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Click on "Plus" btn and verify filter with params is displayed',
      async () => {
        await publishingRules.addRuleButton.click();
        await publishingRulesAssertion.assertFilterFields({
          filterTargetState: 'visible',
          filterTargetValue: ExpectedConstants.publishingFilterDefaultValue,
          filterFunctionState: 'visible',
          filterFunctionValue: PublicationFunctions.Contain,
          filterValues: [],
          saveButtonState: 'visible',
          cancelButtonState: 'visible',
        });
        await publishingRulesAssertion.assertElementAttribute(
          publishingFilter.filterValueInput,
          Attributes.placeholder,
          ExpectedConstants.publishingFilterValuePlaceholder,
        );
      },
    );

    await dialTest.step(
      'Set filter condition to: `Dial Roles` Contain `age`',
      async () => {
        await publishingFilter
          .getFilterTargetDropdownMenu()
          .selectMenuOption(PublishingRulesFilterTarget.dialRoles);
        await publishingFilter.filterFunction.click();
        await publishingFilter
          .getFilterFunctionDropdownMenu()
          .selectMenuOption(getFilterLabel(PublicationFunctions.Contain));
        await publishingFilter.setFilterValue(filterValue);
        await publishingRulesAssertion.assertFilterFields({
          filterTargetState: 'visible',
          filterTargetValue: PublishingRulesFilterTarget.dialRoles,
          filterFunctionState: 'visible',
          filterFunctionValue: getFilterLabel(PublicationFunctions.Contain),
          filterValues: [filterValue],
        });
        await publishingFilter.saveFilterButton.click();
        await publishingRulesAssertion.assertRule(
          {
            target: PublishingRulesFilterTarget.dialRoles,
            fnc: PublicationFunctions.Contain,
            values: [filterValue],
          },
          'visible',
          'visible',
          BooleanOperator.or,
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.addRuleButton,
          'visible',
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.cancelAllRules,
          'visible',
        );
      },
    );

    await dialTest.step('Submit publication request', async () => {
      await publishingRequestDialog.requestName.fillInInput(requestName);
      publishRequestResponse =
        await publishingRequestDialog.sendPublicationRequest();
    });

    await dialAdminTest.step(
      'Open the request by admin user and verify the rule is displayed',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingRulesAssertion.assertLabels({
          publishPath: organizationFolderName,
          allowAccessLabel: 'visible',
          availabilityLabel: 'hidden',
          noChangesLabel: 'hidden',
          seeChangesButton: 'visible',
        });
        await adminPublishingRulesAssertion.assertRule(
          {
            target: PublishingRulesFilterTarget.dialRoles,
            fnc: PublicationFunctions.Contain,
            values: [filterValue],
          },
          'visible',
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Approve the request by admin user via API',
      async () => {
        await adminPublicationApiHelper.approveRequest(
          publishRequestResponse.response,
        );
      },
    );

    await dialTest.step(
      'Verify published conversation is available only for users with Dial roles "Manager" and "Developer+Manager"',
      async () => {
        await verifyPublishedConversationAvailability(
          publishRequestResponse.request,
          publicationApiAssertion,
          additionalShareUserPublicationApiAssertion,
          additionalSecondShareUserPublicationApiAssertion,
          {
            isPublishedForMainUser: false,
            isPublishedForAdditionalUser: true,
            isPublishedForSecondAdditionalUser: true,
          },
        );
      },
    );
  },
);

dialTest(
  'Publish chat : filter - equals (one filter value).\n' +
    'Filters for functions Contains and Equals are case insensitive',
  async ({
    adminPublicationApiHelper,
    publicationApiAssertion,
    additionalShareUserPublicationApiAssertion,
    additionalSecondShareUserPublicationApiAssertion,
    publishRequestBuilder,
    publicationApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-3460', 'EPMDIAL-3473');
    const filterValue = E2EUserRole.qa.toLowerCase();
    let publication: Publication;

    await dialTest.step(
      'Publish the conversation via API applying the rule: `Dial Roles` Equal `qa`',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withTargetFolder(organizationFolderName)
          .withConversationInFolderResource(
            conversationToPublish,
            PublishActions.ADD,
          )
          .withRule({
            source: ExpectedConstants.dialRolesField,
            function: PublicationFunctions.Equal,
            targets: [filterValue],
          })
          .build();
        publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step(
      'Verify published conversation is available only for users with Dial role "QA"',
      async () => {
        await verifyPublishedConversationAvailability(
          publication,
          publicationApiAssertion,
          additionalShareUserPublicationApiAssertion,
          additionalSecondShareUserPublicationApiAssertion,
          {
            isPublishedForMainUser: true,
            isPublishedForAdditionalUser: false,
            isPublishedForSecondAdditionalUser: false,
          },
        );
      },
    );
  },
);

dialAdminTest(
  'Publish chat: combination of values inside one filter work as OR',
  async ({
    dialHomePage,
    publicationApiAssertion,
    additionalShareUserPublicationApiAssertion,
    additionalSecondShareUserPublicationApiAssertion,
    conversations,
    conversationDropdownMenu,
    publishingRequestDialog,
    selectFolderManagerModal,
    selectFolderManagerModalFoldersTree,
    publishingRules,
    publishingFilter,
    publishingRulesAssertion,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredConversationsAssertion,
    adminApproveRequiredConversations,
    adminPublishingApprovalModalAssertion,
    adminPublishingApprovalModal,
    adminPublishingRulesAssertion,
    adminPublicationApiHelper,
  }) => {
    setTestIds('EPMDIAL-3461');
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const firstFilterValue = E2EUserRole.developer.toLowerCase();
    const secondFilterValue = E2EUserRole.manager.toLowerCase();
    let publishRequestResponse: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialTest.step(
      'Open Publishing modal for created conversation and set filter condition to: `Dial Roles` Contain `developer` or `manager`',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversationToPublish.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestDialog
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderManagerModalFoldersTree
          .folderByPath(organizationFolderName)
          .click();
        await selectFolderManagerModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await publishingRules.addRuleButton.click();
        await publishingFilter
          .getFilterTargetDropdownMenu()
          .selectMenuOption(PublishingRulesFilterTarget.dialRoles);
        await publishingFilter.filterFunction.click();
        await publishingFilter
          .getFilterFunctionDropdownMenu()
          .selectMenuOption(getFilterLabel(PublicationFunctions.Contain));
        await publishingFilter.setFilterValue(firstFilterValue);
        await publishingFilter.setFilterValue(secondFilterValue);
        await publishingRulesAssertion.assertFilterFields({
          filterTargetState: 'visible',
          filterTargetValue: PublishingRulesFilterTarget.dialRoles,
          filterFunctionState: 'visible',
          filterFunctionValue: getFilterLabel(PublicationFunctions.Contain),
          filterValues: [firstFilterValue, secondFilterValue],
        });
      },
    );

    await dialTest.step(
      'Save the filter and verify it is displayed with inner `or` operator',
      async () => {
        await publishingFilter.saveFilterButton.click();
        await publishingRulesAssertion.assertRule(
          {
            target: PublishingRulesFilterTarget.dialRoles,
            fnc: PublicationFunctions.Contain,
            values: [firstFilterValue, secondFilterValue],
          },
          'visible',
          'visible',
          BooleanOperator.or,
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.addRuleButton,
          'visible',
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.cancelAllRules,
          'visible',
        );
      },
    );

    await dialTest.step('Submit publication request', async () => {
      await publishingRequestDialog.requestName.fillInInput(requestName);
      publishRequestResponse =
        await publishingRequestDialog.sendPublicationRequest();
    });

    await dialAdminTest.step(
      'Open the request by admin user and verify the rule is displayed',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingRulesAssertion.assertLabels({
          publishPath: organizationFolderName,
          allowAccessLabel: 'visible',
          availabilityLabel: 'hidden',
          noChangesLabel: 'hidden',
          seeChangesButton: 'visible',
        });
        await adminPublishingRulesAssertion.assertRule(
          {
            target: PublishingRulesFilterTarget.dialRoles,
            fnc: PublicationFunctions.Contain,
            values: [firstFilterValue, secondFilterValue],
          },
          'visible',
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Approve the request by admin user via API',
      async () => {
        await adminPublicationApiHelper.approveRequest(
          publishRequestResponse.response,
        );
      },
    );

    await dialTest.step(
      'Verify published conversation is available only for users with Dial roles "Manager" and "Developer+Manager"',
      async () => {
        await verifyPublishedConversationAvailability(
          publishRequestResponse.request,
          publicationApiAssertion,
          additionalShareUserPublicationApiAssertion,
          additionalSecondShareUserPublicationApiAssertion,
          {
            isPublishedForMainUser: false,
            isPublishedForAdditionalUser: true,
            isPublishedForSecondAdditionalUser: true,
          },
        );
      },
    );
  },
);

dialAdminTest(
  'Publish chat: combination of filters work as OR',
  async ({
    dialHomePage,
    adminPublicationApiHelper,
    publicationApiAssertion,
    additionalShareUserPublicationApiAssertion,
    additionalSecondShareUserPublicationApiAssertion,
    conversations,
    conversationDropdownMenu,
    publishingRequestDialog,
    selectFolderManagerModal,
    selectFolderManagerModalFoldersTree,
    publishingRules,
    publishingFilter,
    publishingRulesAssertion,
    setTestIds,
    localStorageManager,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredConversationsAssertion,
    adminApproveRequiredConversations,
    adminPublishingApprovalModalAssertion,
    adminPublishingApprovalModal,
    adminPublishingRulesAssertion,
  }) => {
    setTestIds('EPMDIAL-3462');
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const firstFilterValue = E2EUserRole.qa.toLowerCase();
    const secondFilterValue = 'any value';
    let publishRequestResponse: {
      request: PublicationRequestModel;
      response: Publication;
    };
    const conditions = {
      [PublishingRulesFilterTarget.dialRoles]: firstFilterValue,
      [PublishingRulesFilterTarget.title]: secondFilterValue,
    };
    const conditionsEntries = Object.entries(conditions);

    await dialTest.step(
      'Open Publishing modal for created conversation, click on "Change path", select available folder and verify rules functionality is enabled',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(conversationToPublish.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.publish);
        await publishingRequestDialog
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderManagerModalFoldersTree
          .folderByPath(organizationFolderName)
          .click();
        await selectFolderManagerModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
      },
    );

    await dialTest.step(
      'Add two filters with the conditions: `Dial Roles` Contain `qa`, `Title` Contain `any value`',
      async () => {
        for (const [target, value] of conditionsEntries) {
          await publishingRules.addRuleButton.click();
          await publishingFilter
            .getFilterTargetDropdownMenu()
            .selectMenuOption(target);
          await publishingFilter.filterFunction.click();
          await publishingFilter
            .getFilterFunctionDropdownMenu()
            .selectMenuOption(getFilterLabel(PublicationFunctions.Contain));
          await publishingFilter.setFilterValue(value);
          await publishingFilter.saveFilterButton.click();
          await publishingRulesAssertion.assertRule(
            {
              target: target as PublishingRulesFilterTarget,
              fnc: PublicationFunctions.Contain,
              values: [value],
            },
            'visible',
            'visible',
            BooleanOperator.or,
          );
        }
        await publishingRulesAssertion.assertElementsCount(
          publishingRules.allRules,
          conditionsEntries.length,
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.addRuleButton,
          'visible',
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.cancelAllRules,
          'visible',
        );
      },
    );

    await dialTest.step('Submit publication request', async () => {
      await publishingRequestDialog.requestName.fillInInput(requestName);
      publishRequestResponse =
        await publishingRequestDialog.sendPublicationRequest();
    });

    await dialAdminTest.step(
      'Open the request by admin user and verify the rules are displayed',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingRulesAssertion.assertLabels({
          publishPath: organizationFolderName,
          allowAccessLabel: 'visible',
          availabilityLabel: 'hidden',
          noChangesLabel: 'hidden',
          seeChangesButton: 'visible',
        });
        for (let i = 0; i < conditionsEntries.length; i++) {
          const [target, value] = conditionsEntries[i];
          await adminPublishingRulesAssertion.assertRule(
            {
              target: target as PublishingRulesFilterTarget,
              fnc: PublicationFunctions.Contain,
              values: [value],
            },
            'visible',
            'hidden',
            i === conditionsEntries.length - 1 ? undefined : BooleanOperator.or,
          );
        }
      },
    );

    await dialAdminTest.step(
      'Approve the request by admin user via API',
      async () => {
        await adminPublicationApiHelper.approveRequest(
          publishRequestResponse.response,
        );
      },
    );

    await dialTest.step(
      'Verify published conversation is available only for user with Dial role "QA"',
      async () => {
        await verifyPublishedConversationAvailability(
          publishRequestResponse.request,
          publicationApiAssertion,
          additionalShareUserPublicationApiAssertion,
          additionalSecondShareUserPublicationApiAssertion,
          {
            isPublishedForMainUser: true,
            isPublishedForAdditionalUser: false,
            isPublishedForSecondAdditionalUser: false,
          },
        );
      },
    );
  },
);

dialTest(
  'Publish chat : filter - equals ( two filter values)',
  async ({
    adminPublicationApiHelper,
    publicationApiAssertion,
    additionalShareUserPublicationApiAssertion,
    additionalSecondShareUserPublicationApiAssertion,
    publishRequestBuilder,
    publicationApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-3465');
    const firstFilterValue = E2EUserRole.manager;
    const secondFilterValue = 'test';
    let publication: Publication;

    await dialTest.step(
      'Publish the conversation via API applying the rule: `Dial Roles` Equal `qa`',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withTargetFolder(organizationFolderName)
          .withConversationInFolderResource(
            conversationToPublish,
            PublishActions.ADD,
          )
          .withRule({
            source: ExpectedConstants.dialRolesField,
            function: PublicationFunctions.Equal,
            targets: [firstFilterValue],
          })
          .withRule({
            source: ExpectedConstants.dialRolesField,
            function: PublicationFunctions.Equal,
            targets: [secondFilterValue],
          })
          .build();
        publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step(
      'Verify published conversation is available only for all users with Dial roles "Manager" and "Developer, Manager"',
      async () => {
        await verifyPublishedConversationAvailability(
          publication,
          publicationApiAssertion,
          additionalShareUserPublicationApiAssertion,
          additionalSecondShareUserPublicationApiAssertion,
          {
            isPublishedForMainUser: false,
            isPublishedForAdditionalUser: true,
            isPublishedForSecondAdditionalUser: true,
          },
        );
      },
    );
  },
);

dialAdminTest(
  'Unpublish chat from folder and apply filters',
  async ({
    publishRequestBuilder,
    publicationApiHelper,
    dialHomePage,
    publicationApiAssertion,
    additionalShareUserPublicationApiAssertion,
    additionalSecondShareUserPublicationApiAssertion,
    organizationFolderConversations,
    publishingRequestDialogAssertion,
    conversationDropdownMenu,
    publishingRequestDialog,
    publishingRules,
    publishingFilter,
    publishingRulesAssertion,
    setTestIds,
    localStorageManager,
    adminDialHomePage,
    adminLocalStorageManager,
    adminApproveRequiredConversations,
    adminPublishingApprovalModal,
    adminPublicationApiHelper,
    adminPublishingRulesAssertion,
    adminPublishingApprovalModalAssertion,
    adminApproveRequiredConversationsAssertion,
  }) => {
    setTestIds('EPMDIAL-3184');
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const filterValue = E2EUserRole.qa;
    let unpublishRequestResponse: {
      request: PublicationRequestModel;
      response: Publication;
    };

    await dialTest.step(
      'Publish one more conversation in Organization folder via API',
      async () => {
        const publishRequest = publishRequestBuilder
          .withName(GeneratorUtil.randomPublicationRequestName())
          .withTargetFolder(organizationFolderName)
          .withConversationInFolderResource(
            conversationToPublish,
            PublishActions.ADD,
          )
          .build();
        const publication =
          await publicationApiHelper.createPublishRequest(publishRequest);
        await adminPublicationApiHelper.approveRequest(publication);
      },
    );

    await dialTest.step(
      'Open Unpublishing modal for the conversation inside Organization folder',
      async () => {
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await organizationFolderConversations.expandFolder(
          organizationFolderName,
        );
        await organizationFolderConversations.openFolderEntityDropdownMenu(
          organizationFolderName,
          conversationToPublish.name,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.unpublish);
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await publishingRulesAssertion.assertLabels({
          publishPath: organizationFolderName,
          allowAccessLabel: 'visible',
          availabilityLabel: 'hidden',
          noChangesLabel: 'hidden',
          seeChangesButton: 'hidden',
        });
      },
    );

    await dialTest.step(
      'Set filter condition to: `Dial Roles` Equal `QA`',
      async () => {
        await publishingRules.addRuleButton.click();
        await publishingFilter
          .getFilterTargetDropdownMenu()
          .selectMenuOption(PublishingRulesFilterTarget.dialRoles);
        await publishingFilter.filterFunction.click();
        await publishingFilter
          .getFilterFunctionDropdownMenu()
          .selectMenuOption(getFilterLabel(PublicationFunctions.Equal));
        await publishingFilter.setFilterValue(filterValue);
        await publishingRulesAssertion.assertFilterFields({
          filterTargetState: 'visible',
          filterTargetValue: PublishingRulesFilterTarget.dialRoles,
          filterFunctionState: 'visible',
          filterFunctionValue: getFilterLabel(PublicationFunctions.Equal),
          filterValues: [filterValue],
        });
        await publishingFilter.saveFilterButton.click();
        await publishingRulesAssertion.assertRule(
          {
            target: PublishingRulesFilterTarget.dialRoles,
            fnc: PublicationFunctions.Equal,
            values: [filterValue],
          },
          'visible',
          'visible',
          BooleanOperator.or,
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.addRuleButton,
          'visible',
        );
        await publishingRulesAssertion.assertElementState(
          publishingRules.cancelAllRules,
          'visible',
        );
      },
    );

    await dialTest.step('Submit unpublish request', async () => {
      await publishingRequestDialog.requestName.fillInInput(requestName);
      unpublishRequestResponse =
        await publishingRequestDialog.sendPublicationRequest();
    });

    await dialAdminTest.step(
      'Open the request by admin user and verify the rule is displayed',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredConversationsAssertion.assertFolderState(
          { name: requestName },
          'visible',
        );
        await adminApproveRequiredConversations.expandApproveRequiredFolder(
          requestName,
        );
        await adminPublishingApprovalModalAssertion.assertElementState(
          adminPublishingApprovalModal,
          'visible',
        );
        await adminPublishingRulesAssertion.assertLabels({
          publishPath: organizationFolderName,
          allowAccessLabel: 'visible',
          availabilityLabel: 'hidden',
          noChangesLabel: 'hidden',
          seeChangesButton: 'visible',
        });
        await adminPublishingRulesAssertion.assertRule(
          {
            target: PublishingRulesFilterTarget.dialRoles,
            fnc: PublicationFunctions.Equal,
            values: [filterValue],
          },
          'visible',
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Approve the request by admin user via API',
      async () => {
        await adminPublicationApiHelper.approveRequest(
          unpublishRequestResponse.response,
        );
      },
    );

    await dialTest.step(
      'Verify Organization folder with not unpublished conversation is available only for the user with Dial role "QA"',
      async () => {
        await verifyPublishedConversationAvailability(
          setupPublication,
          publicationApiAssertion,
          additionalShareUserPublicationApiAssertion,
          additionalSecondShareUserPublicationApiAssertion,
          {
            isPublishedForMainUser: true,
            isPublishedForAdditionalUser: false,
            isPublishedForSecondAdditionalUser: false,
          },
        );

        await verifyPublishedConversationAvailability(
          unpublishRequestResponse.request,
          publicationApiAssertion,
          additionalShareUserPublicationApiAssertion,
          additionalSecondShareUserPublicationApiAssertion,
          {
            isPublishedForMainUser: false,
            isPublishedForAdditionalUser: false,
            isPublishedForSecondAdditionalUser: false,
          },
        );
      },
    );
  },
);

async function verifyPublishedConversationAvailability(
  publication: Publication | PublicationRequestModel,
  publicationApiAssertion: PublicationApiAssertion,
  additionalShareUserPublicationApiAssertion: PublicationApiAssertion,
  additionalSecondShareUserPublicationApiAssertion: PublicationApiAssertion,
  expectedResults: {
    isPublishedForMainUser: boolean;
    isPublishedForAdditionalUser: boolean;
    isPublishedForSecondAdditionalUser: boolean;
  },
) {
  const publishedConversationUrl = publication.resources![0].targetUrl;
  await publicationApiAssertion.assertPublishedResourceAvailability(
    BackendResourceType.CONVERSATION,
    publishedConversationUrl,
    expectedResults.isPublishedForMainUser,
  );
  await additionalShareUserPublicationApiAssertion.assertPublishedResourceAvailability(
    BackendResourceType.CONVERSATION,
    publishedConversationUrl,
    expectedResults.isPublishedForAdditionalUser,
  );
  await additionalSecondShareUserPublicationApiAssertion.assertPublishedResourceAvailability(
    BackendResourceType.CONVERSATION,
    publishedConversationUrl,
    expectedResults.isPublishedForSecondAdditionalUser,
  );
}
