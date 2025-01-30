import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  AccountMenuOptions,
  Attachment,
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
  Rate,
  UploadMenuOptions,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Isolated view: new conversation is opened based on exact model set in URL.\n' +
    'Isolated view: application description is shown on the first screen.\n' +
    'Isolated view: new conversation is opened based on exact model with spec chars in id.\n' +
    'Isolated view: if to refresh or re-login the new chat is created, so, history is not stored in isolated view, though you can find the chat in main DIAL',
  async ({
    dialHomePage,
    agentInfo,
    iconApiHelper,
    chat,
    chatBar,
    promptBar,
    chatHeader,
    chatMessages,
    modelInfoTooltip,
    agentInfoAssertion,
    localStorageManager,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2962', 'EPMRTC-2974', 'EPMRTC-2973', 'EPMRTC-4891');
    const expectedModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getModels().filter((m) => m.iconUrl !== undefined),
    )!;
    const expectedModelName = expectedModel.name;
    const expectedModelIcon = iconApiHelper.getEntityIcon(expectedModel);
    const request = '1+2';

    await dialTest.step(
      'Open isolated view for a model and verify model name, description and icon are displayed',
      async () => {
        await localStorageManager.setRecentModelsIds(expectedModel);
        await dialHomePage.navigateToUrl(
          ExpectedConstants.isolatedUrl(expectedModel.id),
        );
        await agentInfoAssertion.assertElementText(
          agentInfo.agentName,
          expectedModelName,
        );

        const modelDescription = await agentInfo.getAgentDescription();
        //only short description is displayed for isolated models
        const expectedShortDescription =
          expectedModel.description?.split(/\s*\n\s*\n\s*/g)[0];
        expect
          .soft(modelDescription, ExpectedMessages.agentDescriptionIsValid)
          .toBe(expectedShortDescription);

        await agentInfoAssertion.assertAgentIcon(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Send request to model and verify response is generated, no side panels and conversation settings are available',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(request);
        await chatBar.waitForState({ state: 'hidden' });
        await promptBar.waitForState({ state: 'hidden' });
        await chatHeader.conversationSettings.waitForState({
          state: 'visible',
        });
      },
    );

    await dialTest.step(
      'Verify chat request controls are visible, hint is shown on hover conversation icon in the header',
      async () => {
        await chatMessages.waitForEditMessageIcon(request);
        await chatMessages.messageDeleteIcon(request).waitFor();
        await chatHeader.clearConversation.waitForState();
        await chatHeader.hoverOverChatModel();

        const modelInfo = await modelInfoTooltip.getModelInfo();
        expect
          .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(expectedModelName);
        const modelVersionInfo = await modelInfoTooltip.getVersionInfo();
        expect
          .soft(modelVersionInfo, ExpectedMessages.chatInfoVersionIsValid)
          .toBe(expectedModel.version);
      },
    );
  },
);

dialTest(
  'Isolated view: available features in conversation',
  async ({
    dialHomePage,
    iconApiHelper,
    chat,
    chatHeader,
    chatMessages,
    localStorageManager,
    setTestIds,
    fileApiHelper,
    attachmentDropdownMenu,
    sendMessage,
    attachFilesModal,
    chatHeaderAssertion,
    chatMessagesAssertion,
    footerAssertion,
    baseAssertion,
    tooltipAssertion,
  }) => {
    setTestIds('EPMRTC-2965');
    const attachmentName = Attachment.sunImageName;
    const expectedModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModelsWithAttachment(),
    )!;
    const testMessage = 'Test message with attachment';

    await dialTest.step('Prepare attachment', async () => {
      await fileApiHelper.putFile(attachmentName);
    });

    await dialTest.step('Open isolated view for the model', async () => {
      await localStorageManager.setRecentModelsIds(expectedModel);
      await dialHomePage.navigateToUrl(
        ExpectedConstants.isolatedUrl(expectedModel.id),
      );
      await dialHomePage.waitForPageLoaded({ skipSidebars: true });
    });

    await dialTest.step('Attach file and send message', async () => {
      await sendMessage.attachmentMenuTrigger.click();
      await attachmentDropdownMenu.selectMenuOption(
        UploadMenuOptions.attachUploadedFiles,
      );
      await attachFilesModal.checkAttachedFile(attachmentName);
      await attachFilesModal.attachFiles();
      await sendMessage.messageInput.typeInInput(testMessage);
      await dialHomePage.mockChatTextResponse(
        MockedChatApiResponseBodies.simpleTextBody,
      );
      await chat.sendRequestWithButton(testMessage);
    });

    await dialTest.step(
      'Hover over on model icon near the user-message -> the tooltip with model and version appears',
      async () => {
        await (await chatMessages.getMessageIcon(2)).hover();
        await tooltipAssertion.assertTooltipContent(
          expectedModel.version !== undefined
            ? `${expectedModel.name}\nv. ${expectedModel.version}`
            : `${expectedModel.name}`,
        );
      },
    );

    await dialTest.step('Check elements in the Chat header', async () => {
      await chatHeaderAssertion.assertHeaderTitle(testMessage);
      await chatHeaderAssertion.assertHeaderIcon(
        iconApiHelper.getEntityIcon(expectedModel),
      );
      await chatHeaderAssertion.assertClearButtonState('visible');
      await chatHeaderAssertion.assertElementState(
        chatHeader.dotsMenu,
        'hidden',
      );
    });

    await dialTest.step('Check user-message actions', async () => {
      await chatMessagesAssertion.assertMessageEditIconState(1, 'visible');
      await chatMessagesAssertion.assertMessageDeleteIconState(1, 'visible');
      await chatMessagesAssertion.assertSetMessageTemplateIconState(
        1,
        'hidden',
      );
    });

    await dialTest.step('Check model-response actions', async () => {
      await chatMessagesAssertion.assertElementState(
        chatMessages.messageCopyIcon(2),
        'visible',
      );
      await chatMessagesAssertion.assertElementState(
        chatMessages.messageRegenerateIcon(2),
        'visible',
      );
      for (const rate of Object.values(Rate)) {
        await baseAssertion.assertElementState(
          chatMessages.getChatMessageRate(2, rate),
          'visible',
        );
      }
    });

    await dialTest.step('Check footer', async () => {
      await footerAssertion.assertFooterState('visible');
    });
  },
);

dialTest(
  'Isolate view: error message appears if URL is based on non-existed model id',
  async ({ dialHomePage, chatNotFound, setTestIds }) => {
    setTestIds('EPMRTC-2963');

    await dialTest.step(
      'Open isolated view for a model that does not exist and verify error toast is shown',
      async () => {
        await dialHomePage.navigateToUrl(ExpectedConstants.isolatedUrl('test'));
        await chatNotFound.waitForState();
        expect
          .soft(
            await chatNotFound.getChatNotFoundContent(),
            ExpectedMessages.entityNameIsValid,
          )
          .toBe(ExpectedConstants.modelNotFountErrorMessage);
      },
    );
  },
);

dialTest(
  'Isolated view: message input field is always available for user. There is no "Add the agent to My workspace to continue"\n' +
    'Isolated view: model is added to My workspace automatically it to send a message\n' +
    "Isolated view: Change agent doesn't exist on the first screen, not clickable in header, specific tooltip\n" +
    'Isolated view: Configure settings is available on the first screen and in header, specific tooltip\n' +
    'Isolated view: dial header features',
  async ({
    dialHomePage,
    agentInfo,
    chat,
    agentInfoAssertion,
    setTestIds,
    fileApiHelper,
    localStorageManager,
    chatHeader,
    talkToAgentDialog,
    conversationSettingsModal,
    accountSettings,
    accountDropdownMenuAssertion,
    accountDropdownMenu,
    settingsModal,
    header,
    chatBar,
    promptBar,
    chatAssertion,
    sendMessageAssertion,
    chatMessagesAssertion,
    baseAssertion,
    conversationAssertion,
    tooltip,
    tooltipAssertion,
  }) => {
    setTestIds(
      'EPMRTC-4864',
      'EPMRTC-4885',
      'EPMRTC-4824',
      'EPMRTC-4888',
      'EPMRTC-4889',
    );
    let nonWorkspaceModel: DialAIEntityModel;
    let installedDeployments: { id: string }[];
    let models: DialAIEntityModel[];
    let chatName: string;

    await dialTest.step(
      'prepare a model that is not added to the users workspace',
      async () => {
        models = ModelsUtil.getModels();

        const randomModels = GeneratorUtil.randomArrayElements(models, 5);
        installedDeployments = randomModels.map((model) => ({
          id: model.id,
        }));
        const installedDeploymentsJson = JSON.stringify(installedDeployments);
        await fileApiHelper.putStringAsFile(
          API.installedDeploymentsFile,
          installedDeploymentsJson,
          API.installedDeploymentsFolder,
        );

        nonWorkspaceModel = GeneratorUtil.randomArrayElement(
          models.filter((model) => {
            const isNotInstalled = !installedDeployments.some(
              (deployment) => deployment.id === model.id,
            );
            const hasNoColon = !model.id.includes(':');
            return isNotInstalled && hasNoColon;
          }),
        );

        const recentModelsToAdd = installedDeployments
          .map((deployment) =>
            models.find((model) => model.id === deployment.id),
          )
          .filter((model) => model !== undefined) as DialAIEntityModel[];

        await localStorageManager.setRecentModelsIdsOnce(...recentModelsToAdd);
      },
    );

    await dialTest.step(
      'Open isolated view for a non-workspace model and check that the correct model is displayed',
      async () => {
        await dialHomePage.navigateToUrl(
          ExpectedConstants.isolatedUrl(nonWorkspaceModel.id),
        );
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        await agentInfoAssertion.assertElementText(
          agentInfo.agentName,
          nonWorkspaceModel.name,
        );
      },
    );

    await dialTest.step(
      'Verify input field is visible and enabled, "Add agent" button is not visible',
      async () => {
        await sendMessageAssertion.assertInputFieldState('visible', 'enabled');
        await chatAssertion.assertAddAgentButtonState('hidden');
        await chatAssertion.assertChangeAgentLinkState('hidden');
      },
    );

    await dialTest.step(
      'Check that the model used in the isolated view is not added to the installed_deployments.json',
      async () => {
        const installedDeploymentsResponse = await fileApiHelper.getFile(
          API.installedDeploymentsHost(),
        );
        const installedDeployments =
          (await installedDeploymentsResponse.json()) as { id: string }[];
        const recentModels = await localStorageManager.getRecentModels();
        const parsedRecentModels: string[] = JSON.parse(recentModels || '[]'); // Provide default empty array
        expect
          .soft(
            installedDeployments.some(
              (deployment) => deployment.id === nonWorkspaceModel.id,
            ),
            ExpectedMessages.modelIsAvailable,
          )
          .toBeFalsy();
        expect
          .soft(
            parsedRecentModels.some(
              (modelId) => modelId === nonWorkspaceModel.id,
            ),
            ExpectedMessages.recentEntitiesVisible,
          )
          .toBeFalsy();
      },
    );

    await dialTest.step(
      'Click "Configure settings" link before sending request',
      async () => {
        await chat.configureSettingsButton.click();
        await baseAssertion.assertElementState(
          conversationSettingsModal,
          'visible',
        );
        await conversationSettingsModal.cancelButton.click(); // Close the modal
      },
    );

    await dialTest.step(
      'Click on user logo before sending a request',
      async () => {
        await accountSettings.openAccountDropdownMenu();
        await accountDropdownMenuAssertion.assertMenuIncludesOptions(
          AccountMenuOptions.settings,
          AccountMenuOptions.logout,
        );
        await accountDropdownMenu.selectMenuOption(AccountMenuOptions.settings);
        await baseAssertion.assertElementState(settingsModal, 'visible');
        await baseAssertion.assertElementState(settingsModal.theme, 'visible');
        await baseAssertion.assertElementState(
          settingsModal.fullWidthChatToggle,
          'visible',
        );
        await baseAssertion.assertElementState(
          settingsModal.customLogo,
          'visible',
        );
        await settingsModal.saveButton.click();
      },
    );

    await dialTest.step('Send new request to the model', async () => {
      await dialHomePage.mockChatTextResponse(
        MockedChatApiResponseBodies.simpleTextBody,
      );
      await chat.sendRequestWithButton('test request');
      chatName = await chatHeader.chatTitle.getElementInnerContent();
    });

    await dialTest.step(
      'Click on the Settings icon after sending the request',
      async () => {
        await chatHeader.conversationSettings.click();
        await baseAssertion.assertElementState(
          conversationSettingsModal.getElementLocator(),
          'visible',
          ExpectedMessages.conversationSettingsVisible,
        );
        await conversationSettingsModal.cancelButton.click();
      },
    );

    await dialTest.step(
      'Hover over the Setting icon and check the wording on the tooltip',
      async () => {
        await chatHeader.conversationSettings.hoverOver();
        const tooltipContent = await tooltip.getContent();
        expect
          .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
          .toMatch(
            new RegExp(
              `^${ExpectedConstants.settingsTooltip(nonWorkspaceModel.type)}`,
            ),
          );
      },
    );

    await dialTest.step(
      'Click on the model icon and verify model change is not available',
      async () => {
        // eslint-disable-next-line playwright/no-force-option
        await chatHeader.chatModelIcon.click({ force: true });
        await baseAssertion.assertElementState(
          talkToAgentDialog.getElementLocator(),
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Hover over the model icon and check the tooltip',
      async () => {
        await chatHeader.chatModelIcon.hoverOver();
        const expectedTooltipText = `Current agent:\nAgent:\n${nonWorkspaceModel.name}${nonWorkspaceModel.version ? `\nVersion:\n${nonWorkspaceModel.version}` : ''}`;
        await tooltipAssertion.assertTooltipContent(expectedTooltipText);
      },
    );

    await dialTest.step(
      'Reload the page and verify that the model was added to the users workspace and the chat history is empty',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        const installedDeploymentsResponse = await fileApiHelper.getFile(
          API.installedDeploymentsHost(),
        );
        const installedDeployments =
          (await installedDeploymentsResponse.json()) as { id: string }[];
        const recentModels = await localStorageManager.getRecentModels();
        const parsedRecentModels: string[] = JSON.parse(recentModels || '[]'); // Provide default empty array
        expect
          .soft(
            installedDeployments.some(
              (deployment) => deployment.id === nonWorkspaceModel.id,
            ),
            ExpectedMessages.modelIsAvailable,
          )
          .toBeTruthy();
        expect
          .soft(
            parsedRecentModels.some(
              (modelId) => modelId === nonWorkspaceModel.id,
            ),
            ExpectedMessages.modelIsAvailable,
          )
          .toBeTruthy();
        await chatMessagesAssertion.assertMessagesCount(0);
      },
    );

    await dialTest.step(
      'Click on the logo after sending the request',
      async () => {
        await header.logo.click();
        await chatBar.waitForState({ state: 'hidden' });
        await promptBar.waitForState({ state: 'hidden' });
        await sendMessageAssertion.assertInputFieldState('visible', 'enabled');
        await chatAssertion.assertAddAgentButtonState('hidden');
        await chatAssertion.assertChangeAgentLinkState('hidden');
      },
    );

    await dialTest.step(
      'Reload into regular Dial and verify conversation exists',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversationAssertion.assertEntityState(
          { name: chatName },
          'visible',
        );
      },
    );
  },
);
