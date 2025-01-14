import { EntityType } from '@/chat/types/common';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { DialHomePage } from '@/src/ui/pages';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';
import { Serializable } from 'playwright-core/types/structs';

dialTest(
  'Isolated view: new conversation is opened based on exact model set in URL.\n' +
    'Isolated view: application description is shown on the first screen.\n' +
    'Isolated view: new conversation is opened based on exact model with spec chars in id.\n' +
    'Isolated view: available features in conversation',
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
    setTestIds('EPMRTC-2962', 'EPMRTC-2974', 'EPMRTC-2973', 'EPMRTC-2965');
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
        await chatHeader.openConversationSettings.waitForState({
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

dialTest.only(
  'Isolated view: message input field is always available for user. There is no "Add the agent to My workspace to continue"\n' +
    'Isolated view: model is added to My workspace automatically it to send a message\n' +
    "Isolated view: Change agent doesn't exist on the first screen, not clickable in header, specific tooltip",
  async ({
    dialHomePage,
    agentInfo,
    chat,
    agentInfoAssertion,
    setTestIds,
    fileApiHelper,
    sendMessage,
    localStorageManager,
    chatHeader,
    talkToAgentDialog,
    tooltip,
  }) => {
    setTestIds('EPMRTC-4864', 'EPMRTC-4885', 'EPMRTC-4824');
    let nonWorkspaceModel: DialAIEntityModel;
    let installedDeployments: { id: string }[];
    let models: DialAIEntityModel[];

    await dialTest.step(
      'prepare a model that is not added to the users workspace',
      async () => {
        models = ModelsUtil.getModels();

        let randomModels = GeneratorUtil.randomArrayElements(
          models.filter((model) => model.id !== 'mirror'),
          5,
        );
        installedDeployments = randomModels.map((model) => ({
          id: model.id,
        }));
        const installedDeploymentsJson = JSON.stringify(installedDeployments);
        await fileApiHelper.putStringAsFile(
          'installed_deployments.json',
          installedDeploymentsJson,
          'clientdata',
        );

        //TODO that is a workaround to make script work even though the mocking of the response freezes DIAL
        nonWorkspaceModel = {
          id: 'mirror',
          name: 'Echo',
        } as DialAIEntityModel;
        // nonWorkspaceModel = GeneratorUtil.randomArrayElement(
        //   models.filter((model) => {
        //     const isNotInstalled = !installedDeployments.some(
        //       (deployment) => deployment.id === model.id,
        //     );
        //     const hasNoColon = !model.id.includes(':');
        //     return isNotInstalled && hasNoColon;
        //   }),
        // );

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
        await agentInfoAssertion.assertElementText(
          agentInfo.agentName,
          nonWorkspaceModel.name,
        );
      },
    );

    await dialTest.step(
      'Verify input field is visible and enabled, "Add agent" button is not visible',
      async () => {
        await expect
          .soft(
            sendMessage.messageInput.getElementLocator(),
            ExpectedMessages.elementIsVisible,
          )
          .toBeVisible();
        await expect
          .soft(
            sendMessage.messageInput.getElementLocator(),
            ExpectedMessages.elementIsEnabled,
          )
          .toBeEnabled();
        await expect
          .soft(
            chat.addModelButton.getElementLocator(),
            ExpectedMessages.elementIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Verify "Change agent" link is not visible',
      async () => {
        await expect
          .soft(
            chat.changeAgentButton.getElementLocator(),
            ExpectedMessages.elementIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Check that the model used in the isolated view is not added to the installed_deployments.json',
      async () => {
        const installedDeploymentsResponse = await fileApiHelper.getFile(
          API.installedDeploymentsHost,
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

    await dialTest.step('Send new request to the model', async () => {
      // await dialHomePage.mockChatTextResponse(
      //   MockedChatApiResponseBodies.simpleTextBody,
      // );
      await chat.sendRequestWithButton('test request');
    });

    await dialTest.step(
      'Click on the model icon and verify model change is not available',
      async () => {
        await chatHeader.chatModelIcon.click({ force: true });
        await expect
          .soft(
            talkToAgentDialog.getElementLocator(),
            ExpectedMessages.elementIsNotVisible,
          )
          .toBeHidden();
      },
    );

    await dialTest.step(
      'Hover over the model icon and check the tooltip',
      async () => {
        await chatHeader.chatModelIcon.hoverOver();
        const tooltipContent = await tooltip.getContent();

        const expectedTooltipText = `Current agent:\nAgent:\n${nonWorkspaceModel.name}${nonWorkspaceModel.version ? `\nVersion:\n${nonWorkspaceModel.version}` : ''}`;

        expect
          .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
          .toBe(expectedTooltipText);
      },
    );

    await dialTest.step(
      'Reload the page and verify that the model was added to the users workspace',
      async () => {
        await dialHomePage.reloadPage();
        await dialHomePage.waitForPageLoaded({ skipSidebars: true });
        const installedDeploymentsResponse = await fileApiHelper.getFile(
          API.installedDeploymentsHost,
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
      },
    );
  },
);
