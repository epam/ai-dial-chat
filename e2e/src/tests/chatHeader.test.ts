import { Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import { ExpectedConstants, ExpectedMessages } from '@/e2e/src/testData';
import { ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let allAddons: OpenAIEntityModel[];
let addonIds: string[];
let defaultModel: OpenAIEntityModel;

test.beforeAll(async () => {
  allAddons = ModelsUtil.getAddons();
  addonIds = allAddons.map((a) => a.id);
  defaultModel = ModelsUtil.getDefaultModel()!;
});

test(
  'Check chat header for Model with three addons, temp = 0.\n' +
    'Message is send on Enter',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    localStorageManager,
    chatHeader,
    chatInfoTooltip,
    errorPopup,
  }) => {
    setTestIds('EPMRTC-1115', 'EPMRTC-473');
    let conversation: Conversation;
    const temp = 0;
    const request = 'This is a test request';

    await test.step('Prepare model conversation with all available addons and temperature', async () => {
      conversation = conversationData.prepareModelConversation(
        temp,
        '',
        addonIds,
        defaultModel,
      );
      await localStorageManager.setConversationHistory(conversation);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await test.step('Send new request in chat and verify request is sent with valid data', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      const requestsData = await chat.sendRequestWithKeyboard(request, false);

      expect
        .soft(requestsData.modelId, ExpectedMessages.requestModeIdIsValid)
        .toBe(conversation.model.id);
      expect
        .soft(requestsData.prompt, ExpectedMessages.requestPromptIsValid)
        .toBe(conversation.prompt);
      expect
        .soft(requestsData.temperature, ExpectedMessages.requestTempIsValid)
        .toBe(conversation.temperature);
      expect
        .soft(
          requestsData.selectedAddons,
          ExpectedMessages.requestSelectedAddonsAreValid,
        )
        .toEqual(conversation.selectedAddons);
    });

    await test.step('Verify chat icons are updated with model, temperature and addons in the header', async () => {
      const headerIcons = await chatHeader.getHeaderIcons();
      expect
        .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
        .toBe(1 + addonIds.length);
      expect
        .soft(
          headerIcons[0].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(conversation.model.id);
      expect
        .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
        .toBe(defaultModel.iconUrl);

      for (let i = 0; i < addonIds.length; i++) {
        const addon = allAddons.find((a) => a.id === addonIds[i]);
        expect
          .soft(
            headerIcons[i + 1].iconEntity,
            ExpectedMessages.headerIconEntityIsValid,
          )
          .toBe(addon!.id);
        expect
          .soft(
            headerIcons[i + 1].iconUrl,
            ExpectedMessages.headerIconSourceIsValid,
          )
          .toBe(addon!.iconUrl);
      }
    });

    await test.step('Hover over chat header and verify chat settings are correct on tooltip', async () => {
      await errorPopup.cancelPopup();
      await chatHeader.chatModel.hoverOver();
      const modelInfo = await chatInfoTooltip.getModelInfo();
      expect
        .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
        .toBe(conversation.model.name);

      const modelInfoIcon = await chatInfoTooltip.getModelIcon();
      expect
        .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
        .toBe(defaultModel.iconUrl);

      const promptInfo = await chatInfoTooltip.getPromptInfo();
      expect.soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid).toBe('');

      const tempInfo = await chatInfoTooltip.getTemperatureInfo();
      expect
        .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
        .toBe(conversation.temperature.toString());

      const addonsInfo = await chatInfoTooltip.getAddonsInfo();
      const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
      expect
        .soft(addonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
        .toBe(allAddons.length);

      for (let i = 0; i < addonIds.length; i++) {
        const addon = allAddons.find((a) => a.id === addonIds[i]);
        expect
          .soft(addonsInfo[i], ExpectedMessages.chatInfoAddonIsValid)
          .toBe(addon!.name);
        expect
          .soft(addonInfoIcons[i], ExpectedMessages.chatInfoAddonIconIsValid)
          .toBe(addon!.iconUrl);
      }
    });
  },
);

test(
  'Clear conversations using button in chat. Cancel.\n' +
    'Clear conversation using button in chat. Ok',
  async ({
    dialHomePage,
    setTestIds,
    chatMessages,
    conversationData,
    localStorageManager,
    chatHeader,
    conversationSettings,
  }) => {
    setTestIds('EPMRTC-490', 'EPMRTC-491');
    let conversation: Conversation;
    await test.step('Prepare conversation with history', async () => {
      conversation =
        await conversationData.prepareModelConversationBasedOnRequests(
          defaultModel,
          ['first request', 'second request', 'third request'],
        );
      await localStorageManager.setConversationHistory(conversation);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await test.step('Try to clear conversation messages using header button but cancel clearing and verify no messages deleted', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await dialHomePage.dismissBrowserDialog();
      await chatHeader.clearConversation.click();

      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageContentIsValid)
        .toBe(conversation.messages.length);
    });

    await test.step('Clear conversation messages using header button and verify messages deleted, setting are shown', async () => {
      await dialHomePage.acceptBrowserDialog(
        ExpectedConstants.clearAllConversationsAlert,
      );
      await chatHeader.clearConversation.click();

      const isConversationSettingsVisible =
        await conversationSettings.isVisible();
      expect
        .soft(
          isConversationSettingsVisible,
          ExpectedMessages.conversationSettingsVisible,
        )
        .toBeTruthy();
    });
  },
);
