import { ToolsetTypes } from '@/chat/constants/quick-apps';
import { ApiTypeSchemaApplication } from '@/chat/types/applications';
import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import {
  QuickApp2Config,
  isCodeInterpreterToolset,
} from '@/chat/types/quick-apps';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  EntityEditorAppTypes,
  ExpectedConstants,
  MockedChatApiResponseBodies,
  UploadMenuOptions,
} from '@/src/testData';
import { GeneratorUtil } from '@/src/utils';

dialTest(
  "[Quick app 2.0] Only Model with the feature 'tools: true' can be set as Orchestrator\n" + // EPMRTC-7271
    "[Quick app 2.0] Temperature is not shown on App setting if 'temperature: false' and vice versa\n" + // EPMRTC-7092
    "[Quick app 2.0] 'Selected model does not support tools' error when the preselected model has no tools support", // EPMRTC-8558
  async ({
    marketplacePage,
    entityEditorPage,
    quickApp2EditorViewForm,
    talkToAgentDialog,
    customApplicationBuilder,
    quickApp2Builder,
    applicationApiHelper,
    modelApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7271', 'EPMRTC-7092', 'EPMRTC-8558');
    const excludedAppName = GeneratorUtil.randomApplicationName();
    const quickAppName = GeneratorUtil.randomApplicationName();
    let modelNoTemperature: DialAIEntityModel;
    let modelWithTemperature: DialAIEntityModel;
    let toolsUnsupportedModel: DialAIEntityModel;

    await dialTest.step(
      'Precondition: create a custom app, pick models by feature flags and a Quick app 2.0 with a non-tools orchestrator',
      async () => {
        await applicationApiHelper.createApplication(
          customApplicationBuilder.withDisplayName(excludedAppName).build(),
        );
        const allEntities = await modelApiHelper.getModels();
        const toolModels = allEntities.filter(
          (entity) =>
            entity.type === EntityType.Model && entity.features?.tools,
        );
        modelNoTemperature = toolModels.find(
          (entity) => !entity.features?.temperature,
        )!;
        modelWithTemperature = toolModels.find(
          (entity) => entity.features?.temperature,
        )!;
        toolsUnsupportedModel = allEntities.find(
          (entity) =>
            entity.type === EntityType.Model && !entity.features?.tools,
        )!;
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolsUnsupportedModel.id)
            .build(),
        );
      },
    );

    await dialTest.step(
      'Open the Quick app 2.0 in edit mode: the non-tools orchestrator shows the error',
      async () => {
        const quickApp = await modelApiHelper.getAgentByNameAndVersion({
          name: quickAppName,
        });
        await marketplacePage.openEditQuickApp2Page(quickApp.reference);
        await entityEditorPage.waitForPageLoadedForEdit(
          EntityEditorAppTypes.QuickApp2,
        );
        await baseAssertion.assertElementText(
          quickApp2EditorViewForm.orchestratorModelError,
          ExpectedConstants.selectedModelDoesNotSupportToolsError,
        );
      },
    );

    await dialTest.step(
      'Open the model picker and verify only tool-supporting models are listed',
      async () => {
        await quickApp2EditorViewForm.changeModelButton.click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'visible');
        await talkToAgentDialog.marketplaceTab.click();

        // A tool-supporting model is available to pick
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(modelNoTemperature.name);
        await baseAssertion.assertElementState(
          talkToAgentDialog.getEntityByName(modelNoTemperature.name),
          'visible',
        );

        // Neither a custom application nor a model without the tools feature is offered
        for (const excludedName of [
          excludedAppName,
          toolsUnsupportedModel.name,
        ]) {
          await talkToAgentDialog
            .getSearch()
            .inputField.fillInInput(excludedName);
          await baseAssertion.assertElementState(
            talkToAgentDialog.getEntityByName(excludedName),
            'hidden',
          );
          await baseAssertion.assertElementState(
            talkToAgentDialog.noResultsFound,
            'visible',
          );
        }
      },
    );

    await dialTest.step(
      'Select the tool-supporting model without temperature: the error clears and the temperature slider is hidden',
      async () => {
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(modelNoTemperature.name);
        await talkToAgentDialog
          .getEntityByName(modelNoTemperature.name)
          .click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'hidden');
        await baseAssertion.assertElementInnerText(
          quickApp2EditorViewForm.orchestratorModelName,
          [modelNoTemperature.name],
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.orchestratorModelError,
          'hidden',
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.temperatureSlider,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Switch to a temperature-capable model and verify the temperature slider is shown',
      async () => {
        await quickApp2EditorViewForm.changeModelButton.click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'visible');
        await talkToAgentDialog.marketplaceTab.click();
        await talkToAgentDialog
          .getSearch()
          .inputField.fillInInput(modelWithTemperature.name);
        await talkToAgentDialog
          .getEntityByName(modelWithTemperature.name)
          .click();
        await baseAssertion.assertElementState(talkToAgentDialog, 'hidden');
        await baseAssertion.assertElementInnerText(
          quickApp2EditorViewForm.orchestratorModelName,
          [modelWithTemperature.name],
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.temperatureSlider,
          'visible',
        );
      },
    );
  },
);

dialTest(
  'Code Interpreter text and hint\n' + // EPMRTC-7283
    '[Quick app 2.0] Support of Code Interpreter tool_set in Quick App 2 editor\n' + // EPMRTC-7018
    '[Quick app 2.0] Instruction is auto-saved if there is some response in Preview', // EPMRTC-8152
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorHeader,
    quickApp2EditorViewForm,
    tooltipPortal,
    dialHomePage,
    sendMessage,
    chatMessages,
    chatMessagesAssertion,
    quickApp2Builder,
    applicationApiHelper,
    modelApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-7283', 'EPMRTC-7018', 'EPMRTC-8152');
    const quickAppName = GeneratorUtil.randomApplicationName();
    const instructions = GeneratorUtil.randomString(15);
    const updatedInstructions = GeneratorUtil.randomString(20);

    await dialTest.step(
      'Precondition: create a Quick app 2.0 via API with a tool-supporting orchestrator model',
      async () => {
        const allEntities = await modelApiHelper.getModels();
        const toolSupportingModel = allEntities.find(
          (entity) =>
            entity.type === EntityType.Model && entity.features?.tools,
        )!;
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolSupportingModel.id)
            .build(),
        );
      },
    );

    await dialTest.step('Open the Quick app 2.0 in edit mode', async () => {
      const quickApp = await modelApiHelper.getAgentByNameAndVersion({
        name: quickAppName,
      });
      await marketplacePage.openEditQuickApp2Page(quickApp.reference);
      await entityEditorPage.waitForPageLoadedForEdit(
        EntityEditorAppTypes.QuickApp2,
      );
    });

    await dialTest.step(
      'Verify the Code Interpreter label and helper text',
      async () => {
        await baseAssertion.assertElementText(
          quickApp2EditorViewForm.codeInterpreterLabel,
          ExpectedConstants.codeInterpreterFieldLabel,
        );
        await baseAssertion.assertElementContainsText(
          quickApp2EditorViewForm.codeInterpreterField,
          ExpectedConstants.codeInterpreterAdditionalText,
        );
      },
    );

    await dialTest.step(
      'Hover the info icon and verify the Code Interpreter hint tooltip',
      async () => {
        await quickApp2EditorViewForm.codeInterpreterInfoIcon.hoverOver();
        await baseAssertion.assertElementText(
          tooltipPortal,
          ExpectedConstants.codeInterpreterInfoTooltip,
        );
      },
    );

    await dialTest.step(
      'Toggle Code Interpreter on and verify it is saved as a predefined py_interpreter toolset',
      async () => {
        const { responses } =
          await entityEditorPage.waitForExpectedResponses(async () => {
            await quickApp2EditorViewForm.codeInterpreterToggle.click();
            await entityEditorHeader.focusOn();
          }, [{ apiMethod: 'PUT', urlPattern: API.applicationCreateHost }]);
        const config = (
          responses[0].request().postDataJSON() as ApiTypeSchemaApplication
        ).application_properties as unknown as QuickApp2Config;
        const codeInterpreterToolset = config.tool_sets.find(
          isCodeInterpreterToolset,
        );
        baseAssertion.assertValueMatchObject(codeInterpreterToolset, {
          type: ToolsetTypes.CodeInterpreter,
          template_name: ExpectedConstants.codeInterpreterTemplateName,
        });
      },
    );

    await dialTest.step(
      'Send a message in the preview so a response exists (mocked)',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await sendMessage.messageInput.fillInInput(
          GeneratorUtil.randomString(10),
        );
        await sendMessage.sendMessageButton.click();
        await chatMessages.getChatMessage(2).waitFor();
        await chatMessagesAssertion.assertMessageContent(2, 'Response');
      },
    );

    await dialTest.step(
      'Type instructions: they are autosaved once the mouse leaves the form',
      async () => {
        // Autosave fires on the form's mouse-leave
        await entityEditorPage.waitForExpectedResponses(async () => {
          await quickApp2EditorViewForm.instructionsInput.fillInInput(
            instructions,
          );
          await quickApp2EditorViewForm.instructionsInput.hoverOver();
          await entityEditorHeader.focusOn();
        }, [{ apiMethod: 'PUT', urlPattern: API.applicationCreateHost }]);
      },
    );

    await dialTest.step(
      'Update the instructions again and verify the autosave',
      async () => {
        await entityEditorPage.waitForExpectedResponses(async () => {
          await quickApp2EditorViewForm.instructionsInput.fillInInput(
            updatedInstructions,
          );
          await quickApp2EditorViewForm.instructionsInput.hoverOver();
          await entityEditorHeader.focusOn();
        }, [{ apiMethod: 'PUT', urlPattern: API.applicationCreateHost }]);
      },
    );

    await dialTest.step(
      'Switch to General info and back to App settings: the instructions persist',
      async () => {
        await entityEditorHeader.goOnGeneralInfoStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await entityEditorHeader.goToEntitySettingsStepWithHeaderStepper({
          isHttpMethodTriggered: false,
        });
        await baseAssertion.assertInputValue(
          quickApp2EditorViewForm.instructionsInput,
          updatedInstructions,
        );
      },
    );
  },
);

dialTest(
  '[Quick app 2.0] Attachments section is collapsed by default\n' + // EPMRTC-8649
    '[Quick app 2.0] Attachment types and Max attachments number are available', // EPMRTC-7268
  async ({
    marketplacePage,
    entityEditorPage,
    entityEditorHeader,
    quickApp2EditorViewForm,
    sendMessage,
    attachmentDropdownMenu,
    fileManagerModal,
    quickApp2Builder,
    applicationApiHelper,
    modelApiHelper,
    baseAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-8649', 'EPMRTC-7268');
    const quickAppName = GeneratorUtil.randomApplicationName();
    const maxAttachments = 2;

    await dialTest.step(
      'Precondition: create a Quick app 2.0 via API with a tool-supporting orchestrator model',
      async () => {
        const allEntities = await modelApiHelper.getModels();
        const toolSupportingModel = allEntities.find(
          (entity) =>
            entity.type === EntityType.Model && entity.features?.tools,
        )!;
        await applicationApiHelper.createApplication(
          quickApp2Builder
            .withDisplayName(quickAppName)
            .withOrchestratorModel(toolSupportingModel.id)
            .build(),
        );
      },
    );

    await dialTest.step('Open the Quick app 2.0 in edit mode', async () => {
      const quickApp = await modelApiHelper.getAgentByNameAndVersion({
        name: quickAppName,
      });
      await marketplacePage.openEditQuickApp2Page(quickApp.reference);
      await entityEditorPage.waitForPageLoadedForEdit(
        EntityEditorAppTypes.QuickApp2,
      );
    });

    await dialTest.step(
      'Verify the Attachments section is collapsed by default',
      async () => {
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.attachmentTypesField,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Expand the section and set attachment types and max attachments',
      async () => {
        await quickApp2EditorViewForm.setAttachments(
          [ExpectedConstants.pdfAttachmentType],
          `${maxAttachments}`,
        );
        await baseAssertion.assertElementState(
          quickApp2EditorViewForm.attachmentTypesField,
          'visible',
        );
      },
    );

    await dialTest.step(
      'The attachment clip appears in the preview message box',
      async () => {
        // Attachment config autosaves on the form's mouse-leave; move the cursor
        // out to the header so the preview picks up the new config.
        await entityEditorPage.waitForExpectedResponses(async () => {
          await quickApp2EditorViewForm.attachmentsSection.hoverOver();
          await entityEditorHeader.focusOn();
        }, [{ apiMethod: 'PUT', urlPattern: API.applicationCreateHost }]);
        await baseAssertion.assertElementState(
          sendMessage.attachmentMenuTrigger,
          'visible',
        );
      },
    );

    await dialTest.step(
      'Open the attach files form and verify the supported types and max number',
      async () => {
        await sendMessage.attachmentMenuTrigger.click();
        await attachmentDropdownMenu.selectMenuOption(
          UploadMenuOptions.attachUploadedFiles,
        );
        await baseAssertion.assertElementState(fileManagerModal, 'visible');
        await baseAssertion.assertElementContainsText(
          fileManagerModal,
          ExpectedConstants.attachmentsSupportedTypesLabel,
        );
        await baseAssertion.assertElementContainsText(
          fileManagerModal,
          ExpectedConstants.attachmentsUpToFiles(maxAttachments),
        );
      },
    );
  },
);
