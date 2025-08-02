import { ChatBody, Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntity, DialAIEntityModel } from '@/chat/types/models';
import { noImportModelsSkipReason } from '@/src/core/baseFixtures';
import dialTest from '@/src/core/dialFixtures';
import {
  API,
  ExpectedConstants,
  ExpectedMessages,
  Import,
  ImportedModelIds,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let allModels: DialAIEntityModel[];
let defaultModel: DialAIEntityModel;
let aModel: DialAIEntityModel;
let bModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  allModels = ModelsUtil.getLatestModels().filter(
    (m) => m.iconUrl != undefined,
  );
  defaultModel = ModelsUtil.getDefaultAgent()!;
  aModel = GeneratorUtil.randomArrayElement(
    allModels.filter(
      (m) => m.id !== defaultModel.id && (m as DialAIEntity).features?.addons,
    ),
  );
  bModel = GeneratorUtil.randomArrayElement(
    allModels.filter((m) => m.id !== defaultModel.id && m.id !== aModel.id),
  );
});

dialTest(
  '[Replay]chat has the same defaults at its parent.\n' +
    '"Replay as is" is selected by default in [Replay]chat.\n' +
    'Publish item is not available in context menu for the chat in Replay mode',
  async ({
    dialHomePage,
    conversationData,
    chat,
    chatAssertion,
    talkToAgentDialog,
    conversationSettingsModal,
    talkToAgentDialogAssertion,
    agentInfo,
    dataInjector,
    conversations,
    setTestIds,
    talkToAgents,
    agentSettingAssertion,
    temperatureSlider,
    addons,
    conversationDropdownMenu,
    conversationDropdownMenuAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-501', 'EPMRTC-1264', 'EPMRTC-3452');
    let replayConversation: Conversation;
    const replayTemp = 0;
    const replayPrompt = 'replay prompt';
    let firstConversation: Conversation;
    let replayConversationName: string;

    await dialTest.step(
      'Prepare two conversation with different settings',
      async () => {
        firstConversation = conversationData.prepareModelConversation(
          0.5,
          'first prompt',
          [],
          bModel,
        );
        conversationData.resetData();

        replayConversation = conversationData.prepareModelConversation(
          replayTemp,
          replayPrompt,
          [],
          aModel,
        );
        await dataInjector.createConversations([
          firstConversation,
          replayConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Open Replay drop-down menu for one conversation',
      async () => {
        const modelUrls = allModels
          .filter(
            (m) =>
              m.id === firstConversation.model.id ||
              m.id === replayConversation.model.id,
          )
          .map((m) => m.iconUrl);
        await dialHomePage.openHomePage({ iconsToBeLoaded: modelUrls });
        await dialHomePage.waitForPageLoaded();
        await conversations.openEntityDropdownMenu(replayConversation!.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay, {
          triggeredHttpMethod: 'POST',
        });
      },
    );

    await dialTest.step(
      'Verify new Replay conversation is created and Replay button appears',
      async () => {
        replayConversationName = `${ExpectedConstants.replayConversation}${replayConversation!.name}`;
        await agentInfo.waitForState();
        expect
          .soft(
            await chat.replay.getElementContent(),
            ExpectedMessages.startReplayVisible,
          )
          .toBe(ExpectedConstants.startReplayLabel);
        await chatAssertion.assertElementState(
          chat.configureSettingsButton,
          'hidden',
        );
      },
    );

    await dialTest.step(
      'Verify "Replay as is" option is selected and has description',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertAgentIsSelected(
          ExpectedConstants.replayAsIsLabel,
        );
        await talkToAgentDialogAssertion.assertElementText(
          talkToAgents.getAgentDescription(ExpectedConstants.replayAsIsLabel),
          ExpectedConstants.replayAsIsDescr,
        );
      },
    );

    await dialTest.step(
      'Select some model and verify it has the same settings as parent model',
      async () => {
        await talkToAgentDialog.selectAgent(defaultModel);
        await chat.configureSettingsButton.click();
        await agentSettingAssertion.assertSystemPromptValue(replayPrompt);

        const newModelTemperature = await temperatureSlider.getTemperature();
        expect
          .soft(newModelTemperature, ExpectedMessages.temperatureIsValid)
          .toBe(replayTemp.toString());

        const newModelSelectedAddons = await addons.getSelectedAddons();
        expect
          .soft(newModelSelectedAddons, ExpectedMessages.selectedAddonsValid)
          .toEqual([]);
        await conversationSettingsModal.applyChangesButton.click();
      },
    );

    await dialTest.step(
      'Verify "Share", "Publish" options are not available in Replay conversation dropdown menu',
      async () => {
        await conversations.openEntityDropdownMenu(replayConversationName);
        await conversationDropdownMenuAssertion.assertMenuExcludesOptions(
          MenuOptions.share,
          MenuOptions.publish,
        );
      },
    );
  },
);

dialTest(
  '[Replay]chat is created in the same folder where its parent is located',
  async ({
    dialHomePage,
    conversationData,
    folderConversations,
    dataInjector,
    setTestIds,
    conversationDropdownMenu,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-503');
    let nestedFolders: FolderInterface[];
    let nestedConversations: Conversation[] = [];
    const nestedLevels = 4;

    await dialTest.step(
      'Prepare 3 levels folders hierarchy with chats inside',
      async () => {
        nestedFolders = conversationData.prepareNestedFolder(nestedLevels);
        nestedConversations =
          conversationData.prepareConversationsForNestedFolders(nestedFolders);
        await dataInjector.createConversations(
          nestedConversations,
          ...nestedFolders,
        );
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Select Replay from drop-down menu for conversations inside 1st and 3rd level folders',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        for (const nestedFolder of nestedFolders) {
          await folderConversations.expandFolder(nestedFolder.name);
        }
        for (let i = 0; i < nestedLevels - 1; i = i + 2) {
          await folderConversations.openFolderEntityDropdownMenu(
            nestedFolders[i + 1].name,
            nestedConversations[i + 1].name,
          );
          await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
        }
      },
    );

    await dialTest.step(
      'Verify new Replay conversations are created inside 1st and 3rd level folders',
      async () => {
        for (let i = 0; i < nestedLevels - 1; i = i + 2) {
          await expect
            .soft(
              folderConversations.getFolderEntity(
                nestedFolders[i + 1].name,
                `${ExpectedConstants.replayConversation}${
                  nestedConversations[i + 1].name
                }`,
              ),
              ExpectedMessages.replayConversationCreated,
            )
            .toBeVisible();
        }
      },
    );
  },
);

dialTest(
  'Start replay with the new Model settings',
  async ({
    dialHomePage,
    conversationData,
    chat,
    talkToAgentDialog,
    conversationSettingsModal,
    localStorageManager,
    dataInjector,
    setTestIds,
    chatHeader,
    agentSettings,
    temperatureSlider,
    modelInfoTooltip,
    errorPopup,
    iconApiHelper,
    chatHeaderAssertion,
    conversations,
  }) => {
    setTestIds('EPMRTC-508');
    const replayTemp = 0;
    const replayPrompt = 'reply the same text';
    const replayModel = GeneratorUtil.randomArrayElement(
      allModels.filter(
        (m) =>
          m.id !== defaultModel.id &&
          ModelsUtil.doesModelAllowSystemPrompt(m) &&
          ModelsUtil.doesModelAllowTemperature(m),
      ),
    );
    const conversation =
      conversationData.prepareDefaultConversation(defaultModel);
    const replayConversation =
      conversationData.prepareDefaultReplayConversation(conversation);

    await dialTest.step('Prepare conversation to replay', async () => {
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setRecentModelsIdsAndUseLastModel(replayModel);
      await localStorageManager.setShowSideBarPanels();
    });

    let replayRequest: ChatBody;
    await dialTest.step(
      'Change model and settings for replay conversation and press Start replay',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(replayConversation.name);
        await chat.changeAgentButton.click();
        await talkToAgentDialog.selectAgent(replayModel);
        await chat.configureSettingsButton.click();
        await agentSettings.setSystemPrompt(replayPrompt);
        await temperatureSlider.setTemperature(replayTemp);
        await conversationSettingsModal.applyChangesButton.click();
        await dialHomePage.throttleAPIResponse(API.chatHost);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        replayRequest = await chat.startReplay();
      },
    );

    await dialTest.step(
      'Verify chat API request is sent with correct settings',
      async () => {
        expect
          .soft(
            replayRequest.model?.id,
            ExpectedMessages.chatRequestModelIsValid,
          )
          .toBe(replayModel.id);
        expect
          .soft(replayRequest.prompt, ExpectedMessages.chatRequestPromptIsValid)
          .toBe(replayPrompt);
        expect
          .soft(
            replayRequest.temperature,
            ExpectedMessages.chatRequestTemperatureIsValid,
          )
          .toBe(replayTemp);
      },
    );

    await dialTest.step(
      'Verify chat header icons are updated with new model and addon',
      async () => {
        await chatHeaderAssertion.assertHeaderIcon(
          iconApiHelper.getEntityIcon(replayModel),
        );
      },
    );

    await dialTest.step(
      'Hover over chat header model and verify chat settings on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await chatHeader.hoverOverChatModel();
        const modelInfo = await modelInfoTooltip.getModelInfo();
        expect
          .soft(modelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(replayModel.name);

        const modelVersionInfo = await modelInfoTooltip.getVersionInfo();
        expect
          .soft(modelVersionInfo, ExpectedMessages.agentVersionIsValid)
          .toBe(replayModel.version);

        //TODO: add setting verification when clarified where to display (TBD: Do we need to show settings icon for replay as is?)
        // const promptInfo = await chatInfoTooltip.getPromptInfo();
        // expect
        //   .soft(promptInfo, ExpectedMessages.chatInfoPromptIsValid)
        //   .toBe(replayPrompt);
        //
        // const tempInfo = await chatInfoTooltip.getTemperatureInfo();
        // expect
        //   .soft(tempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
        //   .toBe(replayTemp.toString());
      },
    );
  },
);

dialTest(
  '"Replay as is" when chat is based on Model.\n' +
    '"Replay as is" when chat is based on Model with addon',
  async ({
    dialHomePage,
    conversationData,
    chat,
    conversations,
    dataInjector,
    setTestIds,
    chatHeader,
    iconApiHelper,
    chatHeaderAssertion,
    modelInfoTooltip,
    errorPopup,
    apiAssertion,
    baseAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1323', 'EPMRTC-1324');
    const replayTemp = 0.8;
    const replayPrompt = 'reply the same text';
    let conversation: Conversation;
    let replayConversation: Conversation;
    const expectedModelIcon = iconApiHelper.getEntityIcon(defaultModel);
    const randomAddon = GeneratorUtil.randomArrayElement(
      ModelsUtil.getAddons(),
    )!;
    const expectedAddonIcon = iconApiHelper.getEntityIcon(randomAddon);

    await dialTest.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareModelConversation(
        replayTemp,
        replayPrompt,
        [randomAddon.id],
        defaultModel,
      );
      replayConversation =
        conversationData.prepareDefaultReplayConversation(conversation);
      await dataInjector.createConversations([
        conversation,
        replayConversation,
      ]);
      await localStorageManager.setShowSideBarPanels();
    });

    let replayRequest: ChatBody;
    await dialTest.step(
      'Replay conversation with "Replay as is" option selected and verify valid request is sent',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [defaultModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(replayConversation.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        replayRequest = await chat.startReplay(
          conversation.messages[0].content,
        );
        apiAssertion.assertRequestModelId(replayRequest, conversation.model);
        apiAssertion.assertRequestPrompt(replayRequest, conversation.prompt);
        apiAssertion.assertRequestTemperature(
          replayRequest,
          conversation.temperature,
        );
      },
    );

    await dialTest.step(
      'Verify chat header icons are the same as initial model',
      async () => {
        await chatHeaderAssertion.assertHeaderIcon(expectedModelIcon);
        await chatHeaderAssertion.assertHeaderAddonIcon([expectedAddonIcon]);
      },
    );

    await dialTest.step(
      'Hover over chat header model and verify chat settings on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await chatHeader.hoverOverChatModel();
        const modelInfo = await modelInfoTooltip.getModelInfo();
        baseAssertion.assertValue(
          modelInfo,
          defaultModel.name,
          ExpectedMessages.chatInfoModelIsValid,
        );
        const modelVersionInfo = await modelInfoTooltip.getVersionInfo();
        baseAssertion.assertValue(
          modelVersionInfo,
          defaultModel.version!,
          ExpectedMessages.agentVersionIsValid,
        );
      },
    );
  },
);

dialTest(
  '"Replay as is" icon is changed to model icon after replaying the chat.\n' +
    '"Talk to" item icon is stored in history for previous messages when new model is set.\n' +
    '"Replay as is" works fine with different message settings one by one',
  async ({
    dialHomePage,
    conversationData,
    chat,
    conversations,
    dataInjector,
    conversationAssertion,
    apiAssertion,
    iconApiHelper,
    chatMessagesAssertion,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1322', 'EPMRTC-388', 'EPMRTC-1466');
    let replayConversation: Conversation;
    let simpleConversation: Conversation;
    let addonConversation: Conversation;
    let historyConversation: Conversation;
    const simpleModel = defaultModel;
    const simpleTemp = 0.5;
    const simplePrompt = 'simple prompt';
    const addonModel = aModel;
    const addons = ModelsUtil.getAddons();

    await dialTest.step(
      'Prepare reply conversation for different models with different settings',
      async () => {
        simpleConversation = conversationData.prepareModelConversation(
          simpleTemp,
          simplePrompt,
          [],
          simpleModel,
        );
        conversationData.resetData();
        addonConversation =
          addons.length !== 0
            ? conversationData.prepareAddonsConversation(addonModel, [
                GeneratorUtil.randomArrayElement(addons).id,
              ])
            : conversationData.prepareDefaultConversation(addonModel);
        conversationData.resetData();
        historyConversation = conversationData.prepareHistoryConversation(
          simpleConversation,
          addonConversation,
        );
        conversationData.resetData();
        replayConversation =
          conversationData.prepareDefaultReplayConversation(
            historyConversation,
          );
        await dataInjector.createConversations([
          historyConversation,
          replayConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Replay chat and verify message icons and settings correspond models',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(replayConversation.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        const replayRequests = await chat.startReplayForDifferentModels();

        apiAssertion.assertRequestModelId(replayRequests[0], simpleModel);
        apiAssertion.assertRequestTemperature(replayRequests[0], simpleTemp);
        apiAssertion.assertRequestPrompt(replayRequests[0], simplePrompt);
        apiAssertion.assertRequestAddons(
          replayRequests[0],
          simpleConversation.selectedAddons,
        );

        apiAssertion.assertRequestModelId(replayRequests[1], addonModel);
        apiAssertion.assertRequestTemperature(
          replayRequests[1],
          addonConversation.temperature,
        );
        apiAssertion.assertRequestPrompt(
          replayRequests[1],
          addonConversation.prompt,
        );
        apiAssertion.assertRequestAddons(
          replayRequests[1],
          addonConversation.selectedAddons,
        );

        const expectedSimpleModelIcon =
          iconApiHelper.getEntityIcon(simpleModel);
        await chatMessagesAssertion.assertMessageIcon(
          2,
          expectedSimpleModelIcon,
        );
        const expectedAddonModelIcon = iconApiHelper.getEntityIcon(addonModel);
        await chatMessagesAssertion.assertMessageIcon(
          4,
          expectedAddonModelIcon,
        );
        await conversationAssertion.assertTreeEntityIcon(
          {
            name:
              ExpectedConstants.replayConversation + historyConversation.name,
          },
          expectedAddonModelIcon,
        );
      },
    );
  },
);

dialTest(
  'Replay function is still available if the name was edited.\n' +
    'Start replay works in  renamed [Replay]chat.\n' +
    'Regenerate response in already replayed chat.\n' +
    'Continue conversation in already replayed chat',
  async ({
    dialHomePage,
    conversationData,
    chat,
    chatAssertion,
    conversations,
    conversationAssertion,
    dataInjector,
    chatMessages,
    chatMessagesAssertion,
    setTestIds,
    conversationDropdownMenu,
    renameConversationModal,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-505', 'EPMRTC-506', 'EPMRTC-515', 'EPMRTC-516');
    let conversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Prepare conversation to replay with updated name',
      async () => {
        conversation = conversationData.prepareModelConversationBasedOnRequests(
          ['1+2'],
        );
        replayConversation =
          conversationData.prepareDefaultReplayConversation(conversation);
        await dataInjector.createConversations([
          conversation,
          replayConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Rename the replay conversation and verify "Start Replay" button is available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(replayConversation.name);
        await conversationAssertion.assertSelectedEntity(
          replayConversation.name,
        );
        await chat.replay.waitForState();
        await conversations.openEntityDropdownMenu(replayConversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        replayConversation.name = GeneratorUtil.randomString(7);
        await renameConversationModal.editConversationNameWithSaveButton(
          replayConversation.name,
        );

        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chatAssertion.assertElementActionabilityState(
          chat.replay,
          'enabled',
        );
      },
    );

    await dialTest.step(
      'Start replaying and verify replaying is in progress',
      async () => {
        const replayRequest = await chat.startReplay(
          conversation.messages[0].content,
          true,
        );
        chatAssertion.assertValue(
          replayRequest.model.id,
          conversation.model.id,
          ExpectedMessages.chatRequestModelIsValid,
        );
      },
    );

    await dialTest.step(
      'Regenerate response and verify it regenerated',
      async () => {
        await chatMessages.regenerateResponse();
        await chatMessagesAssertion.assertMessagesCount(
          conversation.messages.length,
        );
      },
    );

    await dialTest.step(
      'Send a new message to chat and verify response received',
      async () => {
        const newMessage = '2+3';
        const newRequest = await chat.sendRequestWithButton(newMessage);
        chatAssertion.assertValue(
          newRequest.model.id,
          conversation.model.id,
          ExpectedMessages.chatRequestModelIsValid,
        );
        chatAssertion.assertValue(
          newRequest.messages[2].content,
          newMessage,
          ExpectedMessages.chatRequestMessageIsValid,
        );
      },
    );
  },
);

dialTest(
  `"Replay as is" when restricted Model is used in parent chat.\n` +
    'Replay: not allowed model is now shown in Talk to recent models',
  async ({
    dialHomePage,
    conversationData,
    chat,
    agentInfo,
    agentInfoAssertion,
    conversations,
    dataInjector,
    chatAssertion,
    apiAssertion,
    talkToAgentDialog,
    talkToAgentDialogAssertion,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-1328', 'EPMRTC-2839');
    let notAllowedModelConversation: Conversation;
    let replayConversation: Conversation;
    const notAllowedModel = 'not_allowed_model';

    await dialTest.step(
      'Prepare conversation with not allowed model and replay for it',
      async () => {
        notAllowedModelConversation =
          conversationData.prepareDefaultConversation(notAllowedModel);
        replayConversation = conversationData.prepareDefaultReplayConversation(
          notAllowedModelConversation,
        );
        await dataInjector.createConversations([
          notAllowedModelConversation,
          replayConversation,
        ]);
        await localStorageManager.setShowSideBarPanels();
      },
    );

    await dialTest.step(
      'Verify "Start Replay" button is not displayed, error is shown at the bottom',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(replayConversation.name);
        await agentInfoAssertion.assertElementText(
          agentInfo.agentName,
          ExpectedConstants.replayAsIsLabel,
        );
        //TODO: add conversation screen verification when fixed https://github.com/epam/ai-dial-chat/issues/2697
        await chatAssertion.assertReplayButtonState('hidden');
        await chatAssertion.assertNotAllowedModelLabelContent(notAllowedModel);
      },
    );

    await dialTest.step('Verify "Replay as is" is selected', async () => {
      await chat.changeAgentButton.click();
      await talkToAgentDialogAssertion.assertAgentIsSelected(
        ExpectedConstants.replayAsIsLabel,
      );
    });

    await dialTest.step(
      'Select any available model and start replaying',
      async () => {
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await talkToAgentDialog.selectAgent(defaultModel);
        const replayRequest = await chat.startReplay();
        apiAssertion.assertRequestModelId(replayRequest, defaultModel);
      },
    );
  },
);

dialTest(
  `"Replay as is" in chat from 1.4 milestone.\n` +
    `"Replay as is" in chat from 1.9 milestone`,
  async ({
    dialHomePage,
    chatBar,
    setTestIds,
    folderConversations,
    conversationDropdownMenu,
    agentInfo,
    chat,
    chatHeader,
    talkToAgentDialog,
    conversations,
    localStorageManager,
  }) => {
    dialTest.skip(
      [
        ImportedModelIds.GPT_3_5_TURBO,
        ImportedModelIds.GPT_4_O,
        ImportedModelIds.CHAT_BISON,
      ].some(
        (modelId) =>
          !ModelsUtil.getOpenAIEntities()
            .map((e) => e.id)
            .includes(modelId),
      ),
      noImportModelsSkipReason,
    );
    setTestIds('EPMRTC-1330', 'EPMRTC-1332');
    const filename = GeneratorUtil.randomArrayElement([
      Import.v14AppImportedFilename,
      Import.v19AppImportedFilename,
    ]);
    const newModels = [ImportedModelIds.CHAT_BISON, ImportedModelIds.GPT_4_O];

    await dialTest.step(
      'Import conversation from old app version and send two new messages based on Titan and gpt-4o models',
      async () => {
        await localStorageManager.setRecentModelsIdsAndUseLastModel(
          ...newModels.map((m) => ModelsUtil.getModel(m)!),
        );
        await localStorageManager.setShowSideBarPanels();
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await dialHomePage.importFile({ path: filename }, () =>
          chatBar.importButton.click(),
        );
        await conversations
          .getEntityByName(ExpectedConstants.newConversationTitle)
          .waitFor();
        await folderConversations
          .getFolderEntity(
            Import.oldVersionAppFolderName,
            Import.oldVersionAppFolderChatName,
          )
          .waitFor();

        for (let i = 1; i <= newModels.length; i++) {
          await dialHomePage.mockChatTextResponse(
            MockedChatApiResponseBodies.simpleTextBody,
          );
          const newModel = ModelsUtil.getModel(newModels[i - 1])!;
          await chatHeader.chatAgent.click();
          await talkToAgentDialog.selectAgent(newModel);
          const newMessage = `${i}*2=`;
          await chat.sendRequestWithButton(newMessage);
        }
      },
    );

    await dialTest.step(
      'Create replay conversation based on imported',
      async () => {
        await folderConversations.openFolderEntityDropdownMenu(
          Import.oldVersionAppFolderName,
          Import.oldVersionAppFolderChatName,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay);
        await agentInfo.waitForState();
      },
    );

    await dialTest.step(
      'Start replaying and verify old requests are replayed using gpt-4o model',
      async () => {
        const requests = await chat.startReplayForDifferentModels();
        for (let i = 0; i < requests.length; i++) {
          const modelId =
            i === 1 ? ImportedModelIds.CHAT_BISON : ImportedModelIds.GPT_4_O;
          expect
            .soft(
              requests[i].model.id,
              ExpectedMessages.chatRequestModelIsValid,
            )
            .toBe(modelId);
        }
      },
    );
  },
);

dialTest(
  'Replay feature does not exist in menu if all the messages were cleared in the chat',
  async ({
    dialHomePage,
    conversationData,
    dataInjector,
    conversations,
    conversationDropdownMenu,
    setTestIds,
    localStorageManager,
  }) => {
    setTestIds('EPMRTC-500');
    let conversation: Conversation;

    await dialTest.step('Prepare empty conversation', async () => {
      conversation = conversationData.prepareEmptyConversation();
      await dataInjector.createConversations([conversation]);
      await localStorageManager.setShowSideBarPanels();
    });

    await dialTest.step(
      'Open conversation dropdown menu and verify no "Replay" option available',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectEntity(conversation.name);
        await conversations.openEntityDropdownMenu(conversation!.name);
        const menuOptions = await conversationDropdownMenu.getAllMenuOptions();
        expect
          .soft(menuOptions, ExpectedMessages.contextMenuOptionsValid)
          .not.toContain(MenuOptions.replay);
      },
    );
  },
);
