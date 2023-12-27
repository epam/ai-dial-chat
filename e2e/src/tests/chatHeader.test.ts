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
    apiHelper,
  }) => {
    setTestIds('EPMRTC-1115', 'EPMRTC-473');
    let conversation: Conversation;
    const temp = 0;
    const request = 'This is a test request';
    const expectedModelIcon = await apiHelper.getEntityIcon(defaultModel);

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
      const headerModelIcon = await chatHeader.getHeaderModelIcon();
      expect
        .soft(
          headerModelIcon,
          `${ExpectedMessages.entityIconIsValid} for ${defaultModel.name}`,
        )
        .toBe(expectedModelIcon);

      if (addonIds.length > 0) {
        const headerAddonIcons = await chatHeader.getHeaderAddonsIcons();
        expect
          .soft(
            headerAddonIcons.length,
            ExpectedMessages.headerIconsCountIsValid,
          )
          .toBe(addonIds.length);

        for (const addonId of addonIds) {
          const expectedAddon = ModelsUtil.getAddon(addonId)!;
          const actualAddon = headerAddonIcons.find(
            (a) => a.entityName === expectedAddon.name,
          )!;
          const expectedAddonIcon =
            await apiHelper.getEntityIcon(expectedAddon);
          expect
            .soft(
              actualAddon.icon,
              `${ExpectedMessages.addonIconIsValid} for ${expectedAddon.name}`,
            )
            .toBe(expectedAddonIcon);
        }
      }
    });

    await test.step('Hover over chat header and verify chat settings are correct on tooltip', async () => {
      await errorPopup.cancelPopup();
      await chatHeader.chatModel.hoverOver();
      const modelInfo = await chatInfoTooltip.getModelInfo();
      expect
        .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
        .toBe(ModelsUtil.getModel(conversation.model.id)!.name);

      const modelInfoIcon = await chatInfoTooltip.getModelIcon();
      expect
        .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
        .toBe(expectedModelIcon);

      const promptInfo = await chatInfoTooltip.getPromptInfo();
      expect.soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid).toBe('');

      const tempInfo = await chatInfoTooltip.getTemperatureInfo();
      expect
        .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
        .toBe(conversation.temperature.toString());

      const addonsInfo = await chatInfoTooltip.getAddonsInfo();
      const actualAddonsInfoIcons = await chatInfoTooltip.getAddonIcons();
      expect
        .soft(addonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
        .toBe(allAddons.length);

      for (const addonId of addonIds) {
        const expectedAddon = ModelsUtil.getAddon(addonId)!;
        const actualAddonInfoIcon = actualAddonsInfoIcons.find(
          (a) => a.entityName === expectedAddon.name,
        )!;
        const expectedAddonIcon = await apiHelper.getEntityIcon(expectedAddon);
        expect
          .soft(
            actualAddonInfoIcon.icon,
            `${ExpectedMessages.chatInfoAddonIconIsValid} for ${expectedAddon.name}`,
          )
          .toBe(expectedAddonIcon);
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
    confirmationDialog,
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
      await chatHeader.clearConversation.click();
      await confirmationDialog.cancelDialog();

      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageContentIsValid)
        .toBe(conversation.messages.length);
    });

    await test.step('Clear conversation messages using header button and verify messages deleted, setting are shown', async () => {
      await chatHeader.clearConversation.click();
      await confirmationDialog.confirm();

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
