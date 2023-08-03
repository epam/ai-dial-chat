import test from '../core/fixtures';
import { ExpectedConstants, ExpectedMessages } from '../testData';
import { Colors } from '../ui/domData';

import { expect } from '@playwright/test';

test(
  'New conversation is created on "New chat" button' +
    '\n' +
    'Default settings in new chat with cleared site data',
  async ({ dialHomePage, chatBar, conversation, conversationSettings }) => {
    await dialHomePage.openHomePage();
    await chatBar.createNewChat();
    expect
      .soft(
        await conversation
          .getConversationByName(ExpectedConstants.newConversationTitle)
          .isVisible(),
        ExpectedMessages.newConversationCreated,
      )
      .toBeTruthy();

    const defaultTalkTo = await conversationSettings
      .getEntitySelector()
      .getElementContent();
    expect
      .soft(defaultTalkTo, ExpectedMessages.defaultTalkToIsValid)
      .toBe(ExpectedConstants.defaultTalkToModel);

    const defaultSystemPrompt =
      await conversationSettings.systemPrompt.getElementContent();
    expect
      .soft(defaultSystemPrompt, ExpectedMessages.defaultSystemPromptIsEmpty)
      .toBe(ExpectedConstants.emptyString);

    const defaultTemperature = await conversationSettings
      .getTemperatureSlider()
      .getTemperatureValue();
    expect
      .soft(defaultTemperature, ExpectedMessages.defaultTemperatureIsOne)
      .toBe(ExpectedConstants.defaultTemperature);

    const addonBorderColors = await conversationSettings
      .getAddons()
      .addons.getAllBorderBottomColors();

    Object.values(addonBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.addonBorderIsNotSelected)
          .toBe(Colors.notSelectedAddon);
      });
    });
  },
);
