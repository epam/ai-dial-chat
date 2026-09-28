import { ORCHESTRATOR_ATTACHMENT_STRATEGY_VALUE } from '@/chat/constants/quick-apps';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  Attachment,
  EntityEditorAppTypes,
  ExpectedConstants,
  ToggleState,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

let modelNoAttachments: DialAIEntityModel;
let modelAllAttachments: DialAIEntityModel;
let modelSpecificAttachments: DialAIEntityModel;

dialTest.beforeAll(async () => {
  modelNoAttachments = GeneratorUtil.randomArrayElement(
    ModelsUtil.getModelsWithoutAttachment().filter((m) => m.features?.tools),
  );
  modelAllAttachments = GeneratorUtil.randomArrayElement(
    ModelsUtil.getLatestModelsWithAttachment(false, ['*/*']).filter(
      (m) => m.features?.tools,
    ),
  );
  modelSpecificAttachments = GeneratorUtil.randomArrayElement(
    ModelsUtil.getLatestModelsWithAttachment(false, ['image/*']).filter(
      (m) => m.features?.tools,
    ),
  );
});

dialTest(
  `[Quick app 2.0] Process files and "Allow orchestrator to process files" toggle is shown if orchestrator is allowed to work with attachments and vice versa`,
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    talkToAgentDialog,
    tooltipAssertion,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4787');

    await dialTest.step(
      'Open Quick app 2.0 creation page directly',
      async () => {
        await marketplacePage.openCreateQuickApp2Page();
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: GeneratorUtil.randomApplicationName(),
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Open the model picker, select the model that does not support attachments and verify "Allow orchestrator to process files" toggle is not shown',
      async () => {
        await quickApp2EditorViewForm.changeModelButton.click();
        await talkToAgentDialog.marketplaceTab.click();
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(modelNoAttachments.name as string);
        await talkToAgentDialog
          .getEntityByName(modelNoAttachments.name as string)
          .click();
        await baseAssertion.assertElementInnerText(
          quickApp2EditorViewForm.orchestratorModelName,
          [modelNoAttachments.name as string],
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.processFilesToggleContainer,
          'hidden',
        );
      },
    );

    for (const model of [modelAllAttachments, modelSpecificAttachments]) {
      await dialTest.step(
        `Open the model picker, select the ${model} that supports attachments and verify "Allow orchestrator to process files" toggle is OFF`,
        async () => {
          await quickApp2EditorViewForm.changeModelButton.click();
          await talkToAgentDialog.marketplaceTab.click();
          await talkToAgentDialog
            .getSearch()
            .inputField.fillInInput(model.name as string);
          await talkToAgentDialog.getEntityByName(model.name as string).click();
          await baseAssertion.assertElementInnerText(
            quickApp2EditorViewForm.orchestratorModelName,
            [model.name as string],
          );
          await baseAssertion.assertElementState(
            quickApp2EditorViewForm.processFilesToggleContainer,
            'visible',
          );
          await baseAssertion.assertElementText(
            quickApp2EditorViewForm.processFilesToggle,
            ToggleState.off,
          );
          await baseAssertion.assertElementText(
            quickApp2EditorViewForm.processFilesToggleLabel,
            ExpectedConstants.processFilesToggleLabel,
          );
          await baseAssertion.assertElementText(
            quickApp2EditorViewForm.processFilesLabel,
            ExpectedConstants.processFilesLabel,
          );
        },
      );

      await dialTest.step(
        'Hover over "Allow orchestrator to process files" toggle and verify tooltip is displayed',
        async () => {
          await quickApp2EditorViewForm.processFilesToggleInfoIcon.hoverOver();
          await tooltipAssertion.assertTooltipContent(
            ExpectedConstants.processFilesTooltip,
          );
        },
      );
    }
  },
);

dialTest(
  `[Quick app 2.0] 'Get context content' stage exists if model-orchestrator supports file format in context files. "Allow orchestrator to process files" toggle is On`,
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorGeneralForm,
    quickApp2EditorViewForm,
    entityEditorHeader,
    talkToAgentDialog,
    fileApiHelper,
    fileManagerModal,
    fileManagerModalGrid,
    entityDetailsModal,
    baseAssertion,
    dialHomePage,
    chat,
    chatMessages,
    chatMessagesAssertion,
    apiAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-4788');
    const imageUrl = await fileApiHelper.putFile(Attachment.flowerImageName);
    const messageIndex = 2;
    const messageStageIndex = 1;
    const expectedStageContent = `${Attachment.flowerImageName}\nGet content file:\nLoaded file "${Attachment.flowerImageName}" (image/jpeg) from file:url::${imageUrl}.`;
    const expectedContextType = 'file';

    await dialTest.step(
      'Open Quick app 2.0 creation page directly',
      async () => {
        await marketplacePage.openCreateQuickApp2Page();
        await entityEditorPage.waitForPageLoaded(
          EntityEditorAppTypes.QuickApp2,
        );
        await entityEditorGeneralForm.fillInEntityFields({
          name: GeneratorUtil.randomApplicationName(),
        });
        await entityEditorGeneralForm.goNext();
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
      },
    );

    await dialTest.step(
      'Open the model picker, select the model that supports attachments and set "Allow orchestrator to process files" toggle to ON',
      async () => {
        await quickApp2EditorViewForm.changeModelButton.click();
        await talkToAgentDialog.marketplaceTab.click();
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(modelAllAttachments.name as string);
        await talkToAgentDialog
          .getEntityByName(modelAllAttachments.name as string)
          .click();
        await baseAssertion.assertElementInnerText(
          quickApp2EditorViewForm.orchestratorModelName,
          [modelAllAttachments.name as string],
        );
        await quickApp2EditorViewForm.processFilesToggle.click();
      },
    );

    await dialTest.step('Add context file to app and save it', async () => {
      await quickApp2EditorViewForm.openFileManagerModal();
      const fileCheckbox = await fileManagerModalGrid.gridCheckboxByNameCell(
        Attachment.flowerImageName,
      );
      await fileCheckbox.click();
      await marketplacePage.waitForExpectedResponses(
        () => fileManagerModal.getSelectFilesButton().click(),
        [{ apiMethod: 'GET', urlPattern: API.folderFilesListingHost() }],
      );
      await quickApp2EditorViewForm
        .contextFileByName(Attachment.flowerImageName)
        .waitFor();
      await entityEditorHeader.saveAndExitButton.click();
      await marketplacePage.waitForPageLoaded();
      await entityDetailsModal.waitForState();
    });

    await dialTest.step(
      'Use created app and verify added context file is included in the stage',
      async () => {
        await entityDetailsModal.clickUseButton({
          isInstalledDeploymentsUpdated: false,
        });
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        const { completionRequest } = await chat.sendRequestWithButton(
          'what is on picture?',
        );

        const appProperties = completionRequest.model.applicationProperties;
        const appPropertiesContext = appProperties.contexts[0];
        apiAssertion.assertValue(
          appPropertiesContext.type,
          expectedContextType,
        );
        apiAssertion.assertValue(appPropertiesContext.url, imageUrl);
        apiAssertion.assertValue(
          appProperties.orchestrator.attachment_strategy.type,
          ORCHESTRATOR_ATTACHMENT_STRATEGY_VALUE?.type,
        );
        await chatMessages.openMessageStage(messageIndex, messageStageIndex);
        await chatMessagesAssertion.assertElementContainsText(
          chatMessages.messageStageContent(messageIndex, messageStageIndex),
          expectedStageContent,
        );
        await dialHomePage.waitForExpectedResponses(
          () =>
            chatMessages
              .messageStageAttachment(
                messageIndex,
                messageStageIndex,
                Attachment.flowerImageName,
              )
              .click(),
          [{ apiMethod: 'GET', urlPattern: Attachment.flowerImageName }],
        );
        await chatMessagesAssertion.assertElementState(
          chatMessages.getMessageStageAttachmentContent(
            messageIndex,
            messageStageIndex,
            Attachment.flowerImageName,
          ),
          'visible',
        );
      },
    );
  },
);
