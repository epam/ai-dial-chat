import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import dialTest from '@/src/core/dialFixtures';
import { ExpectedMessages, MenuOptions, ModelIds, Side } from '@/src/testData';
import { keys } from '@/src/ui/keyboard';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';
import { expect } from '@playwright/test';

let defaultModel: DialAIEntityModel;
let gpt4Model: DialAIEntityModel;

dialTest.beforeAll(async () => {
  defaultModel = ModelsUtil.getDefaultModel()!;
  gpt4Model = ModelsUtil.getModel(ModelIds.GPT_4)!;
});

dialTest(
  'Apply changes with new settings for both chats in compare mode and check chat headers',
  async ({
    dialHomePage,
    chat,
    setTestIds,
    conversationData,
    dataInjector,
    localStorageManager,
    leftChatHeader,
    rightChatHeader,
    rightConversationSettings,
    leftConversationSettings,
    conversations,
    chatInfoTooltip,
    errorPopup,
    iconApiHelper,
  }) => {
    dialTest.slow();
    setTestIds('EPMRTC-1021');
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const models = ModelsUtil.getLatestModels();
    const initRandomModel = GeneratorUtil.randomArrayElement(models);
    const modelsForUpdate = models.filter((m) => m !== initRandomModel);
    const firstUpdatedRandomModel =
      GeneratorUtil.randomArrayElement(modelsForUpdate);
    const secondUpdatedRandomModel = GeneratorUtil.randomArrayElement(
      modelsForUpdate.filter((m) => m !== firstUpdatedRandomModel),
    );
    const firstUpdatedPrompt = 'first prompt';
    const secondUpdatedPrompt = 'second prompt';
    const firstUpdatedTemp = 0.5;
    const secondUpdatedTemp = 0;
    const expectedSecondUpdatedRandomModelIcon =
      await iconApiHelper.getEntityIcon(secondUpdatedRandomModel);
    const expectedFirstUpdatedRandomModelIcon =
      await iconApiHelper.getEntityIcon(firstUpdatedRandomModel);

    await dialTest.step(
      'Prepare two model conversations for comparing',
      async () => {
        firstConversation = conversationData.prepareModelConversation(
          1,
          'prompt',
          [],
          initRandomModel,
        );
        conversationData.resetData();
        secondConversation =
          conversationData.prepareDefaultConversation(initRandomModel);
        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          firstConversation,
          secondConversation,
        );
      },
    );

    await dialTest.step(
      'Open chat settings and update them for both models',
      async () => {
        await dialHomePage.openHomePage({
          iconsToBeLoaded: [initRandomModel.iconUrl],
        });
        await dialHomePage.waitForPageLoaded();
        await leftChatHeader.openConversationSettingsPopup();
        await leftConversationSettings
          .getTalkToSelector()
          .selectModel(firstUpdatedRandomModel);
        const leftEntitySettings = leftConversationSettings.getEntitySettings();
        if (firstUpdatedRandomModel.features?.systemPrompt) {
          await leftEntitySettings.setSystemPrompt(firstUpdatedPrompt);
        }
        await leftEntitySettings
          .getTemperatureSlider()
          .setTemperature(firstUpdatedTemp);

        await rightConversationSettings
          .getTalkToSelector()
          .selectModel(secondUpdatedRandomModel);
        const rightEntitySettings =
          rightConversationSettings.getEntitySettings();
        if (secondUpdatedRandomModel.features?.systemPrompt) {
          await rightEntitySettings.setSystemPrompt(secondUpdatedPrompt);
        }
        await rightEntitySettings
          .getTemperatureSlider()
          .setTemperature(secondUpdatedTemp);
        await chat.applyNewEntity();
      },
    );

    await dialTest.step(
      'Verify chat icons are updated with new model and addons in the header and chat bar',
      async () => {
        const rightHeaderModelIcon = await rightChatHeader.getHeaderModelIcon();
        expect
          .soft(
            rightHeaderModelIcon,
            `${ExpectedMessages.entityIconIsValid} for ${secondUpdatedRandomModel.name}`,
          )
          .toBe(expectedSecondUpdatedRandomModelIcon);

        const leftHeaderModelIcon = await leftChatHeader.getHeaderModelIcon();
        expect
          .soft(
            leftHeaderModelIcon,
            `${ExpectedMessages.entityIconIsValid} for ${firstUpdatedRandomModel.name}`,
          )
          .toBe(expectedFirstUpdatedRandomModelIcon);

        const firstConversationIcon = await conversations.getConversationIcon(
          firstConversation.name,
        );
        expect
          .soft(firstConversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedFirstUpdatedRandomModelIcon);

        const secondConversationIcon = await conversations.getConversationIcon(
          secondConversation.name,
        );
        expect
          .soft(secondConversationIcon, ExpectedMessages.entityIconIsValid)
          .toBe(expectedSecondUpdatedRandomModelIcon);
      },
    );

    await dialTest.step(
      'Hover over chat headers and verify chat settings updated on tooltip',
      async () => {
        await errorPopup.cancelPopup();
        await rightChatHeader.hoverOverChatModel();
        const rightModelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(rightModelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(ModelsUtil.getModelInfo(secondUpdatedRandomModel.id));

        const rightModelInfoIcon = await chatInfoTooltip.getModelIcon();
        expect
          .soft(rightModelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
          .toBe(expectedSecondUpdatedRandomModelIcon);

        if (secondUpdatedRandomModel.features?.systemPrompt) {
          const rightPromptInfo = await chatInfoTooltip.getPromptInfo();
          expect
            .soft(rightPromptInfo, ExpectedMessages.chatInfoPromptIsValid)
            .toBe(secondUpdatedPrompt);
        }

        const rightTempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(rightTempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(secondUpdatedTemp.toString());

        await errorPopup.cancelPopup();
        await leftChatHeader.hoverOverChatModel();
        const leftModelInfo = await chatInfoTooltip.getModelInfo();
        expect
          .soft(leftModelInfo, ExpectedMessages.chatInfoModelIsValid)
          .toBe(ModelsUtil.getModelInfo(firstUpdatedRandomModel.id));

        const leftModelInfoIcon = await chatInfoTooltip.getModelIcon();
        expect
          .soft(leftModelInfoIcon, ExpectedMessages.chatInfoModelIconIsValid)
          .toBe(expectedFirstUpdatedRandomModelIcon);

        if (firstUpdatedRandomModel.features?.systemPrompt) {
          const leftPromptInfo = await chatInfoTooltip.getPromptInfo();
          expect
            .soft(leftPromptInfo, ExpectedMessages.chatInfoPromptIsValid)
            .toBe(firstUpdatedPrompt);
        }

        const leftTempInfo = await chatInfoTooltip.getTemperatureInfo();
        expect
          .soft(leftTempInfo, ExpectedMessages.chatInfoTemperatureIsValid)
          .toBe(firstUpdatedTemp.toString());
      },
    );
  },
);

dialTest(
  'In compare mode delete any message in chat2.\n' +
    'In compare mode copy answer.\n' +
    'In compare mode save&sumbit any message in chat1.\n' +
    'In compare mode edit chat name.\n' +
    'In compare mode delete a chat',
  async ({
    dialHomePage,
    setTestIds,
    conversationData,
    localStorageManager,
    dataInjector,
    chatMessages,
    confirmationDialog,
    page,
    conversations,
    leftChatHeader,
    conversationDropdownMenu,
    compare,
  }) => {
    setTestIds(
      'EPMRTC-560',
      'EPMRTC-562',
      'EPMRTC-559',
      'EPMRTC-563',
      'EPMRTC-564',
    );
    let firstConversation: Conversation;
    let secondConversation: Conversation;
    const firstConversationRequests = ['1+2', '2+3', '3+4'];
    const secondConversationRequests = ['1+2', '4+5', '5+6'];
    let updatedRequestContent: string;

    await dialTest.step(
      'Prepare two conversations for compare mode',
      async () => {
        firstConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            defaultModel,
            firstConversationRequests,
          );
        conversationData.resetData();

        secondConversation =
          conversationData.prepareModelConversationBasedOnRequests(
            gpt4Model,
            secondConversationRequests,
          );

        await dataInjector.createConversations([
          firstConversation,
          secondConversation,
        ]);
        await localStorageManager.setSelectedConversation(
          firstConversation,
          secondConversation,
        );
      },
    );

    await dialTest.step(
      'Delete 1st message from the left conversation and verify only 1st row deleted for both chats',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await chatMessages.openDeleteCompareRowMessageDialog(Side.left, 1);
        await confirmationDialog.confirm();

        const comparedMessagesCount =
          await chatMessages.getCompareMessagesCount();
        expect
          .soft(comparedMessagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe((firstConversationRequests.length - 1) * 4);

        const firstComparedMessage = await chatMessages.getCompareRowMessage(
          Side.left,
          1,
        );
        await expect
          .soft(firstComparedMessage, ExpectedMessages.messageContentIsValid)
          .toHaveText(firstConversationRequests[1]);
      },
    );

    await dialTest.step(
      'Copy last response from the right conversation and edit the 1st request for the left chat with copied message',
      async () => {
        await chatMessages.copyCompareRowMessage(
          Side.right,
          (firstConversationRequests.length - 1) * 2,
        );
        await chatMessages.openEditCompareRowMessageMode(Side.left, 1);
        await chatMessages.clearEditTextarea(firstConversationRequests[1]);
        await page.keyboard.press(keys.ctrlPlusV);
        await chatMessages.saveAndSubmit.click();
        await chatMessages.waitForResponseReceived();
      },
    );

    await dialTest.step(
      'Verify both first requests updated, messages below are deleted',
      async () => {
        updatedRequestContent =
          secondConversation.messages[secondConversation.messages.length - 1]
            .content;
        const comparedMessagesCount =
          await chatMessages.getCompareMessagesCount();
        expect
          .soft(comparedMessagesCount, ExpectedMessages.messageCountIsCorrect)
          .toBe(4);

        for (const side of Object.values(Side)) {
          const firstComparedMessage = await chatMessages.getCompareRowMessage(
            side,
            1,
          );
          await expect
            .soft(firstComparedMessage, ExpectedMessages.messageContentIsValid)
            .toHaveText(updatedRequestContent);
        }
      },
    );

    await dialTest.step(
      'Edit left chat title and verify it is updated in the header',
      async () => {
        const newLeftChatName = GeneratorUtil.randomString(7);
        await conversations.openConversationDropdownMenu(
          updatedRequestContent,
          1,
        );
        await conversationDropdownMenu.selectMenuOption(MenuOptions.rename);
        await conversations.editConversationNameWithTick(
          updatedRequestContent,
          newLeftChatName,
        );

        const chatTitle = await leftChatHeader.chatTitle.getElementContent();
        expect
          .soft(chatTitle, ExpectedMessages.headerTitleCorrespondRequest)
          .toBe(chatTitle);
      },
    );

    await dialTest.step(
      'Delete right chat and compare mode closed, left chat is active',
      async () => {
        await conversations.openConversationDropdownMenu(updatedRequestContent);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.delete);
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await conversations
          .getConversationByName(updatedRequestContent)
          .waitFor({ state: 'hidden' });
        const isCompareModeOpened = await compare.isVisible();
        expect
          .soft(isCompareModeOpened, ExpectedMessages.compareModeClosed)
          .toBeFalsy();
      },
    );
  },
);
