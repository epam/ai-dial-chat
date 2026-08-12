import { ChatBody, Conversation } from '@/chat/types/chat';
import { FolderInterface } from '@/chat/types/folder';
import { DialAIEntityModel } from '@/chat/types/models';
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
      (m) => m.id !== defaultModel.id && m.features?.temperature === true,
    ),
  );
  bModel = GeneratorUtil.randomArrayElement(
    allModels.filter(
      (m) =>
        m.id !== defaultModel.id &&
        m.id !== aModel.id &&
        m.features?.temperature === true &&
        m.features?.systemPrompt,
    ),
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
    conversationDropdownMenu,
    conversationDropdownMenuAssertion,
    localStorageManager,
  }) => {
    setTestIds('EPMDIAL-6295', 'EPMDIAL-6292', 'EPMDIAL-3104');
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
          bModel,
        );
        conversationData.resetData();

        replayConversation = conversationData.prepareModelConversation(
          replayTemp,
          replayPrompt,
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
          talkToAgents.getEntityDescription(ExpectedConstants.replayAsIsLabel),
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
        // settings above are only verified, not changed — no PUT is
        // guaranteed to fire
        await conversationSettingsModal.applyChanges({
          waitForUpdate: false,
        });
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
    setTestIds('EPMDIAL-6296');
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
    setTestIds('EPMDIAL-6302');
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
        await conversationSettingsModal.applyChanges();
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
      'Verify chat header icons are updated with new model',
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
  '"Replay as is" when chat is based on Model',
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
    setTestIds('EPMDIAL-6311');
    const replayTemp = 0.8;
    const replayPrompt = 'reply the same text';
    let conversation: Conversation;
    let replayConversation: Conversation;
    const expectedModelIcon = iconApiHelper.getEntityIcon(defaultModel);

    await dialTest.step('Prepare conversation to replay', async () => {
      conversation = conversationData.prepareModelConversation(
        replayTemp,
        replayPrompt,
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
    setTestIds('EPMDIAL-6294', 'EPMDIAL-7285', 'EPMDIAL-6318');
    let replayConversation: Conversation;
    let simpleFirstConversation: Conversation;
    let simpleSecondConversation: Conversation;
    let historyConversation: Conversation;
    const simpleTemp = 0.5;
    const simplePrompt = 'simple prompt';

    await dialTest.step(
      'Prepare reply conversation for different models with different settings',
      async () => {
        simpleFirstConversation = conversationData.prepareModelConversation(
          simpleTemp,
          simplePrompt,
          bModel,
        );
        conversationData.resetData();
        simpleSecondConversation =
          conversationData.prepareDefaultConversation(aModel);
        conversationData.resetData();
        historyConversation = conversationData.prepareHistoryConversation(
          simpleFirstConversation,
          simpleSecondConversation,
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
        const { actionResult: replayRequests } =
          await dialHomePage.waitForExpectedResponses(
            () => chat.startReplayForDifferentModels(),
            [
              {
                apiMethod: 'POST',
                urlPattern: API.moveHost,
              },
            ],
          );
        apiAssertion.assertRequestModelId(replayRequests[0], bModel);
        apiAssertion.assertRequestTemperature(replayRequests[0], simpleTemp);
        apiAssertion.assertRequestPrompt(replayRequests[0], simplePrompt);

        apiAssertion.assertRequestModelId(replayRequests[1], aModel);
        apiAssertion.assertRequestTemperature(
          replayRequests[1],
          simpleSecondConversation.temperature,
        );
        apiAssertion.assertRequestPrompt(
          replayRequests[1],
          aModel.features?.systemPrompt === true
            ? simpleSecondConversation.prompt
            : undefined,
        );

        const expectedSimpleModelIcon = iconApiHelper.getEntityIcon(bModel);
        await chatMessagesAssertion.assertMessageIcon(
          2,
          expectedSimpleModelIcon,
        );
        const expectedSecondModelIcon = iconApiHelper.getEntityIcon(aModel);
        await chatMessagesAssertion.assertMessageIcon(
          4,
          expectedSecondModelIcon,
        );
        await conversationAssertion.assertTreeEntityIcon(
          {
            name:
              ExpectedConstants.replayConversation + historyConversation.name,
          },
          expectedSecondModelIcon,
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
    setTestIds('EPMDIAL-6298', 'EPMDIAL-6299', 'EPMDIAL-6309', 'EPMDIAL-6310');
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
        const newRequests = await chat.sendRequestWithButton(newMessage);
        chatAssertion.assertValue(
          newRequests.completionRequest.model.id,
          conversation.model.id,
          ExpectedMessages.chatRequestModelIsValid,
        );
        chatAssertion.assertValue(
          newRequests.completionRequest.messages[2].content,
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
    sendMessage,
    sendMessageAssertion,
    talkToAgents,
  }) => {
    setTestIds('EPMDIAL-6376', 'EPMDIAL-6377');
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
        await agentInfoAssertion.assertShortDescription(
          ExpectedConstants.replayAsIsDescr,
        );
        await sendMessageAssertion.assertElementState(
          sendMessage.messageInput,
          'hidden',
        );
        await chatAssertion.assertReplayButtonState('hidden');
        await chatAssertion.assertNotAllowedModelLabelContent(notAllowedModel);
      },
    );

    await dialTest.step(
      'Verify "Replay as is" is selected and stays at the first place',
      async () => {
        await chat.changeAgentButton.click();
        await talkToAgentDialogAssertion.assertAgentIsSelected(
          ExpectedConstants.replayAsIsLabel,
        );
        const actualAgentNames = await talkToAgents.getEntityNames();
        talkToAgentDialogAssertion.assertValue(
          actualAgentNames[0],
          ExpectedConstants.replayAsIsLabel,
        );
        const replayAsIsModelElement = talkToAgents.getEntity(
          ExpectedConstants.replayAsIsLabel,
        );
        const replayAsIsDescrElement = talkToAgents.getEntityDescription(
          replayAsIsModelElement,
        );
        await talkToAgentDialogAssertion.assertElementText(
          replayAsIsDescrElement,
          ExpectedConstants.replayAsIsDescr,
        );
      },
    );

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
    setTestIds('EPMDIAL-6315', 'EPMDIAL-6316');
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
    setTestIds('EPMDIAL-6291');
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
