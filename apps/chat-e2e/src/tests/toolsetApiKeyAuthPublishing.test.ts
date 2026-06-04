import dialAdminTest from '@/src/core/dialAdminFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  ApiKeyMockHelper,
  CheckboxState,
  EntityEditorToolsetTypes,
  ExpectedConstants,
  MenuOptions,
  OAuthOptions,
} from '@/src/testData';
import { BaseElement } from '@/src/ui/webElements';
import { GeneratorUtil } from '@/src/utils';
import { Toolset } from '@epam/ai-dial-shared';

dialAdminTest(
  'Create publish request toolset with API key (without creds).\n' +
    'Create publish request toolset with API key (with creds)',
  async ({
    marketplacePage,
    marketplaceHeader,
    marketplaceEntitiesSection,
    marketplaceEntities,
    entityEditorPage,
    toolsetLoginModal,
    toolsetEditorViewForm,
    toolsetLoginModalAssertion,
    entityEditorHeader,
    toolsetBuilder,
    setTestIds,
    publishingRequestDialog,
    publishingRequestDialogAssertion,
    toolsetToPublishAssertion,
    toolsetsToPublishTree,
    toast,
    toastAssertion,
    adminLocalStorageManager,
    adminDialHomePage,
    adminApproveRequiredPrompts,
    adminToolsetToApproveAssertion,
    toolsetApiHelper,
    page,
  }) => {
    setTestIds('EPMRTC-9026', 'EPMRTC-9027');
    const toolsetEntity = {
      name: GeneratorUtil.randomToolsetName(),
      version: GeneratorUtil.randomEntityVersion(),
      endpoint: GeneratorUtil.randomUrl(),
      apiKey: GeneratorUtil.randomString(7),
    };
    let apiKeyMockHelper: ApiKeyMockHelper;
    let initialToolset: Toolset;
    const firstRequestName = GeneratorUtil.randomPublicationRequestName();
    const secondRequestName = GeneratorUtil.randomPublicationRequestName();
    const thirdRequestName = GeneratorUtil.randomPublicationRequestName();
    let toolsetElement: BaseElement;

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
      'Open Edit the toolset page by main user, select API Key without login authentication option and save the toolset',
      async () => {
        await marketplacePage.openEditToolsetPage(initialToolset.reference!);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorToolsetTypes.Toolset,
        );
        await toolsetEditorViewForm.apiKeyContainer.click();
        await toolsetEditorViewForm
          .oAuthOptionRadioButton(OAuthOptions.WithoutLogin)
          .click();
        await toolsetEditorViewForm.apiKeyParameterNameFieldInput.fillInInput(
          GeneratorUtil.randomString(5),
        );
        await entityEditorHeader.saveAndExitButton.click();
        await marketplacePage.waitForPageLoaded();
      },
    );

    await dialTest.step('Setup ApiKey mocks', async () => {
      apiKeyMockHelper = new ApiKeyMockHelper(
        page,
        initialToolset,
        toolsetEntity.endpoint,
      );
      await apiKeyMockHelper.setupMocks();
      apiKeyMockHelper.enableMocking();
    });

    await dialAdminTest.step(
      `Find the toolset and select "Publish" option from card's dots menu`,
      async () => {
        await marketplaceHeader
          .getSearch()
          .inputField.fillInInput(toolsetEntity.name);
        toolsetElement = await marketplaceEntitiesSection.findEntityElement(
          toolsetEntity.name,
        );
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.publish);
      },
    );

    await dialAdminTest.step(
      'Verify Publish request modal is opened for the toolset, Credentials are not visible',
      async () => {
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'visible',
        );
        await toolsetToPublishAssertion.assertEntityToPublish(
          { name: toolsetEntity.name },
          {
            expectedState: 'visible',
            expectedCheckboxState: CheckboxState.checked,
            expectedVersion: toolsetEntity.version,
          },
        );
        await toolsetToPublishAssertion.assertToolsetCredentials({
          expectedState: 'hidden',
        });
      },
    );

    await dialAdminTest.step(
      'Send the request and verify successful toast is shown',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(firstRequestName);
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
      'Login as admin and verify toolset publishing request without credentials is available is under "Approve required" section',
      async () => {
        await adminLocalStorageManager.setShowSideBarPanels();
        await adminDialHomePage.openHomePage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(firstRequestName);
        await adminToolsetToApproveAssertion.assertToolsetCredentials({
          expectedState: 'hidden',
        });
      },
    );

    await dialAdminTest.step(
      `Login the toolset from card's dots menu`,
      async () => {
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.login);
        await toolsetLoginModal.apiKeyMaskedFieldInput.fillInInput(
          toolsetEntity.apiKey,
        );
        await toolsetLoginModal.loginButton.click();
        await toolsetLoginModalAssertion.assertElementState(
          toolsetLoginModal,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      `Create publication request for the logged-in toolset and verify Credentials checkbox unchecked`,
      async () => {
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.publish);
        await toolsetToPublishAssertion.assertToolsetCredentials({
          expectedState: 'visible',
          expectedCheckboxState: CheckboxState.unchecked,
        });
      },
    );

    await dialAdminTest.step(
      'Send the request and verify successful toast is shown',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(
          secondRequestName,
        );
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
      'Login as admin and verify toolset publishing request without credentials is displayed under "Approve required"',
      async () => {
        await adminDialHomePage.reloadPage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(secondRequestName);
        await adminToolsetToApproveAssertion.assertToolsetCredentials({
          expectedState: 'hidden',
        });
      },
    );

    await dialAdminTest.step(
      `Create publication request for the logged-in toolset with checked Credentials`,
      async () => {
        await toolsetElement.hoverOver();
        await marketplaceEntities
          .getEntityElementDotsMenu(toolsetElement)
          .click();
        await marketplaceEntities
          .getEntityDropdownMenu()
          .selectMenuOption(MenuOptions.publish);
      },
    );

    await dialAdminTest.step(
      'Send the request and verify successful toast is shown',
      async () => {
        await publishingRequestDialog.requestName.fillInInput(thirdRequestName);
        await toolsetsToPublishTree.credentialsCheckbox.click();
        await publishingRequestDialog.sendPublicationRequest();
        await publishingRequestDialogAssertion.assertElementState(
          publishingRequestDialog,
          'hidden',
        );
      },
    );

    await dialAdminTest.step(
      'Login as admin and verify toolset publishing request with credentials is displayed under "Approve required"',
      async () => {
        await adminDialHomePage.reloadPage();
        await adminDialHomePage.waitForPageLoaded();
        await adminApproveRequiredPrompts.selectRequest(thirdRequestName);
        await adminToolsetToApproveAssertion.assertToolsetCredentials({
          expectedState: 'visible',
          expectedCheckboxState: CheckboxState.checked,
        });
      },
    );
  },
);
