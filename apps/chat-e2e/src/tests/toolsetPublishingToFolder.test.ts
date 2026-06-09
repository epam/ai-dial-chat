import { PublicationFunctions } from '@/chat/types/publication';
import { getFilterLabel } from '@/chat/utils/app/rules';
import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  PublishPath,
  PublishingRulesFilterTarget,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';
import { Toolset } from '@epam/ai-dial-shared';

dialAdminTest(
  'Toolset can be published to folder with applied rules',
  async ({
    marketplacePage,
    toolsetBuilder,
    setTestIds,
    selectFolderManagerModal,
    selectFolderManagerModalGrid,
    selectFolderManagerModalFoldersTree,
    publishingRequestDialog,
    publishingRequestDialogAssertion,
    publishingRules,
    publishingFilter,
    entityDetailsModal,
    toast,
    toastAssertion,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredPrompts,
    adminPublishingRulesAssertion,
    toolsetApiHelper,
  }) => {
    setTestIds('EPMRTC-7166');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
    };
    const requestName = GeneratorUtil.randomPublicationRequestName();
    const orgFolder = GeneratorUtil.randomString(5);
    const publicationPath = `${PublishPath.Organization}/${orgFolder}`;
    let initialToolset: Toolset;
    const roleValue = 'manager';

    await dialAdminTest.step(
      'Precondition: Create toolset via API',
      async () => {
        const toolsetModel = toolsetBuilder
          .withDisplayName(toolsetEntity.name)
          .withDisplayVersion(toolsetEntity.version)
          .withEndpoint(toolsetEntity.endpoint)
          .build();
        await toolsetApiHelper.createToolset(toolsetModel);
        initialToolset = (await toolsetApiHelper.getToolset(
          toolsetEntity.name,
          toolsetEntity.version,
        ))!;
      },
    );

    await dialAdminTest.step(
      `Open the toolset card and click on Publish btn`,
      async () => {
        await marketplacePage.openToolsetCardPage(initialToolset.reference!);
        await marketplacePage.waitForPageLoaded();
        await entityDetailsModal.publishButton.click();
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
      },
    );

    await dialAdminTest.step(
      'Create a new publication folder under Organization and select it',
      async () => {
        await publishingRequestDialog
          .getChangePublishToPath()
          .changeButton.click();
        await selectFolderManagerModal.getAddFolderButton().click();
        await selectFolderManagerModalGrid.setFolderName(orgFolder, false);
        await selectFolderManagerModalFoldersTree
          .folderByPath(orgFolder)
          .click();
        await selectFolderManagerModal.clickSelectFolderButton({
          triggeredApiHost: API.publicationRulesList,
        });
        await publishingRequestDialogAssertion.assertElementText(
          publishingRequestDialog.getChangePublishToPath().path,
          publicationPath,
        );
      },
    );

    await dialTest.step('Setup the rule condition', async () => {
      await publishingRules.addRuleButton.click();
      await publishingFilter
        .getFilterTargetDropdownMenu()
        .selectMenuOption(PublishingRulesFilterTarget.dialRoles);
      await publishingFilter.filterFunction.click();
      await publishingFilter
        .getFilterFunctionDropdownMenu()
        .selectMenuOption(getFilterLabel(PublicationFunctions.Contain));
      await publishingFilter.setFilterValue(roleValue);
      await publishingFilter.saveFilterButton.click();
    });

    await dialAdminTest.step(
      'Send the request and verify successful toast is shown',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(requestName);
        await publishingRequestDialog.sendPublicationRequest();
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
        await toastAssertion.assertToastMessage(
          ExpectedConstants.successfulPublishingMessage,
        );
        await toast.closeToast();
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify toolset publishing request to the folder is available is under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(requestName);

        await adminPublishingRulesAssertion.assertLabels({
          publishPath: orgFolder,
          allowAccessLabel: 'visible',
          availabilityLabel: 'hidden',
          noChangesLabel: 'hidden',
          seeChangesButton: 'visible',
        });
        await adminPublishingRulesAssertion.assertRule(
          {
            target: PublishingRulesFilterTarget.dialRoles,
            fnc: PublicationFunctions.Contain,
            values: [roleValue],
          },
          'visible',
          'hidden',
        );
      },
    );
  },
);
