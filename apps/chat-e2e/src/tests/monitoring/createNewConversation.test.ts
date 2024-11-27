import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
let recentModelIds: string[];
let recentAddonIds: string[];
let allEntities: DialAIEntityModel[];

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  recentModelIds = ModelsUtil.getRecentModelIds();
  allEntities = ModelsUtil.getOpenAIEntities();
  recentAddonIds = ModelsUtil.getRecentAddonIds();
});

dialTest(
  'Create new conversation and send new message',
  async ({
    dialHomePage,
    conversations,
    talkToEntities,
    entitySettings,
    temperatureSlider,
    chat,
    chatMessages,
    addons,
  }) => {
    const expectedAddons = ModelsUtil.getAddons();
    const request = 'test request';

    await dialTest.step(
      'Verify the list of recent entities and default settings for default model',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();

        const expectedDefaultRecentEntities = [];
        for (const entity of recentModelIds) {
          expectedDefaultRecentEntities.push(
            allEntities.find((e) => e.id === entity)!.name,
          );
        }

        const recentTalkTo = await talkToEntities.getTalkToEntityNames();
        expect
          .soft(recentTalkTo, ExpectedMessages.recentEntitiesVisible)
          .toEqual(expectedDefaultRecentEntities);

        const defaultSystemPrompt = await entitySettings.getSystemPrompt();
        expect
          .soft(
            defaultSystemPrompt,
            ExpectedMessages.defaultSystemPromptIsEmpty,
          )
          .toBe(ExpectedConstants.emptyString);

        const defaultTemperature = await temperatureSlider.getTemperature();
        expect
          .soft(defaultTemperature, ExpectedMessages.defaultTemperatureIsOne)
          .toBe(ExpectedConstants.defaultTemperature);

        const selectedAddons = await addons.getSelectedAddons();
        expect
          .soft(selectedAddons, ExpectedMessages.noAddonsSelected)
          .toEqual(defaultModel.selectedAddons ?? []);

        const expectedDefaultRecentAddons = [];
        for (const addonId of recentAddonIds) {
          expectedDefaultRecentAddons.push(
            expectedAddons.find((a) => a.id === addonId)?.name || addonId,
          );
        }
        const recentAddons = await addons.getRecentAddons();
        expect
          .soft(recentAddons, ExpectedMessages.recentAddonsVisible)
          .toEqual(expectedDefaultRecentAddons);
      },
    );

    await dialTest.step(
      'Send request to chat and verify response received',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.sendRequestWithKeyboard(request);
        const messagesCount =
          await chatMessages.chatMessages.getElementsCount();
        expect
          .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(2);
      },
    );

    await dialTest.step(
      'Verify new conversation is moved under Today section in chat bar',
      async () => {
        const todayConversations = await conversations.getTodayConversations();
        expect
          .soft(
            todayConversations.length,
            ExpectedMessages.newConversationCreated,
          )
          .toBe(1);
        expect
          .soft(todayConversations[0], ExpectedMessages.conversationOfToday)
          .toBe(request);
      },
    );
  },
);
