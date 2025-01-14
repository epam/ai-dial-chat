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
    'Isolated view: model is added to My workspace automatically it to send a message',
  async ({
    page,
    dialHomePage,
    agentInfo,
    chat,
    agentInfoAssertion,
    setTestIds,
    fileApiHelper,
    sendMessage,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-4864', 'EPMRTC-4885');
    let nonWorkspaceModel: DialAIEntityModel;
    let installedDeployments: { id: string }[];
    let models: DialAIEntityModel[];

    await dialTest.step(
      'prepare a model that is not added  to the users workspace',
      async () => {
        models = ModelsUtil.getModels();
        const randomModels = GeneratorUtil.randomArrayElements(models, 5);
        installedDeployments = randomModels.map((model) => ({
          id: model.id,
        }));
        const installedDeploymentsJson = JSON.stringify(installedDeployments);
        await fileApiHelper.putStringAsFile(
          'installed_deployments.json',
          JSON.stringify(installedDeploymentsJson),
          'clientdata',
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
      },
    );

    await dialTest.step(
      'Open isolated view for a non-workspace model in incognito page',
      async () => {
        await dialHomePage.navigateToUrl(
          ExpectedConstants.isolatedUrl(nonWorkspaceModel.id),
        );
      },
    );

    await dialTest.step(
      'Check that the model used in the isolated view is not added to the recent models and then update recent models to match the installed_deployments.json',
      async () => {
        const recentModels = await localStorageManager.getRecentModels();
        const parsedRecentModels: string[] = JSON.parse(recentModels || '[]');

        expect
          .soft(
            parsedRecentModels.some(
              (modelId) => modelId === nonWorkspaceModel.id,
            ),
            ExpectedMessages.recentEntitiesVisible,
          )
          .toBeFalsy();

        const recentModelsToAdd = installedDeployments
          .map((deployment) =>
            models.find((model) => model.id === deployment.id),
          )
          .filter((model) => model !== undefined) as DialAIEntityModel[];

        await localStorageManager.setRecentModelsIds(...recentModelsToAdd);
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
  },
);
