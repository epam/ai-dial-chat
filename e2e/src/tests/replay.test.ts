import { ChatBody, Conversation } from '@/src/types/chat';
import {
  OpenAIEntityAddon,
  OpenAIEntityAddonID,
  OpenAIEntityModelID,
  OpenAIEntityModels,
} from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
} from '@/e2e/src/testData';
import { Colors } from '@/e2e/src/ui/domData';
import { GeneratorUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let allAddons: OpenAIEntityAddon[];
test.beforeAll(async ({ apiHelper }) => {
  allAddons = await apiHelper.getAddons();
});

test.skip('[Replay]chat has the same defaults at its parent', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  conversationDropdownMenu,
  conversations,
  setTestIds,
  recentEntities,
  entitySettings,
  temperatureSlider,
  addons,
}) => {
  setTestIds('EPMRTC-501');
  let replayConversation: Conversation;
  const replayTemp = 0;
  const replayPrompt = 'replay prompt';

  await test.step('Prepare two conversation with different settings', async () => {
    const firstConversation = conversationData.prepareModelConversation(
      0.5,
      'first prompt',
      [allAddons[0].id],
      OpenAIEntityModels[OpenAIEntityModelID.BISON_001],
    );
    conversationData.resetData();

    replayConversation = conversationData.prepareModelConversation(
      replayTemp,
      replayPrompt,
      [allAddons[1].id],
      OpenAIEntityModels[OpenAIEntityModelID.GPT_4],
    );
    await localStorageManager.setConversationHistory(
      firstConversation,
      replayConversation,
    );
  });

  await test.step('Open Replay drop-down menu for one conversation', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(replayConversation!.name);
    await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
  });

  await test.step('Verify new Replay conversation is created and Replay button appears', async () => {
    expect
      .soft(
        await conversations
          .getConversationByName(
            `${ExpectedConstants.replayConversation}${
              replayConversation!.name
            }`,
          )
          .isVisible(),
        ExpectedMessages.replayConversationCreated,
      )
      .toBeTruthy();
    expect
      .soft(await chat.replay.isVisible(), ExpectedMessages.startReplayVisible)
      .toBeTruthy();
  });

  await test.step('Verify Replay conversation setting are the same as for initial one', async () => {
    const modelBorderColors = await recentEntities
      .getRecentEntity(ExpectedConstants.talkToReply)
      .getAllBorderColors();
    Object.values(modelBorderColors).forEach((borders) => {
      borders.forEach((borderColor) => {
        expect
          .soft(borderColor, ExpectedMessages.talkToEntityIsSelected)
          .toBe(Colors.highlightedEntity);
      });
    });

    const systemPrompt = await entitySettings.getSystemPrompt();
    expect
      .soft(systemPrompt, ExpectedMessages.systemPromptIsValid)
      .toBe(replayPrompt);

    const temperature = await temperatureSlider.getTemperature();
    expect
      .soft(temperature, ExpectedMessages.temperatureIsValid)
      .toBe(replayTemp.toString());

    const selectedAddons = await addons.getSelectedAddons();
    expect
      .soft(selectedAddons, ExpectedMessages.selectedAddonsValid)
      .toEqual([allAddons[1].name]);
  });
});

test('[Replay]chat is created in the same folder where its parent is located', async ({
  dialHomePage,
  conversationData,
  folderConversations,
  localStorageManager,
  setTestIds,
  conversationDropdownMenu,
}) => {
  setTestIds('EPMRTC-503');
  let conversationInFolder: FolderConversation;

  await test.step('Prepare conversation inside folder', async () => {
    conversationInFolder =
      conversationData.prepareDefaultConversationInFolder();
    await localStorageManager.setFolders(conversationInFolder.folders);
    await localStorageManager.setConversationHistory(
      conversationInFolder.conversations[0],
    );
  });

  await test.step('Open Replay drop-down menu for conversation inside folder', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await folderConversations.expandCollapseFolder(
      conversationInFolder!.folders.name,
    );

    await folderConversations.openFolderConversationDropdownMenu(
      conversationInFolder!.folders.name,
      conversationInFolder!.conversations[0].name,
    );
    await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
  });

  await test.step('Verify new Replay conversation is created inside folder', async () => {
    const isConversationVisible =
      await folderConversations.isFolderConversationVisible(
        conversationInFolder!.folders.name,
        `${ExpectedConstants.replayConversation}${
          conversationInFolder!.conversations[0].name
        }`,
      );
    expect
      .soft(isConversationVisible, ExpectedMessages.conversationMovedToFolder)
      .toBeTruthy();
  });
});

test('Start replay with the new Model settings', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  apiHelper,
  chatHeader,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  chatInfoTooltip,
}) => {
  setTestIds('EPMRTC-508');
  const replayTemp = 0;
  const replayPrompt = 'reply the same text';
  const replayAddonId = GeneratorUtil.randomArrayElement(
    ExpectedConstants.recentAddonIds.split(','),
  );
  const replayAddon = await apiHelper.getAddonById(replayAddonId);
  const replayModel = await apiHelper.getEntity(
    OpenAIEntityModels[OpenAIEntityModelID.BISON_001],
  );

  await test.step('Prepare conversation to replay', async () => {
    const conversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
    );
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  let replayRequest: ChatBody;
  await test.step('Change model and settings for replay conversation and press Start replay', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await talkToSelector.selectModel(
      OpenAIEntityModels[OpenAIEntityModelID.BISON_001].name,
    );
    await entitySettings.setSystemPrompt(replayPrompt);
    await temperatureSlider.setTemperature(replayTemp);
    await addons.selectAddon(replayAddon!.name);
    replayRequest = await chat.startReplay();
  });

  await test.step('Verify chat API request is sent with correct settings', async () => {
    expect
      .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.BISON_001].id);
    expect
      .soft(replayRequest.prompt, ExpectedMessages.chatRequestPromptIsValid)
      .toBe(replayPrompt);
    expect
      .soft(
        replayRequest.temperature,
        ExpectedMessages.chatRequestTemperatureIsValid,
      )
      .toBe(replayTemp);
    expect
      .soft(
        replayRequest.selectedAddons,
        ExpectedMessages.chatRequestAddonsAreValid,
      )
      .toEqual([replayAddonId]);
  });

  await test.step('Verify chat header icons are updated with new model and addon', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(2);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.BISON_001].id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(replayModel!.iconUrl);

    expect
      .soft(headerIcons[1].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(replayAddonId);
    expect
      .soft(headerIcons[1].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(replayAddon!.iconUrl);
  });

  await test.step('Hover over chat header model and verify chat settings on tooltip', async () => {
    await chatHeader.chatModel.hoverOver();
    const modelInfo = await chatInfoTooltip.getModelInfo();
    expect
      .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.BISON_001].name);

    const modelInfoIcon = await chatInfoTooltip.getModelIcon();
    expect
      .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
      .toBe(replayModel!.iconUrl);

    const promptInfo = await chatInfoTooltip.getPromptInfo();
    expect
      .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
      .toBe(replayPrompt);

    const tempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(replayTemp.toString());

    const addonsInfo = await chatInfoTooltip.getAddonsInfo();
    const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
    expect
      .soft(addonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
      .toBe(1);
    expect
      .soft(addonsInfo[0], ExpectedMessages.chatInfoAddonIsValid)
      .toBe(replayAddon!.name);
    expect
      .soft(addonInfoIcons[0], ExpectedMessages.chatInfoAddonIconIsValid)
      .toBe(replayAddon!.iconUrl);
  });
});

test('Start replay with new Assistant settings', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  apiHelper,
  chatHeader,
  temperatureSlider,
  talkToSelector,
  chatInfoTooltip,
}) => {
  setTestIds('EPMRTC-509');
  const replayTemp = 0.5;
  const assistant = await apiHelper.getEntity(
    OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K],
  );
  const assistantModel = await apiHelper.getEntity(
    OpenAIEntityModels[OpenAIEntityModelID.GPT_4],
  );
  const assistantAddons = assistant!.selectedAddons!;

  await test.step('Prepare conversation to replay', async () => {
    const conversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
    );
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  let replayRequest: ChatBody;
  await test.step('Change settings to assistant with model and press Start replay', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await talkToSelector.selectAssistant(ExpectedConstants.presalesAssistant);
    await temperatureSlider.setTemperature(replayTemp);
    replayRequest = await chat.startReplay();
  });

  await test.step('Verify chat API request is sent with correct settings', async () => {
    expect
      .soft(
        replayRequest.modelId,
        ExpectedMessages.chatRequestModelAssistantIsValid,
      )
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K].id);
    expect
      .soft(
        replayRequest.assistantModelId,
        ExpectedMessages.chatRequestModelIsValid,
      )
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.GPT_4].id);
    expect
      .soft(
        replayRequest.temperature,
        ExpectedMessages.chatRequestTemperatureIsValid,
      )
      .toBe(replayTemp);
    expect
      .soft(
        replayRequest.selectedAddons,
        ExpectedMessages.chatRequestAddonsAreValid,
      )
      .toEqual(assistantAddons);
  });

  await test.step('Verify chat header icons are updated with new assistant, model and addon', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1 + assistantAddons.length);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.ASSISTANT10K].id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(assistant!.iconUrl);

    for (let i = 0; i < assistantAddons.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantAddons[i])!;
      expect
        .soft(
          headerIcons[i + 1].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(addon.id);
      expect
        .soft(
          headerIcons[i + 1].iconUrl,
          ExpectedMessages.headerIconSourceIsValid,
        )
        .toBe(addon.iconUrl);
    }
  });

  await test.step('Hover over chat header model and verify chat settings on tooltip', async () => {
    await chatHeader.chatModel.hoverOver();
    const assistantModelInfo = await chatInfoTooltip.getAssistantModelInfo();
    expect
      .soft(assistantModelInfo, ExpectedMessages.chatInfoAssistantModelIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.GPT_4].name);

    const assistantModelInfoIcon =
      await chatInfoTooltip.getAssistantModelIcon();
    expect
      .soft(
        assistantModelInfoIcon,
        ExpectedMessages.chatInfoAssistantModelIconIsValid,
      )
      .toBe(assistantModel!.iconUrl);

    const assistantInfo = await chatInfoTooltip.getAssistantInfo();
    expect
      .soft(assistantInfo, ExpectedMessages.chatInfoAssistantIsValid)
      .toBe(assistant!.name);

    const assistantInfoIcon = await chatInfoTooltip.getAssistantIcon();
    expect
      .soft(assistantInfoIcon, ExpectedMessages.chatInfoAssistantIconIsValid)
      .toBe(assistant!.iconUrl);

    const tempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(replayTemp.toString());

    const addonsInfo = await chatInfoTooltip.getAddonsInfo();
    const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
    for (let i = 0; i < assistantAddons.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantAddons[i])!;
      expect
        .soft(addonsInfo[i], ExpectedMessages.chatInfoAddonIsValid)
        .toBe(addon.name);
      expect
        .soft(addonInfoIcons[i], ExpectedMessages.chatInfoAddonIconIsValid)
        .toBe(addon.iconUrl);
    }
  });
});

test('Start replay with new Application', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  apiHelper,
  chatHeader,
  talkToSelector,
  chatInfoTooltip,
}) => {
  setTestIds('EPMRTC-510');
  const replayApp = await apiHelper.getEntity(
    OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
  );

  await test.step('Prepare conversation to replay', async () => {
    const conversation = conversationData.prepareDefaultConversation(
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
    );
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  let replayRequest: ChatBody;
  await test.step('Change model to application and press Start replay', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await talkToSelector.selectApplication(
      OpenAIEntityModels[OpenAIEntityModelID.MIRROR].name,
    );
    replayRequest = await chat.startReplay();
  });

  await test.step('Verify chat API request is sent with correct settings', async () => {
    expect
      .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.MIRROR].id);
  });

  await test.step('Verify chat header icons are updated with new application', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.MIRROR].id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(replayApp!.iconUrl);
  });

  await test.step('Hover over chat header model and verify chat settings on tooltip', async () => {
    await chatHeader.chatModel.hoverOver();
    const appInfo = await chatInfoTooltip.getApplicationInfo();
    expect
      .soft(appInfo, ExpectedMessages.chatInfoAppIsValid)
      .toBe(OpenAIEntityModels[OpenAIEntityModelID.MIRROR].name);

    const appInfoIcon = await chatInfoTooltip.getApplicationIcon();
    expect
      .soft(appInfoIcon, ExpectedMessages.chatInfoAppIconIsValid)
      .toBe(replayApp!.iconUrl);
  });
});

test('Replay after Stop generating', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  chatMessages,
}) => {
  setTestIds('EPMRTC-512');
  let conversation: Conversation;
  const userRequest = 'write down 100 adjectives';
  await test.step('Prepare model conversation to replay', async () => {
    conversation = conversationData.prepareModelConversationBasedOnRequests(
      OpenAIEntityModels[OpenAIEntityModelID.GPT_3_5_AZ],
      [userRequest],
    );
    const replayConversation =
      conversationData.preparePartiallyRepliedConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  await test.step('Press Start replay and stop until full response received', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    expect
      .soft(
        await chat.proceedGenerating.getElementInnerContent(),
        ExpectedMessages.proceedReplayIsVisible,
      )
      .toBe(ExpectedConstants.proceedReplayLabel);
  });

  await test.step('Proceed generating the answer and verify received content is preserved', async () => {
    const receivedPartialContent = await chatMessages.getGeneratedChatContent(
      conversation.messages.length,
    );
    await chat.proceedReplaying();
    const preservedPartialContent = await chatMessages.getGeneratedChatContent(
      conversation.messages.length,
    );
    expect
      .soft(
        preservedPartialContent.includes(receivedPartialContent),
        ExpectedMessages.replayContinuesFromReceivedContent,
      )
      .toBeTruthy();
  });
});

test('Replay after Stop generating in Assistant model', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  chatMessages,
  apiHelper,
}) => {
  setTestIds('EPMRTC-513');
  let conversation: Conversation;
  await test.step('Prepare assistant conversation with addons to replay', async () => {
    const assistantEntity = await apiHelper.getAssistant(
      ExpectedConstants.presalesAssistant,
    );
    conversation = conversationData.prepareAssistantConversation(
      assistantEntity!,
      [
        OpenAIEntityAddonID.ADDON_EPAM10K_GOLDEN_QNA,
        OpenAIEntityAddonID.ADDON_EPAM10K_SEMANTIC_SEARCH,
      ],
    );
    const replayConversation =
      conversationData.preparePartiallyReplayedConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  await test.step('Press Start replay and stop when first stage received', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    expect
      .soft(
        await chat.proceedGenerating.getElementInnerContent(),
        ExpectedMessages.proceedReplayIsVisible,
      )
      .toBe(ExpectedConstants.proceedReplayLabel);
  });

  await test.step('Proceed generating the answer and verify all stages are regenerated', async () => {
    await chat.proceedReplaying();
    const isFirstStageReceived = await chatMessages.isMessageStageReceived(
      conversation.messages.length,
      1,
    );
    expect
      .soft(isFirstStageReceived, ExpectedMessages.replayRegeneratesStages)
      .toBeFalsy();
  });
});

test(
  'Restart replay after error appeared on browser refresh.\n' +
    'Restart replay after error appeared on network interruption',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    setTestIds,
    setIssueIds,
    chatMessages,
    context,
  }) => {
    setTestIds('EPMRTC-514', 'EPMRTC-1165');
    setIssueIds('275');
    let conversation: Conversation;
    await test.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareDefaultConversation(
        OpenAIEntityModels[OpenAIEntityModelID.MIRROR],
      );
      const replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await localStorageManager.setConversationHistory(
        conversation,
        replayConversation,
      );
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    await test.step('Press Start replay and interrupt it with network error', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await context.setOffline(true);
      await chat.startReplay();
    });

    await test.step('Verify error message is displayed', async () => {
      const generatedContent = await chatMessages.getLastMessageContent();
      expect
        .soft(generatedContent, ExpectedMessages.errorReceivedOnReplay)
        .toBe(ExpectedConstants.answerError);
      expect
        .soft(
          await chat.proceedGenerating.getElementInnerContent(),
          ExpectedMessages.proceedReplayIsVisible,
        )
        .toBe(ExpectedConstants.proceedReplayLabel);
    });

    await test.step('Proceed replaying and verify response received', async () => {
      await context.setOffline(false);
      await chat.proceedReplaying(true);
      const generatedContent = await chatMessages.getGeneratedChatContent(
        conversation.messages.length,
      );
      expect
        .soft(
          generatedContent.includes(
            conversation.messages.find((m) => m.role === 'user')!.content,
          ),
          ExpectedMessages.replayContinuesFromReceivedContent,
        )
        .toBeTruthy();
    });
  },
);
