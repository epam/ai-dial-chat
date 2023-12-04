import { ChatBody, Conversation } from '@/src/types/chat';
import { FolderInterface } from '@/src/types/folder';
import { OpenAIEntityModel } from '@/src/types/openai';

import test from '@/e2e/src/core/fixtures';
import {
  ExpectedConstants,
  ExpectedMessages,
  Import,
  MenuOptions,
  ModelIds,
} from '@/e2e/src/testData';
import { Colors, Styles } from '@/e2e/src/ui/domData';
import { GeneratorUtil, ModelsUtil } from '@/e2e/src/utils';
import { expect } from '@playwright/test';

let allModels: OpenAIEntityModel[];
let gpt35Model: OpenAIEntityModel;
let gpt4Model: OpenAIEntityModel;
let bison: OpenAIEntityModel;

test.beforeAll(async () => {
  allModels = ModelsUtil.getModels().filter((m) => m.iconUrl != undefined);
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
    let firstConversation: Conversation;

    await test.step('Prepare two conversation with different settings', async () => {
      firstConversation = conversationData.prepareModelConversation(
        0.5,
        'first prompt',
        [],
        bison,
      );
      conversationData.resetData();

      replayConversation = conversationData.prepareModelConversation(
        replayTemp,
        replayPrompt,
        [],
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
        .toEqual([]);
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
  let nestedFolders: FolderInterface[];
  let nestedConversations: Conversation[] = [];
  const nestedLevels = 3;

  await test.step('Prepare 3 levels folders hierarchy with chats inside', async () => {
    nestedFolders = conversationData.prepareNestedFolder(nestedLevels);
    nestedConversations =
      conversationData.prepareConversationsForNestedFolders(nestedFolders);
    await localStorageManager.setFolders(...nestedFolders);
    await localStorageManager.setOpenedFolders(...nestedFolders);
    await localStorageManager.setConversationHistory(...nestedConversations);
  });

  await test.step('Select Replay from drop-down menu for conversations inside 1st and 3rd level folders', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });

    for (let i = 0; i < nestedLevels; i = i + 2) {
      await folderConversations.openFolderConversationDropdownMenu(
        nestedFolders[i + 1].name,
        nestedConversations[i + 1].name,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
    }
  });

  await test.step('Verify new Replay conversations are created inside 1st and 3rd level folders', async () => {
    for (let i = 0; i < nestedLevels; i = i + 2) {
      await folderConversations.getFolderConversation(
        nestedFolders[i + 1].name,
        `${ExpectedConstants.replayConversation}${
          nestedConversations[i + 1].name
        }`,
      ).waitFor;
    }
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
  talkToSelector,
  chatInfoTooltip,
  errorPopup,
}) => {
  setTestIds('EPMRTC-508');
  const replayTemp = 0;
  const replayPrompt = 'reply the same text';
  const replayModel = bison;

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
  await test.step('Change model and settings for replay conversation and press Start replay', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await talkToSelector.selectModel(bison.name);
    await entitySettings.setSystemPrompt(replayPrompt);
    await temperatureSlider.setTemperature(replayTemp);
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
  });

  await test.step('Verify chat header icons are updated with new model and addon', async () => {
    const headerIcons = await chatHeader.getHeaderIcons();
    expect
      .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
      .toBe(1);
    expect
      .soft(headerIcons[0].iconEntity, ExpectedMessages.headerIconEntityIsValid)
      .toBe(bison.id);
    expect
      .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
      .toBe(replayModel!.iconUrl);
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
      gpt35Model,
      [userRequest],
    );
    const replayConversation =
      conversationData.preparePartiallyReplayedConversation(conversation);
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
      conversation = conversationData.prepareDefaultConversation(gpt35Model);
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
  }) => {
    setTestIds('EPMRTC-1323', 'EPMRTC-1324');
    const replayTemp = 0.8;
    const replayPrompt = 'reply the same text';
    let conversation: Conversation;
    const replayModel = gpt35Model;

    await test.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareModelConversation(
        replayTemp,
        replayPrompt,
        [],
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
    });

    await test.step('Verify chat header icons are the same as initial model', async () => {
      const headerIcons = await chatHeader.getHeaderIcons();
      expect
        .soft(headerIcons.length, ExpectedMessages.headerIconsCountIsValid)
        .toBe(1);
      expect
        .soft(
          headerIcons[0].iconEntity,
          ExpectedMessages.headerIconEntityIsValid,
        )
        .toBe(conversation.model.id);
      expect
        .soft(headerIcons[0].iconUrl, ExpectedMessages.headerIconSourceIsValid)
        .toBe(replayModel!.iconUrl);
    });

    await test.step('Hover over chat header model and verify chat settings on tooltip', async () => {
      await errorPopup.cancelPopup();
      await chatHeader.chatModel.hoverOver();
      const modelInfo = await chatInfoTooltip.getModelInfo();
      expect
        .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
        .toBe(ModelsUtil.getModel(conversation.model.id)!.name);

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
    });
  },
);

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

test('Send button is disabled if the chat in replay mode', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
  sendMessage,
  tooltip,
  context,
  chatMessages,
}) => {
  setTestIds('EPMRTC-1535');
  const message = GeneratorUtil.randomString(10);

  await test.step('Prepare conversation to replay', async () => {
    const requests: string[] = [];
    for (let i = 1; i <= 10; i++) {
      requests.push(GeneratorUtil.randomString(200));
    }
    const conversation =
      conversationData.prepareModelConversationBasedOnRequests(
        gpt35Model,
        requests,
      );
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  await test.step('Type new message while chat is replaying and verify Send button is disabled', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await chat.startReplay();
    await sendMessage.messageInput.fillInInput(message);

    await sendMessage.sendMessageButton.hoverOver();
    const tooltipContent = await tooltip.getContent();
    expect
      .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
      .toBe(ExpectedConstants.waitForAssistantAnswerTooltip);

    const isSendButtonEnabled =
      await sendMessage.sendMessageButton.isElementEnabled();
    expect
      .soft(isSendButtonEnabled, ExpectedMessages.sendMessageButtonDisabled)
      .toBeFalsy();
  });

  await test.step('Stop generating and verify message is preserved, footer is visible and tooltip shown on hover', async () => {
    await chat.stopGenerating.click();
    const inputMessage = await sendMessage.messageInput.getElementContent();
    expect
      .soft(inputMessage, ExpectedMessages.messageContentIsValid)
      .toBe(message);

    await sendMessage.sendMessageButton.hoverOver();
    const tooltipContent = await tooltip.getContent();
    expect
      .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
      .toBe(ExpectedConstants.proceedReplayTooltip);

    await chat.footer.waitForState({ state: 'attached' });
  });

  await test.step('Continue replaying, refresh page and verify error appears for the least response, message is preserved, footer is visible and tooltip shown on hover', async () => {
    await context.setOffline(true);
    await chat.proceedReplaying();

    const generatedContent = await chatMessages.getLastMessageContent();
    expect
      .soft(generatedContent, ExpectedMessages.errorReceivedOnReplay)
      .toBe(ExpectedConstants.answerError);

    const inputMessage = await sendMessage.messageInput.getElementContent();
    expect
      .soft(inputMessage, ExpectedMessages.messageContentIsValid)
      .toBe(message);

    await sendMessage.sendMessageButton.hoverOver();
    const tooltipContent = await tooltip.getContent();
    expect
      .soft(tooltipContent, ExpectedMessages.tooltipContentIsValid)
      .toBe(ExpectedConstants.proceedReplayTooltip);

    await chat.footer.waitForState({ state: 'attached' });
  });
});

test(
  'Replay function is still available if the name was edited.\n' +
    'Start replay works in  renamed [Replay]chat.\n' +
    'Regenerate response in already replayed chat.\n' +
    'Continue conversation in already replayed chat',
  async ({
    dialHomePage,
    conversationData,
    chat,
    localStorageManager,
    chatMessages,
    setTestIds,
  }) => {
    setTestIds('EPMRTC-505', 'EPMRTC-506', 'EPMRTC-515', 'EPMRTC-516');
    let conversation: Conversation;

    await test.step('Prepare conversation to replay with updated name', async () => {
      conversation = conversationData.prepareModelConversationBasedOnRequests(
        gpt35Model,
        ['1+2='],
      );
      const replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      replayConversation.name = GeneratorUtil.randomString(7);
      await localStorageManager.setConversationHistory(
        conversation,
        replayConversation,
      );
      await localStorageManager.setSelectedConversation(replayConversation);
    });

    await test.step('Verify "Start Replay" button is available', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded();

      const isStartReplayEnabled = await chat.replay.isElementEnabled();
      expect
        .soft(isStartReplayEnabled, ExpectedMessages.startReplayVisible)
        .toBeTruthy();
    });

    await test.step('Start replaying and verify replaying is in progress', async () => {
      const replayRequest = await chat.startReplay(
        conversation.messages[0].content,
        true,
      );
      expect
        .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
        .toBe(conversation.model.id);
    });

    await test.step('Regenerate response and verify it regenerated', async () => {
      await chat.regenerateResponse();
      const messagesCount = await chatMessages.chatMessages.getElementsCount();
      expect
        .soft(messagesCount, ExpectedMessages.messageCountIsCorrect)
        .toBe(conversation.messages.length);
    });

    await test.step('Send a new message to chat and verify response received', async () => {
      const newMessage = '2+3=';
      const newRequest = await chat.sendRequestWithButton(newMessage);
      expect
        .soft(newRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
        .toBe(conversation.model.id);
      expect
        .soft(
          newRequest.messages[2].content,
          ExpectedMessages.chatRequestMessageIsValid,
        )
        .toBe(newMessage);
    });
  },
);

test('Start replay button appears in [Replay]chat if the parent chat has error in the response', async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1312');
  let errorConversation: Conversation;

  await test.step('Prepare errorConversation with error response and replay errorConversation', async () => {
    errorConversation =
      conversationData.prepareErrorResponseConversation(gpt35Model);
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(errorConversation);
    await localStorageManager.setConversationHistory(
      errorConversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  await test.step('Verify "Start Replay" button is available', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();

    const isStartReplayEnabled = await chat.replay.isElementEnabled();
    expect
      .soft(isStartReplayEnabled, ExpectedMessages.startReplayVisible)
      .toBeTruthy();
  });
});

test(`"Replay as is" when restricted Model is used in parent chat`, async ({
  dialHomePage,
  conversationData,
  chat,
  localStorageManager,
  talkToSelector,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1328');
  let notAllowedModelConversation: Conversation;

  await test.step('Prepare conversation with not allowed model and replay for it', async () => {
    notAllowedModelConversation =
      conversationData.prepareDefaultConversation('not_allowed_model');
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(
        notAllowedModelConversation,
      );
    await localStorageManager.setConversationHistory(
      notAllowedModelConversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  await test.step('Verify "Start Replay" button is not displayed, error is shown at the bottom', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await talkToSelector.waitForState({ state: 'attached' });

    const isStartReplayVisible = await chat.replay.isVisible();
    expect
      .soft(isStartReplayVisible, ExpectedMessages.startReplayNotVisible)
      .toBeFalsy();

    const notAllowedModelError =
      await chat.notAllowedModelLabel.getElementContent();
    expect
      .soft(
        notAllowedModelError!.trim(),
        ExpectedMessages.notAllowedModelErrorDisplayed,
      )
      .toBe(ExpectedConstants.notAllowedModelError);
  });

  await test.step('Select any available model and start replaying', async () => {
    await talkToSelector.selectModel(gpt35Model.name);
    const replayRequest = await chat.startReplay();
    expect
      .soft(replayRequest.modelId, ExpectedMessages.chatRequestModelIsValid)
      .toBe(gpt35Model.id);
  });
});

test(
  `"Replay as is" in chat from 1.4 milestone.\n` +
    `"Replay as is" in chat from 1.9 milestone`,
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    folderConversations,
    conversationDropdownMenu,
    chat,
    chatHeader,
    talkToSelector,
    replayAsIs,
  }) => {
    setTestIds('EPMRTC-1330', 'EPMRTC-1332');
    const newMessages: string[] = [];
    const filename = GeneratorUtil.randomArrayElement([
      Import.v14AppImportedFilename,
      Import.v19AppImportedFilename,
    ]);

    await test.step('Import conversation from old app version and send two new messages based on Titan and gpt-4 models', async () => {
      await dialHomePage.openHomePage();
      await dialHomePage.waitForPageLoaded({ isNewConversationVisible: true });
      await dialHomePage.uploadData({ path: filename }, () =>
        chatBar.importButton.click(),
      );
      await folderConversations.expandCollapseFolder(
        Import.oldVersionAppFolderName,
      );
      await folderConversations.selectFolderConversation(
        Import.oldVersionAppFolderName,
        Import.oldVersionAppFolderChatName,
      );

      const newModels = [ModelIds.BISON_001, ModelIds.GPT_4];
      for (let i = 1; i <= newModels.length; i++) {
        await chatHeader.openConversationSettings.click();
        await talkToSelector.selectModel(
          ModelsUtil.getModel(newModels[i - 1])!.name,
        );
        await chat.applyChanges().click();
        const newMessage = `${i}*2=`;
        newMessages.push(newMessage);
        await chat.sendRequestWithButton(newMessage);
      }
    });

    await test.step('Create replay conversation based on imported and verify warning message is displayed under "Replay as is" icon', async () => {
      await folderConversations.openFolderConversationDropdownMenu(
        Import.oldVersionAppFolderName,
        Import.oldVersionAppFolderChatName,
      );
      await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);

      const replayAsIsDescr =
        await replayAsIs.replayAsIsDescr.getElementContent();
      expect
        .soft(replayAsIsDescr, ExpectedMessages.replayAsIsDescriptionIsVisible)
        .toBe(ExpectedConstants.replayAsIsDescr);

      const replayOldVersionWarningText =
        await replayAsIs.replayOldVersionWarning.getElementContent();
      expect
        .soft(
          replayOldVersionWarningText,
          ExpectedMessages.replayOldVersionWarningIsVisible,
        )
        .toBe(ExpectedConstants.replayOldVersionWarning);

      const warningColor =
        await replayAsIs.replayOldVersionWarning.getComputedStyleProperty(
          Styles.color,
        );
      expect
        .soft(warningColor[0], ExpectedMessages.warningLabelColorIsValid)
        .toBe(Colors.warningLabel);
    });

    await test.step('Start replaying and verify old requests are replayed using gpt-4 model', async () => {
      const requests = await chat.startReplayForDifferentModels([
        Import.oldVersionAppGpt35Message,
        ...newMessages,
      ]);
      for (let i = 0; i < requests.length; i++) {
        const modelId = i === 1 ? ModelIds.BISON_001 : ModelIds.GPT_4;
        expect
          .soft(requests[i].modelId, ExpectedMessages.chatRequestModelIsValid)
          .toBe(modelId);
      }
    });
  },
);

test('Replay feature does not exist in menu if all the messages were cleared in the chat', async ({
  dialHomePage,
  conversationData,
  localStorageManager,
  conversations,
  conversationDropdownMenu,
  setTestIds,
}) => {
  setTestIds('EPMRTC-500');
  let conversation: Conversation;

  await test.step('Prepare empty conversation', async () => {
    conversation = conversationData.prepareEmptyConversation();
    await localStorageManager.setConversationHistory(conversation);
    await localStorageManager.setSelectedConversation(conversation);
  });

  await test.step('Open conversation dropdown menu and verify no "Replay" option available', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await conversations.openConversationDropdownMenu(conversation!.name);
    const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
    expect
      .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
      .not.toContain(MenuOptions.replay);
  });
});

test('Chat is in replay mode if while replaying to clear all messages', async ({
  dialHomePage,
  conversationData,
  localStorageManager,
  chat,
  chatHeader,
  replayAsIs,
  setTestIds,
}) => {
  setTestIds('EPMRTC-1542');
  let conversation: Conversation;

  await test.step('Prepare partially replayed conversation', async () => {
    conversation = conversationData.prepareConversationWithDifferentModels([
      gpt35Model,
      bison,
      gpt4Model,
    ]);
    const replayConversation =
      conversationData.preparePartiallyReplayedConversation(conversation);
    await localStorageManager.setConversationHistory(
      conversation,
      replayConversation,
    );
    await localStorageManager.setSelectedConversation(replayConversation);
  });

  await test.step('Clear conversation messages and verify "Replay As Is" option, "Start replay" button are available, ', async () => {
    await dialHomePage.openHomePage();
    await dialHomePage.waitForPageLoaded();
    await dialHomePage.acceptBrowserDialog(
      ExpectedConstants.clearAllConversationsAlert,
    );
    await chatHeader.clearConversation.click();

    const isStartReplayEnabled = await chat.replay.isElementEnabled();
    expect
      .soft(isStartReplayEnabled, ExpectedMessages.startReplayVisible)
      .toBeTruthy();

    const replayLabel = await replayAsIs.getReplayAsIsLabelText();
    expect
      .soft(replayLabel, ExpectedMessages.replayAsIsLabelIsVisible)
      .toBe(ExpectedConstants.replayAsIsLabel);
  });
});
