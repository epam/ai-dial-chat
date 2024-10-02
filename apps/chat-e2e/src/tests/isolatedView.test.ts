import { DEFAULT_TEMPERATURE } from '@/chat/constants/default-ui-settings';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedConstants, ExpectedMessages, ModelIds } from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

dialTest(
  'Isolated view: new conversation is opened based on exact model set in URL.\n' +
    'Isolated view: application description is shown on the first screen.\n' +
    'Isolated view: new conversation is opened based on exact model with spec chars in id.\n' +
    'Isolated view: available features in conversation',
  async ({
    dialHomePage,
    isolatedView,
    iconApiHelper,
    chat,
    chatBar,
    promptBar,
    chatHeader,
    chatMessages,
    chatInfoTooltip,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-2962', 'EPMRTC-2974', 'EPMRTC-2973', 'EPMRTC-2965');
    const expectedModel = ModelsUtil.getModel(ModelIds.ANTHROPIC_CLAUDE)!;
    const expectedModelName = expectedModel.name;
    const expectedModelIcon = await iconApiHelper.getEntityIcon(expectedModel);
    const request = '1+2';

    await dialTest.step(
      'Open isolated view for a model and verify model name, description and icon are displayed',
      async () => {
        await dialHomePage.navigateToUrl(
          ExpectedConstants.isolatedUrl(expectedModel.id),
        );
        await isolatedView.waitForState();
        const modelName = await isolatedView.getEntityName();
        expect
          .soft(modelName, ExpectedMessages.entityNameIsValid)
          .toBe(expectedModelName);

        const modelDescription = await isolatedView.getEntityDescription();
        expect
          .soft(modelDescription, ExpectedMessages.entityDescriptionIsValid)
          .toBe(expectedModel.description);

        const modelIcon = await isolatedView.getEntityIcon();
        expect
          .soft(modelIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedModelIcon);
      },
    );

    await dialTest.step(
      'Send request to model and verify response is generated, no side panels and conversation settings are available',
      async () => {
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

        const modelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(expectedModelName);
        const modelVersionInfo = await chatInfoTooltip.getVersionInfo();
        expect
          .soft(modelVersionInfo, ExpectedMessages.chatInfoVersionIsValid)
          .toBe(expectedModel.version);

        const modelInfoIcon = await chatInfoTooltip.getModelIcon();
        expect
          .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
          .toBe(expectedModelIcon);

        const tempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(DEFAULT_TEMPERATURE.toString());
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
