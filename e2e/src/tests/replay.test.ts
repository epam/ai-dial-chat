import { ChatBody, Conversation } from '@/src/types/chat';
import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  AssistantIds,
  ExpectedConstants,
  ExpectedMessages,
  FolderConversation,
  MenuOptions,
  ModelIds,
} from '@/e2e/src/testData';
import { Colors } from '@/e2e/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let allAddons: OpenAIEntityModel[];
let allModels: OpenAIEntityModel[];
let mirrorApp: OpenAIEntityModel;
let assistant: OpenAIEntityModel;
let gpt35Model: OpenAIEntityModel;
let gpt4Model: OpenAIEntityModel;
let bison: OpenAIEntityModel;

test.beforeAll(async () => {
  allAddons = ModelsUtil.getAddons();
  allModels = ModelsUtil.getModels().filter((m) => m.iconUrl != undefined);
  mirrorApp = ModelsUtil.getApplication(ModelIds.MIRROR)!;
  assistant = ModelsUtil.getAssistant(AssistantIds.ASSISTANT10K)!;
  gpt35Model = ModelsUtil.getModel(ModelIds.GPT_3_5_AZ)!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
  bison = ModelsUtil.getModel(ModelIds.BISON_001)!;
});

test(
  '[Replay]chat has the same defaults at its parent.\n' +
    '"Replay as is" is selected by default in [Replay]chat',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    conversationDropdownMenu,
    conversations,
    setTestIds,
    recentEntities,
    replayAsIs,
    talkToSelector,
    entitySettings,
    temperatureSlider,
    addons,
  }) => {
    setTestIds('EPMRTC-501', 'EPMRTC-1264');
    let replayConversation: Conversation;
    const replayTemp = 0;
    const replayPrompt = 'replay prompt';
    const replayAddon = ModelsUtil.getAddon(allAddons[1].id);
    let firstConversation: Conversation;

    await test.step('Prepare two conversation with different settings', async () => {
      firstConversation = conversationData.prepareModelConversation(
        0.5,
        'first prompt',
        [allAddons[0].id],
        bison,
      );
      conversationData.resetData();

      replayConversation = conversationData.prepareModelConversation(
        replayTemp,
        replayPrompt,
        [allAddons[1].id],
        gpt4Model,
      );
      await localStorageManager.setConversationHistory(
        firstConversation,
        replayConversation,
      );
    });

    await test.step('Open Replay drop-down menu for one conversation', async () => {
      const modelUrls = allModels
        .filter(
          (m) =>
            m.id === firstConversation.model.id ||
            m.id === replayConversation.model.id,
        )
        .map((m) => m.iconUrl);
      await dialHomePage.openHomePage({ iconsToBeLoaded: modelUrls });
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await conversations.openConversationDropdownMenu(
        replayConversation!.name,
      );
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
        .soft(
          await chat.replay.getElementContent(),
          ExpectedMessages.startReplayVisible,
        )
        .toBe(ExpectedConstants.startReplayLabel);
    });

    await test.step('Verify "Replay as is" option is selected', async () => {
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

      const replayLabel = await replayAsIs.getReplayAsIsLabelText();
      expect
        .soft(replayLabel, ExpectedMessages.replayAsIsLabelIsVisible)
        .toBe(ExpectedConstants.replayAsIsLabel);
    });

    await test.step('Select some model and verify it has the same settings as parent model', async () => {
      await talkToSelector.selectModel(gpt35Model.name);

      const newModelSystemPrompt = await entitySettings.getSystemPrompt();
      expect
        .soft(newModelSystemPrompt, ExpectedMessages.systemPromptIsValid)
        .toBe(replayPrompt);

      const newModelTemperature = await temperatureSlider.getTemperature();
      expect
        .soft(newModelTemperature, ExpectedMessages.temperatureIsValid)
        .toBe(replayTemp.toString());

      const newModelSelectedAddons = await addons.getSelectedAddons();
      expect
        .soft(newModelSelectedAddons, ExpectedMessages.selectedAddonsValid)
        .toEqual([replayAddon!.name]);
    });
  },
);

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
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
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
  chatHeader,
  entitySettings,
  temperatureSlider,
  addons,
  talkToSelector,
  chatInfoTooltip,
  errorPopup,
}) => {
  setTestIds('EPMRTC-508');
  const replayTemp = 0;
  const replayPrompt = 'reply the same text';
  const replayAddonId = GeneratorUtil.randomArrayElement(
    ModelsUtil.getRecentAddonIds(),
  );
  const replayAddon = ModelsUtil.getAddon(replayAddonId);
  const replayModel = bison;

  await test.step('Prepare conversation to replay', async () => {
    const conversation = conversationData.prepareDefaultConversation(mirrorApp);
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
    await talkToSelector.selectModel(bison.name);
    await entitySettings.setSystemPrompt(replayPrompt);
    await temperatureSlider.setTemperature(replayTemp);
    await addons.selectAddon(replayAddon!.name);
    replayRequest = await chat.startReplay();
  });

  await test.step('Verify chat API request is sent with correct settings', async () => {
    expect
      .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
      .toBe(bison.id);
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
      .toBe(bison.id);
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
    await errorPopup.cancelPopup();
    await chatHeader.chatModel.hoverOver();
    const modelInfo = await chatInfoTooltip.getModelInfo();
    expect
      .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
      .toBe(bison.name);

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
  chatHeader,
  temperatureSlider,
  talkToSelector,
  chatInfoTooltip,
  errorPopup,
}) => {
  setTestIds('EPMRTC-509');
  const replayTemp = 0.5;
  const assistantModel = gpt4Model;
  const assistantAddons = assistant!.selectedAddons!;

  await test.step('Prepare conversation to replay', async () => {
    const conversation =
      conversationData.prepareDefaultConversation(gpt35Model);
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
    await dialHomePage.openHomePage({ iconsToBeLoaded: [gpt35Model!.iconUrl] });
    await dialHomePage.waitForPageLoaded();
    await talkToSelector.selectAssistant(assistant.name);
    await temperatureSlider.setTemperature(replayTemp);
    replayRequest = await chat.startReplay();
  });

  await test.step('Verify chat API request is sent with correct settings', async () => {
    expect
      .soft(
        replayRequest.modelId,
        ExpectedMessages.chatRequestModelAssistantIsValid,
      )
      .toBe(assistant.id);
    expect
      .soft(
        replayRequest.assistantModelId,
        ExpectedMessages.chatRequestModelIsValid,
      )
      .toBe(gpt4Model.id);
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
      .toBe(assistant.id);
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
    await errorPopup.cancelPopup();
    await chatHeader.chatModel.hoverOver();
    const assistantModelInfo = await chatInfoTooltip.getAssistantModelInfo();
    expect
      .soft(assistantModelInfo, ExpectedMessages.chatInfoAssistantModelIsValid)
      .toBe(gpt4Model.name);

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

test(
  'Start replay with new Application.\n' +
    '"Replay as is" disappears from settings after replaying the chat',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    setTestIds,
    chatHeader,
    talkToSelector,
    chatInfoTooltip,
    errorPopup,
    recentEntities,
  }) => {
    setTestIds('EPMRTC-510', 'EPMRTC-1291');
    let conversation: Conversation;

    await test.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareDefaultConversation(gpt35Model);
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
      await talkToSelector.selectApplication(mirrorApp.name);
      replayRequest = await chat.startReplay(
        conversation.messages[0].content,
        true,
      );
    });

    await test.step('Verify chat API request is sent with correct settings', async () => {
      expect
        .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
        .toBe(mirrorApp.id);
    });

    await test.step('Verify "Regenerate Response" button is visible', async () => {
      await chat.replay.waitForState({ state: 'hidden' });
      expect
        .soft(
          await chat.regenerate.isVisible(),
          ExpectedMessages.regenerateIsAvailable,
        )
        .toBeTruthy();
    });

    await test.step('Verify chat header icons are updated with new application', async () => {
      const headerIcons = await chatHeader.getHeaderIcons();
      expect
        .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
        .toBe(1);
      expect
        .soft(
          headerIcons[0].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(mirrorApp.id);
      expect
        .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
        .toBe(mirrorApp.iconUrl);
    });

    await test.step('Hover over chat header model and verify chat settings on tooltip', async () => {
      await errorPopup.cancelPopup();
      await chatHeader.chatModel.hoverOver();
      const appInfo = await chatInfoTooltip.getApplicationInfo();
      expect
        .soft(appInfo, ExpectedMessages.chatInfoAppIsValid)
        .toBe(mirrorApp.name);

      const appInfoIcon = await chatInfoTooltip.getApplicationIcon();
      expect
        .soft(appInfoIcon, ExpectedMessages.chatInfoAppIconIsValid)
        .toBe(mirrorApp.iconUrl);
    });

    await test.step('Verify "Replay as is" is not visible in model settings', async () => {
      await chatHeader.openConversationSettings.click();
      const isReplayAsIsOptionDisplayed = await recentEntities
        .getRecentEntity(ExpectedConstants.talkToReply)
        .isVisible();
      expect
        .soft(
          isReplayAsIsOptionDisplayed,
          ExpectedMessages.replayAsOptionNotVisible,
        )
        .toBeFalsy();
    });
  },
);

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
      gpt35Model,
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
      .toBe(ExpectedConstants.continueReplayLabel);
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
}) => {
  setTestIds('EPMRTC-513');
  let conversation: Conversation;
  await test.step('Prepare assistant conversation with addons to replay', async () => {
    conversation = conversationData.prepareAssistantConversation(
      assistant,
      assistant.selectedAddons!,
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
      .toBe(ExpectedConstants.continueReplayLabel);
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
    chatMessages,
    context,
  }) => {
    setTestIds('EPMRTC-514', 'EPMRTC-1165');
    let conversation: Conversation;
    await test.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareDefaultConversation(mirrorApp);
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
        .toBe(ExpectedConstants.continueReplayAfterErrorLabel);
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

test(
  '"Replay as is" when chat is based on Model.\n' +
    '"Replay as is" when chat is based on Model with addon',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    setTestIds,
    chatHeader,
    chatInfoTooltip,
    errorPopup,
    talkToSelector,
  }) => {
    setTestIds('EPMRTC-1323', 'EPMRTC-1324');
    const replayTemp = 0.8;
    const replayPrompt = 'reply the same text';
    let conversation: Conversation;
    const replayModel = gpt35Model;
    const replayAddon = ModelsUtil.getAddon(allAddons[0].id);

    await test.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareModelConversation(
        replayTemp,
        replayPrompt,
        [allAddons[0].id],
        gpt35Model,
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
    await test.step('Replay conversation with "Replay as is" option selected and verify valid request is sent', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await talkToSelector.selectModel(ExpectedConstants.replayAsIsLabel);
      replayRequest = await chat.startReplay(conversation.messages[0].content);
      expect
        .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
        .toBe(conversation.model.id);
      expect
        .soft(replayRequest.prompt, ExpectedMessages.chatRequestPromptIsValid)
        .toBe(conversation.prompt);
      expect
        .soft(
          replayRequest.temperature,
          ExpectedMessages.chatRequestTemperatureIsValid,
        )
        .toBe(conversation.temperature);
      expect
        .soft(
          replayRequest.selectedAddons,
          ExpectedMessages.chatRequestAddonsAreValid,
        )
        .toEqual(conversation.selectedAddons);
    });

    await test.step('Verify chat header icons are the same as initial model', async () => {
      const headerIcons = await chatHeader.getHeaderIcons();
      expect
        .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
        .toBe(2);
      expect
        .soft(
          headerIcons[0].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(conversation.model.id);
      expect
        .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
        .toBe(replayModel!.iconUrl);
      expect
        .soft(
          headerIcons[1].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(allAddons[0].id);
      expect
        .soft(headerIcons[1].iconUrl, ExpectedMessages.headerIconSourceIsValid)
        .toBe(replayAddon!.iconUrl);
    });

    await test.step('Hover over chat header model and verify chat settings on tooltip', async () => {
      await errorPopup.cancelPopup();
      await chatHeader.chatModel.hoverOver();
      const modelInfo = await chatInfoTooltip.getModelInfo();
      expect
        .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
        .toBe(conversation.model.name);

      const modelInfoIcon = await chatInfoTooltip.getModelIcon();
      expect
        .soft(modelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
        .toBe(replayModel!.iconUrl);

      const promptInfo = await chatInfoTooltip.getPromptInfo();
      expect
        .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
        .toBe(conversation.prompt);

      const tempInfo = await chatInfoTooltip.getTemperatureInfo();
      expect
        .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
        .toBe(conversation.temperature.toString());

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
  },
);

test('"Replay as is" when chat is based on Application', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  chatHeader,
  chatInfoTooltip,
  errorPopup,
}) => {
  setTestIds('EPMRTC-1325');
  let conversation: Conversation;
  let replayRequest: ChatBody;

  await test.step('Prepare conversation with application to replay', async () => {
    conversation = conversationData.prepareDefaultConversation(mirrorApp);
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  await test.step('Start replay with preselected "Replay as is" option', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    replayRequest = await chat.startReplay(conversation.messages[0].content);
  });

  await test.step('Verify chat API request is sent with same settings as for parent application', async () => {
    expect
      .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
      .toBe(conversation.model.id);
  });

  await test.step('Verify chat header icons are the same as for parent application', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(conversation.model.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(mirrorApp.iconUrl);
  });

  await test.step('Hover over chat header model and verify chat settings are the same as for parent application', async () => {
    await errorPopup.cancelPopup();
    await chatHeader.chatModel.hoverOver();
    const appInfo = await chatInfoTooltip.getApplicationInfo();
    expect
      .soft(appInfo, ExpectedMessages.chatInfoAppIsValid)
      .toBe(conversation.model.name);

    const appInfoIcon = await chatInfoTooltip.getApplicationIcon();
    expect
      .soft(appInfoIcon, ExpectedMessages.chatInfoAppIconIsValid)
      .toBe(mirrorApp.iconUrl);
  });
});

test('"Replay as is" when chat is based on Assistant', async ({
  dialHomePage,
  chat,
  setTestIds,
  conversationData,
  localStorageManager,
  chatHeader,
  chatInfoTooltip,
  errorPopup,
}) => {
  setTestIds('EPMRTC-1326');
  let conversation: Conversation;
  let requestsData: ChatBody;
  const assistantSelectedAddons = assistant?.selectedAddons;
  const temp = 0;
  const randomModel = GeneratorUtil.randomArrayElement(allModels);

  await test.step('Prepare assistant conversation with random model and temperature', async () => {
    conversation = conversationData.prepareAssistantConversation(
      assistant!,
      assistantSelectedAddons!,
      randomModel,
    );
    conversation.temperature = temp;
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  await test.step('Send new request with preselected "Replay as is" option and verify request data is the same as for parent model', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    requestsData = await chat.startReplay(conversation.messages[0].content);

    expect
      .soft(requestsData.modelId, ExpectedMessages.requestModeIdIsValid)
      .toBe(conversation.model.id);
    expect
      .soft(requestsData.temperature, ExpectedMessages.requestTempIsValid)
      .toBe(conversation.temperature);
    expect
      .soft(
        requestsData.assistantModelId,
        ExpectedMessages.requestAssistantModelIdIsValid,
      )
      .toBe(conversation.assistantModelId);
    expect
      .soft(
        requestsData.selectedAddons,
        ExpectedMessages.requestSelectedAddonsAreValid,
      )
      .toEqual(conversation.selectedAddons);
  });

  await test.step('Verify chat icons are correct in the header', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1 + assistantSelectedAddons!.length);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(conversation.model.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(assistant!.iconUrl);

    for (let i = 0; i < assistantSelectedAddons!.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantSelectedAddons![i]);
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
    const assistantInfo = await chatInfoTooltip.getAssistantInfo();
    expect
      .soft(assistantInfo, ExpectedMessages.chatInfoAssistantIsValid)
      .toBe(assistant!.name);

    const assistantInfoIcon = await chatInfoTooltip.getAssistantIcon();
    expect
      .soft(assistantInfoIcon, ExpectedMessages.chatInfoAssistantIconIsValid)
      .toBe(assistant!.iconUrl);

    const assistantModelInfo = await chatInfoTooltip.getAssistantModelInfo();
    expect
      .soft(assistantModelInfo, ExpectedMessages.chatInfoAssistantModelIsValid)
      .toBe(randomModel.name);

    const assistantModelInfoIcon =
      await chatInfoTooltip.getAssistantModelIcon();
    expect
      .soft(
        assistantModelInfoIcon,
        ExpectedMessages.chatInfoAssistantModelIconIsValid,
      )
      .toBe(randomModel!.iconUrl);

    const tempInfo = await chatInfoTooltip.getTemperatureInfo();
    expect
      .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
      .toBe(temp.toString());

    const addonsInfo = await chatInfoTooltip.getAddonsInfo();
    const addonInfoIcons = await chatInfoTooltip.getAddonIcons();
    expect
      .soft(addonsInfo.length, ExpectedMessages.chatInfoAddonsCountIsValid)
      .toBe(assistantSelectedAddons!.length);

    for (let i = 0; i < assistantSelectedAddons!.length; i++) {
      const addon = allAddons.find((a) => a.id === assistantSelectedAddons![i]);
      expect
        .soft(addonsInfo[i], ExpectedMessages.chatInfoAddonIsValid)
        .toBe(addon!.name);
      expect
        .soft(addonInfoIcons[i], ExpectedMessages.chatInfoAddonIconIsValid)
        .toBe(addon!.iconUrl);
    }
  });
});

test(
  '"Replay as is" icon is changed to model icon after replaying the chat.\n' +
    '"Talk to" item icon is stored in history for previous messages when new model is set',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    chatMessages,
    conversations,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-1322', 'EPMRTC-388');
    let replayConversation: Conversation;
    let conversation: Conversation;
    const firstModel = gpt35Model;
    const secondModel = gpt4Model;
    const conversationModels = [gpt35Model, gpt4Model];

    await test.step('Prepare reply conversation with two different models', async () => {
      conversation =
        conversationData.prepareConversationWithDifferentModels(
          conversationModels,
        );
      conversationData.resetData();

      replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await localStorageManager.setConversationHistory(
        conversation,
        replayConversation,
      );
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    await test.step('Send new request with preselected "Replay as is" option and verify message icons correspond models', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();
      await chat.startReplayForDifferentModels([
        conversation.messages[0].content,
        conversation.messages[2].content,
      ]);

      const firstConversationIcon =
        await chatMessages.getIconAttributesForMessage(2);
      expect
        .soft(
          firstConversationIcon.iconEntity,
          ExpectedMessages.chatIconEntityIsValid,
        )
        .toBe(firstModel!.id);
      expect
        .soft(
          firstConversationIcon.iconUrl,
          ExpectedMessages.chatIconSourceIsValid,
        )
        .toBe(firstModel!.iconUrl);

      const secondConversationIcon =
        await chatMessages.getIconAttributesForMessage(4);
      expect
        .soft(
          secondConversationIcon.iconEntity,
          ExpectedMessages.chatIconEntityIsValid,
        )
        .toBe(secondModel!.id);
      expect
        .soft(
          secondConversationIcon.iconUrl,
          ExpectedMessages.chatIconSourceIsValid,
        )
        .toBe(secondModel!.iconUrl);

      const chatBarConversationIcon =
        await conversations.getConversationIconAttributes(
          ExpectedConstants.replayConversation + conversation.name,
        );
      expect
        .soft(
          chatBarConversationIcon.iconEntity,
          ExpectedMessages.chatBarIconEntityIsValid,
        )
        .toBe(secondModel!.id);
      expect
        .soft(
          chatBarConversationIcon.iconUrl,
          ExpectedMessages.chatBarIconSourceIsValid,
        )
        .toBe(secondModel!.iconUrl);
    });
  },
);
