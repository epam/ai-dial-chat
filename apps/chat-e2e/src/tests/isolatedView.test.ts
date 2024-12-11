import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

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
          state: 'hidden',
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
