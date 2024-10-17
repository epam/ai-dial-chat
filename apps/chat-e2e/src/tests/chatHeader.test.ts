import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { API, ExpectedMessages } from '@/src/testData';
import { responseThrottlingTimeout } from '@/src/ui/pages';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let allAddons: DialAIEntityModel[];
let addonIds: string[];
let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  allAddons = ModelsUtil.getAddons();
  addonIds = allAddons.map((a) => a.id);
  defaultModel = ModelsUtil.getDefaultModel()!;
});

dialTest(
  'Check chat header for Model with three addons, temp = 0.\n' +
    'Message is send on Enter',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    chatHeader,
    chatInfoTooltip,
    errorPopup,
    iconApiHelper,
    chatHeaderAssertion,
    conversationInfoTooltipAssertion,
  }) => {
    setTestIds('EPMRTC-1115', 'EPMRTC-473');
    let conversation: Conversation;
    const temp = 0;
    const request = 'This is a test request';
    const expectedModelIcon = iconApiHelper.getEntityIcon(defaultModel);

    await dialTest.step(
      'Prepare model conversation with all available addons and temperature',
      async () => {
        conversation = conversationData.prepareModelConversation(
          temp,
          '',
          addonIds,
          defaultModel,
        );
        await dataInjector.createConversations([conversation]);
        await localStorageManager.setSelectedConversation(conversation);
      },
    );

    await dialTest.step(
      'Send new request in chat and verify request is sent with valid data',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.throttleAPIResponse(
          API.chatHost,
          responseThrottlingTimeout * 2,
        );
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
      },
    );

    await dialTest.step(
      'Verify chat icons are updated with model, temperature and addons in the header',
      async () => {
        await chatHeaderAssertion.assertHeaderIcon(expectedModelIcon);

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
              iconApiHelper.getEntityIcon(expectedAddon);
            await chatHeaderAssertion.assertEntityIcon(
              actualAddon.iconLocator,
              expectedAddonIcon,
            );
          }
        }
      },
    );

    await dialTest.step(
      'Hover over chat header and verify chat settings are correct on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await chatHeader.hoverOverChatModel();
        const modelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(defaultModel.name);

        const modelVersionInfo = await chatInfoTooltip.getVersionInfo();
        expect
          .soft(modelVersionInfo, ExpectedMessages.chatInfoVersionIsValid)
          .toBe(defaultModel.version);

        await conversationInfoTooltipAssertion.assertTooltipModelIcon(
          expectedModelIcon,
        );

        const promptInfo = await chatInfoTooltip.getPromptInfo(false);
        expect
          .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
          .toBe('');

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
          const expectedAddonIcon = iconApiHelper.getEntityIcon(expectedAddon);
          await conversationInfoTooltipAssertion.assertEntityIcon(
            actualAddonInfoIcon.iconLocator,
            expectedAddonIcon,
          );
        }
      },
    );
  },
);

dialTest(
  'Clear conversations using button in chat. Cancel.\n' +
    'Clear conversation using button in chat. Ok',
  async ({
    dialHomePage,
    setTestIds,
    chatMessages,
    conversationData,
    localStorageManager,
    dataInjector,
    chatHeader,
    conversationSettings,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-490', 'EPMRTC-491');
    let conversation: Conversation;
    await dialTest.step('Prepare conversation with history', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        defaultModel,
        ['first request', 'second request', 'third request'],
      );
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setSelectedConversation(conversation);
    });

    await dialTest.step(
      'Try to clear conversation messages using header button but cancel clearing and verify no messages deleted',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatHeader.clearConversation.click();
        await confirmationDialog.cancelDialog();

        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageContentIsValid)
          .toBe(conversation.messages.length);
      },
    );

    await dialTest.step(
      'Clear conversation messages using header button and verify messages deleted, setting are shown',
      async () => {
        await chatHeader.clearConversation.click();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'PUT' });

        await expect
          .soft(
            conversationSettings.getElementLocator(),
            ExpectedMessages.conversationSettingsVisible,
          )
          .toBeVisible();
      },
    );
  },
);
