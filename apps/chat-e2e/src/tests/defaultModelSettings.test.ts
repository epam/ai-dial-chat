import dialTest from '../core/dialFixtures';
import {
  DefaultModelReference,
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '../testData';
import { Cursors } from '../ui/domData';

import { DialAIEntityModel } from '@/chat/types/models';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
let nonDefaultModel: DialAIEntityModel;
let recentModelIds: string[];

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultAgent()!;
  nonDefaultModel = GeneratorUtil.randomArrayElement(
    ModelsUtil.getModels().filter((m) => m.id !== defaultModel.id),
  );
  recentModelIds = ModelsUtil.getRecentModelIds();
});

dialTest(
  'Create new conversation.\n' +
    'Default settings in new chat with cleared site data.\n' +
    'Clip icon in message box does not exist if chat is based on model which does not work with attachments',
  async ({
    dialHomePage,
    conversations,
    conversationSettingsModal,
    temperatureSlider,
    iconApiHelper,
    sendMessage,
    agentSettingAssertion,
    chat,
    talkToAgentDialog,
    talkToAgentDialogAssertion,
    talkToAgents,
    baseAssertion,
    localStorageManager,
    fileApiHelper,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-2796', 'EPMDIAL-5697', 'EPMDIAL-6462');
    let modelWithoutAttachments: DialAIEntityModel;

    await dialTest.step(
      'Verify default model is selected by default',
      async () => {
        modelWithoutAttachments = GeneratorUtil.randomArrayElement(
          ModelsUtil.getModelsWithoutAttachment().filter(
            (m) =>
              m.features?.temperature !== undefined &&
              m.features.temperature === true &&
              m.features.systemPrompt !== undefined &&
              m.features.systemPrompt === true,
          ),
        );
        await fileApiHelper.updateInstalledDeployments([
          modelWithoutAttachments,
        ]);
        await localStorageManager.setRecentModelsIdsOnceWithPermanentLastUsedModel(
          modelWithoutAttachments,
        );
        await localStorageManager.useLastConversationSettingsOnce();
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialogAssertion.assertAgentIsSelected(
          modelWithoutAttachments.name,
        );
      },
    );

    await dialTest.step(
      'Verify the list of recent entities and icons are displayed and valid',
      async () => {
        const recentTalkTo = await talkToAgents.getEntityNames();
        expect
          .soft(recentTalkTo, ExpectedMessages.recentEntitiesVisible)
          .toEqual([modelWithoutAttachments.name]);

        const recentAgentsIcons = await talkToAgents.getEntityIcons();
        expect
          .soft(recentAgentsIcons, ExpectedMessages.entitiesIconsCountIsValid)
          .toHaveLength(1);

        const expectedEntityIcon = iconApiHelper.getEntityIcon(
          modelWithoutAttachments,
        );
        await baseAssertion.assertEntityIcon(
          recentAgentsIcons[0].iconLocator,
          expectedEntityIcon,
        );
        await talkToAgentDialog.getCloseButton().click();
      },
    );

    await dialTest.step(
      'Verify default settings for default model',
      async () => {
        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertSystemPromptValue(
          ExpectedConstants.emptyString,
        );

        const defaultTemperature = await temperatureSlider.getTemperature();
        expect
          .soft(defaultTemperature, ExpectedMessages.defaultTemperatureIsOne)
          .toBe(ExpectedConstants.defaultTemperature);
      },
    );

    await dialTest.step(
      'Create new conversation and verify it is moved under Today section in chat bar, no clip icon is available in message textarea',
      async () => {
        await conversationSettingsModal.cancelButton.click();
        const newConversationName = GeneratorUtil.randomString(7);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(newConversationName);

        const todayConversations = await conversations.getTodayConversations();
        expect
          .soft(todayConversations, ExpectedMessages.newConversationCreated)
          .toHaveLength(1);
        expect
          .soft(todayConversations[0], ExpectedMessages.conversationOfToday)
          .toBe(newConversationName);
        await expect
          .soft(
            sendMessage.attachmentMenuTrigger.getElementLocator(),
            ExpectedMessages.clipIconNotAvailable,
          )
          .toBeHidden();
      },
    );
  },
);

dialTest(
  'Default model in new chat is set as in previous chat with model response.\n' +
    'Send button is disabled if the message box is empty.\n' +
    'Chat name is shown in chat header.\n' +
    `It's impossible to send a message with spaces only`,
  async ({
    dialHomePage,
    chatBar,
    agentInfo,
    agentInfoAssertion,
    chat,
    sendMessage,
    sendMessageAssertion,
    chatHeaderAssertion,
    chatMessages,
    chatMessagesAssertion,
    page,
    localStorageManager,
    talkToAgentDialog,
    talkToAgents,
    talkToAgentDialogAssertion,
    tooltipPortalAssertion,
    setTestIds,
  }) => {
    setTestIds('EPMDIAL-5809', 'EPMDIAL-5909', 'EPMDIAL-5932', 'EPMDIAL-5910');
    const request = 'test';
    await dialTest.step(
      'Verify Send button is disabled if no request message set and tooltip is shown on button hover',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          nonDefaultModel,
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await sendMessageAssertion.assertElementActionabilityState(
          sendMessage.sendMessageButton,
          'disabled',
          ExpectedMessages.sendMessageButtonDisabled,
        );
        await sendMessage.sendMessageButton.hoverOver();
        await tooltipPortalAssertion.assertTooltipContent(
          ExpectedConstants.sendMessageTooltip,
        );
      },
    );

    await dialTest.step(
      'Set spaces in the message input and Send button is disabled, tooltip is shown on hover, no message send on hit Enter',
      async () => {
        for (let i = 1; i <= 2; i++) {
          if (i === 2) {
            const messagesCountBefore =
              await chatMessages.chatMessages.getElementsCount();
            await sendMessage.messageInput.fillInInput('   ');
            await page.keyboard.press(keys.enter);
            const messagesCountAfter =
              await chatMessages.chatMessages.getElementsCount();
            chatMessagesAssertion.assertBooleanCondition(
              messagesCountBefore === messagesCountAfter,
              true,
              ExpectedMessages.messageCountIsCorrect,
            );
          }
          await sendMessageAssertion.assertElementActionabilityState(
            sendMessage.sendMessageButton,
            'disabled',
            ExpectedMessages.sendMessageButtonDisabled,
          );

          await sendMessage.sendMessageButton.hoverOver();
          await sendMessageAssertion.assertElementCursor(
            sendMessage.sendMessageButton,
            Cursors.notAllowed,
          );
          await tooltipPortalAssertion.assertTooltipContent(
            ExpectedConstants.sendMessageTooltip,
          );
        }
      },
    );

    await dialTest.step(
      'Send new request and verify it is reflected in chat header',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton(request);
        await chatHeaderAssertion.assertHeaderTitle(request);
      },
    );

    await dialTest.step(
      'Create new conversation and verify previous model is preselected and highlighted',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertElementText(
          agentInfo.agentName,
          nonDefaultModel.name,
        );
        await chat.changeAgentButton.click();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialogAssertion.assertAgentIsSelected(nonDefaultModel);

        const recentTalkTo = await talkToAgents.getEntityNames();
        talkToAgentDialogAssertion.assertValue(
          recentTalkTo[0],
          nonDefaultModel.name,
          ExpectedMessages.recentEntitiesIsOnTop,
        );
      },
    );
  },
);

dialTest(
  'Settings on default screen are not saved in local storage when temperature = 0',
  async ({
    dialHomePage,
    agentSettings,
    agentSettingAssertion,
    temperatureSlider,
    setTestIds,
    chat,
    conversationSettingsModal,
    talkToAgentDialog,
    talkToAgentDialogAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-5703');
    const randomModel = GeneratorUtil.randomArrayElement(
      ModelsUtil.getLatestModels(),
    );
    await localStorageManager.setRecentModelsIdsAndUseLastModel(randomModel);
    await localStorageManager.useLastConversationSettingsOnce();
    await localStorageManager.setShowSideBarPanels();
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chat.configureSettingsButton.click();
    const sysPrompt = 'test prompt';
    const temp = 0;
    const isSysPromptAllowed =
      ModelsUtil.doesModelAllowSystemPrompt(randomModel);
    if (isSysPromptAllowed) {
      await agentSettings.setSystemPrompt(sysPrompt);
    }
    const isTemperatureAllowed =
      ModelsUtil.doesModelAllowTemperature(randomModel);
    if (isTemperatureAllowed) {
      await temperatureSlider.setTemperature(temp);
    }
    await conversationSettingsModal.applyChangesButton.click();

    await dialHomePage.reloadPage();
    await dialHomePage.waitForPageLoaded();
    await chat.configureSettingsButton.click();

    if (isSysPromptAllowed) {
      await agentSettingAssertion.assertSystemPromptValue('');
    }
    if (isTemperatureAllowed) {
      const temperature = await temperatureSlider.getTemperature();
      expect
        .soft(temperature, ExpectedMessages.temperatureIsValid)
        .toBe(ExpectedConstants.defaultTemperature);
    }
    await conversationSettingsModal.cancelButton.click();

    await chat.changeAgentButton.click();
    await talkToAgentDialog.waitForState();
    await talkToAgentDialogAssertion.assertAgentIsSelected(randomModel);
  },
);

dialTest(
  'Recent "Talk to" list is updated',
  async ({
    customApplicationBuilder,
    applicationApiHelper,
    modelApiHelper,
    dialHomePage,
    chatBar,
    chat,
    talkToAgentDialog,
    talkToAgents,
    agentInfoAssertion,
    agentInfo,
    talkToAgentDialogAssertion,
    baseAssertion,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-5699');
    const appName = GeneratorUtil.randomApplicationName();
    let configApp: DialAIEntityModel;

    await dialTest.step('Create a custom app', async () => {
      const customAppModel = customApplicationBuilder
        .withDisplayName(appName)
        .build();
      await applicationApiHelper.createApplication(customAppModel);
      const configModels = await modelApiHelper.getModels();
      configApp = configModels.find((m) => m.name === appName)!;
      await localStorageManager.setShowSideBarPanels();
      await localStorageManager.setDefaultModelReference(
        DefaultModelReference.lastUsedModel,
      );
    });

    await dialTest.step(
      'Create a new conversation based on custom app and send the request',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(configApp, {
          isHttpMethodTriggered: false,
        });
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithButton('test message');
      },
    );

    await dialTest.step(
      'Create new conversation, change the agent and verify custom app stays at the first place',
      async () => {
        await chatBar.createNewEntity();
        await agentInfoAssertion.assertElementText(
          agentInfo.agentName,
          appName,
        );
        await chat.changeAgentButton.click();
        await talkToAgentDialog.waitForState();
        await talkToAgentDialogAssertion.assertAgentIsSelected(configApp);

        const recentTalkTo = await talkToAgents.getEntityNames();
        baseAssertion.assertValue(recentTalkTo[0], appName);
        baseAssertion.assertValue(
          recentTalkTo[1],
          ModelsUtil.getOpenAIEntity(recentModelIds[0])!.name,
        );
      },
    );
  },
);
