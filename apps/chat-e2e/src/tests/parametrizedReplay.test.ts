import { Conversation } from '@/chat/types/chat';
import { DialAIEntityModel } from '@/chat/types/models';
import { Prompt } from '@/chat/types/prompt';
import dialTest from '@/src/core/dialFixtures';
import dialSharedWithMeTest from '@/src/core/dialSharedWithMeFixtures';
import {
  ExpectedConstants,
  MenuOptions,
  MockedChatApiResponseBodies,
} from '@/src/testData';
import { Colors } from '@/src/ui/domData';
import { UploadDownloadData } from '@/src/ui/pages';
import { GeneratorUtil, ModelsUtil } from '@/src/utils';

const countryVar = 'country';
const countryDefaultValue = 'Japan';
const attractionsVar = 'num-attractions';
const attractionsValue = '5';
const daysVar = 'num-days';
const daysValue = '7';
const contentTemplate = (country: string, attractions: string, days: string) =>
  `I'd like to travel to ${country}. Could you please suggest ${attractions} of the best attractions? I'll be there for ${days} of days`;
const content = contentTemplate(
  `{{${countryVar}|${countryDefaultValue}}}`,
  `{{${attractionsVar}|10}}`,
  `{{${daysVar}}}`,
);
const paramsMap = new Map([
  [attractionsVar, attractionsValue],
  [daysVar, daysValue],
]);

let allModels;
let randomModel: DialAIEntityModel;
let defaultModel: DialAIEntityModel;

dialTest.beforeAll(async () => {
  allModels = ModelsUtil.getLatestModels();
  defaultModel = ModelsUtil.getDefaultModel()!;
  randomModel = GeneratorUtil.randomArrayElement(
    allModels.filter((m) => m.id !== ModelsUtil.getDefaultModel()!.id),
  );
});

dialTest(
  'Check pre-defined and set new values on Prompt pop-up while replaying the conversation.\n' +
    'Check the labels-text on Prompt pop-up while replaying the conversation.\n' +
    'Prompt pop-up appears while replaying the chat if to use Replay as is.\n' +
    "Replaying of the chat is stopped if to close Prompt pop-up. 'Start replay' button. Prompt pop-up appears on replaying again.\n" +
    'Check parameter values are required on Prompt pop-up while replaying the conversation',
  async ({
    dialHomePage,
    conversationData,
    promptData,
    chat,
    conversations,
    dataInjector,
    setTestIds,
    variableModalAssertion,
    variableModalDialog,
    chatAssertion,
    page,
    chatMessagesAssertion,
  }) => {
    setTestIds(
      'EPMRTC-3886',
      'EPMRTC-3888',
      'EPMRTC-3889',
      'EPMRTC-3894',
      'EPMRTC-3887',
    );
    let prompt: Prompt;
    let conversation: Conversation;
    let replayConversation: Conversation;
    const countryUpdatedValue = 'France';
    const attractionsUpdatedValue = '6';
    const daysUpdatedValue = '8';

    await dialTest.step(
      'Prepare replay conversation based on parametrized prompt',
      async () => {
        prompt = promptData.preparePrompt(content);
        conversation = conversationData.prepareConversationBasedOnPrompt(
          prompt,
          paramsMap,
        );
        replayConversation =
          conversationData.prepareDefaultReplayConversation(conversation);
        await dataInjector.createPrompts([prompt]);
        await dataInjector.createConversations([
          conversation,
          replayConversation,
        ]);
      },
    );

    await dialTest.step(
      'Press Start replay and verify modal with prompt parameters is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(replayConversation.name);
        await chat.replay.click();
        await variableModalAssertion.assertVariableModalState('visible');
      },
    );

    await dialTest.step('Verify modal window title and styles', async () => {
      await variableModalAssertion.assertPromptName(
        ExpectedConstants.replayVariableModalTitle,
      );
      await variableModalAssertion.assertPromptDescription(content);
      await variableModalAssertion.assertPromptDescriptionStyle();
      await variableModalAssertion.assertPromptVariableLabelRequired(
        countryVar,
      );
      await variableModalAssertion.assertPromptVariableLabelRequired(
        attractionsVar,
      );
      await variableModalAssertion.assertPromptVariableLabelRequired(daysVar);
    });

    await dialTest.step('Verify variable labels and values', async () => {
      await variableModalAssertion.assertPromptVariableLabel(countryVar);
      await variableModalAssertion.assertPromptVariableValue(
        countryVar,
        countryDefaultValue,
      );
      await variableModalAssertion.assertPromptVariableLabel(attractionsVar);
      await variableModalAssertion.assertPromptVariableValue(
        attractionsVar,
        attractionsValue,
      );
      await variableModalAssertion.assertPromptVariableLabel(daysVar);
      await variableModalAssertion.assertPromptVariableValue(
        daysVar,
        daysValue,
      );
    });

    await dialTest.step(
      'Close modal and verify "Start Replay" button is available',
      async () => {
        await variableModalDialog.closeButton.click();
        await chatAssertion.assertReplayButtonState('visible');
      },
    );

    await dialTest.step(
      'Open modal again, click out of modal and verify "Start Replay" button is available',
      async () => {
        await chat.replay.click();
        await page.mouse.click(0, 0);
        await chatAssertion.assertReplayButtonState('visible');
      },
    );

    await dialTest.step(
      'Clear 1st parameter, set spaces in the 2nd and 3rd and verify fields are highlighted, error messages appear under the fields',
      async () => {
        await chat.replay.click();
        await variableModalDialog.setVariableValue(countryVar, '');
        await variableModalDialog.setVariableValue(attractionsVar, '  ');
        await variableModalDialog.setVariableValue(daysVar, ' ');
        await variableModalDialog.submitButton.click();

        for (const field of [countryVar, attractionsVar, daysVar]) {
          await variableModalAssertion.assertPromptVariableBordersColor(
            field,
            Colors.textError,
          );
          await variableModalAssertion.assertPromptVariableBottomMessage(
            field,
            ExpectedConstants.fillVariablesAlertText,
          );
        }
      },
    );

    await dialTest.step(
      'Set all required vars, submit form and verify prompt is applied',
      async () => {
        await variableModalDialog.setVariableValue(
          countryVar,
          countryUpdatedValue,
        );
        await variableModalDialog.setVariableValue(
          attractionsVar,
          attractionsUpdatedValue,
        );
        await variableModalDialog.setVariableValue(daysVar, daysUpdatedValue);
        await variableModalDialog.submitReplayVariables();
        await chatMessagesAssertion.assertMessageContent(
          1,
          contentTemplate(
            countryUpdatedValue,
            attractionsUpdatedValue,
            daysUpdatedValue,
          ),
        );
      },
    );
  },
);

dialTest(
  'Prompt pop-up appears while replaying the chat if to select another model.\n' +
    'Prompt pop-up appears while replaying the chat when the initial was imported',
  async ({
    dialHomePage,
    conversationData,
    promptData,
    chat,
    localStorageManager,
    dataInjector,
    setTestIds,
    variableModalAssertion,
    variableModalDialog,
    talkToSelector,
    marketplacePage,
    conversations,
    conversationDropdownMenu,
    chatBar,
    promptBar,
    confirmationDialog,
  }) => {
    setTestIds('EPMRTC-3890', 'EPMRTC-3892');
    let prompt: Prompt;
    let conversation: Conversation;
    let replayConversation: Conversation;
    let exportedData: UploadDownloadData;

    await dialTest.step(
      'Prepare replay conversation based on parametrized prompt',
      async () => {
        prompt = promptData.preparePrompt(content);
        conversation = conversationData.prepareConversationBasedOnPrompt(
          prompt,
          paramsMap,
        );
        replayConversation =
          conversationData.prepareDefaultReplayConversation(conversation);
        await dataInjector.createPrompts([prompt]);
        await dataInjector.createConversations([
          conversation,
          replayConversation,
        ]);
        await localStorageManager.setRecentModelsIds(randomModel);
      },
    );

    await dialTest.step(
      'Select new conversation model, press Start replay and verify modal with prompt parameters is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(replayConversation.name);
        await talkToSelector.selectEntity(randomModel, marketplacePage);
        await chat.replay.click();
        await variableModalAssertion.assertVariableModalState('visible');
        await variableModalDialog.closeButton.click();
      },
    );

    await dialTest.step(
      'Export conversation and then delete all Dial entities',
      async () => {
        await conversations.openEntityDropdownMenu(conversation.name, 2);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.export);
        exportedData = await dialHomePage.downloadData(
          () =>
            conversationDropdownMenu.selectMenuOption(
              MenuOptions.withoutAttachments,
            ),
          GeneratorUtil.exportedWithoutAttachmentsFilename(),
        );
        await chatBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
        await promptBar.deleteAllEntities();
        await confirmationDialog.confirm({ triggeredHttpMethod: 'DELETE' });
      },
    );

    await dialTest.step(
      'Import conversation, create Replay chat based on it, start replay and verify modal with prompt parameters is shown',
      async () => {
        await dialHomePage.importFile(exportedData, () =>
          chatBar.importButton.click(),
        );
        await conversations.openEntityDropdownMenu(conversation.name);
        await conversationDropdownMenu.selectMenuOption(MenuOptions.replay, {
          triggeredHttpMethod: 'POST',
        });
        await chat.replay.click();
        await variableModalAssertion.assertVariableModalState('visible');
        await variableModalAssertion.assertPromptVariableValue(
          countryVar,
          countryDefaultValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          attractionsVar,
          attractionsValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          daysVar,
          daysValue,
        );
      },
    );
  },
);

dialSharedWithMeTest(
  `Stop-Start replaying of the chat on the step with Prompt pop-up. 'Continue replay' button. Prompt pop-up doesn't appear on replaying again.\n` +
    'Prompt pop-up appears while replaying the chat when the initial was shared',
  async ({
    dialHomePage,
    conversationData,
    promptData,
    chat,
    dataInjector,
    setTestIds,
    variableModalAssertion,
    mainUserShareApiHelper,
    additionalUserShareApiHelper,
    additionalShareUserDialHomePage,
    additionalShareUserSharedWithMeConversations,
    additionalShareUserSharedWithMeConversationDropdownMenu,
    additionalShareUserChat,
    additionalShareUserVariableModalAssertion,
    conversations,
  }) => {
    setTestIds('EPMRTC-3895', 'EPMRTC-3893');
    let prompt: Prompt;
    let conversation: Conversation;
    let replayConversation: Conversation;

    await dialTest.step(
      'Prepare partially replay conversation based on parametrized prompt, share it with another user',
      async () => {
        prompt = promptData.preparePrompt(content);
        conversation = conversationData.prepareConversationBasedOnPrompt(
          prompt,
          paramsMap,
        );
        replayConversation =
          conversationData.preparePartiallyReplayedConversation(conversation);
        await dataInjector.createPrompts([prompt]);
        await dataInjector.createConversations([
          conversation,
          replayConversation,
        ]);

        const shareByLinkResponse =
          await mainUserShareApiHelper.shareEntityByLink([conversation]);
        await additionalUserShareApiHelper.acceptInvite(shareByLinkResponse);
      },
    );

    await dialTest.step(
      'Open partially replayed conversation, press Continue replay and verify modal with prompt parameters is not displayed',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(replayConversation.name);
        await chat.proceedReplaying();
        await variableModalAssertion.assertVariableModalState('hidden');
      },
    );

    await dialSharedWithMeTest.step(
      'Create Replay chat for shared conversation, start Replay and verify modal with prompt parameters is displayed',
      async () => {
        await additionalShareUserDialHomePage.openHomePage();
        await additionalShareUserDialHomePage.waitForPageLoaded();
        await additionalShareUserSharedWithMeConversations.selectConversation(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversations.openEntityDropdownMenu(
          conversation.name,
        );
        await additionalShareUserSharedWithMeConversationDropdownMenu.selectMenuOption(
          MenuOptions.replay,
          {
            triggeredHttpMethod: 'POST',
          },
        );
        await additionalShareUserChat.replay.click();
        await additionalShareUserVariableModalAssertion.assertVariableModalState(
          'visible',
        );
        await additionalShareUserVariableModalAssertion.assertPromptVariableValue(
          countryVar,
          countryDefaultValue,
        );
        await additionalShareUserVariableModalAssertion.assertPromptVariableValue(
          attractionsVar,
          attractionsValue,
        );
        await additionalShareUserVariableModalAssertion.assertPromptVariableValue(
          daysVar,
          daysValue,
        );
      },
    );
  },
);

dialTest(
  'Prompt pop-up appears while replaying the chat. Using three prompts with parameters and two different models in conversation. This example is taken from YouTube DIAL channel',
  async ({
    dialHomePage,
    conversationData,
    promptData,
    chat,
    conversations,
    dataInjector,
    setTestIds,
    variableModalAssertion,
    variableModalDialog,
    apiAssertion,
  }) => {
    setTestIds('EPMRTC-3884');
    let firstPrompt: Prompt;
    let secondPrompt: Prompt;
    let thirdPrompt: Prompt;
    let firstPromptConversation: Conversation;
    let noPromptConversation: Conversation;
    let secondPromptConversation: Conversation;
    let thirdPromptConversation: Conversation;
    let historyConversation: Conversation;
    let replayConversation: Conversation;
    const secondPromptCountryVar = 'from-country';
    const secondPromptCountryDefaultValue = 'USA';
    const thirdPromptPersonVar = 'person description';
    const thirdPromptPersonVarValue = 'pupil';
    const thirdPromptAttractionVar = 'attraction';
    const thirdPromptAttractionVarValue = 'school';

    await dialTest.step(
      'Prepare replay conversation based on set of parametrized prompts',
      async () => {
        firstPrompt = promptData.preparePrompt(content);
        promptData.resetData();
        secondPrompt = promptData.preparePrompt(
          `I'm travelling there from {{${secondPromptCountryVar}|${secondPromptCountryDefaultValue}}}. What method of transportation would you suggest?`,
        );
        promptData.resetData();
        thirdPrompt = promptData.preparePrompt(
          `Could you please draw a picture of {{${thirdPromptPersonVar}}} in {{${thirdPromptAttractionVar}}}?`,
        );

        firstPromptConversation =
          conversationData.prepareConversationBasedOnPrompt(
            firstPrompt,
            paramsMap,
          );
        conversationData.resetData();
        noPromptConversation = conversationData.prepareDefaultConversation();
        conversationData.resetData();
        secondPromptConversation =
          conversationData.prepareConversationBasedOnPrompt(secondPrompt);
        conversationData.resetData();
        thirdPromptConversation =
          conversationData.prepareConversationBasedOnPrompt(
            thirdPrompt,
            new Map([
              [thirdPromptPersonVar, thirdPromptPersonVarValue],
              [thirdPromptAttractionVar, thirdPromptAttractionVarValue],
            ]),
            randomModel,
          );
        conversationData.resetData();
        historyConversation = conversationData.prepareHistoryConversation(
          firstPromptConversation,
          noPromptConversation,
          secondPromptConversation,
          thirdPromptConversation,
        );

        replayConversation =
          conversationData.prepareDefaultReplayConversation(
            historyConversation,
          );
        await dataInjector.createPrompts([
          firstPrompt,
          secondPrompt,
          thirdPrompt,
        ]);
        await dataInjector.createConversations([
          historyConversation,
          replayConversation,
        ]);
      },
    );

    await dialTest.step(
      'Press Start replay and verify modal with first prompt parameters is shown',
      async () => {
        await dialHomePage.openHomePage();
        await dialHomePage.waitForPageLoaded();
        await conversations.selectConversation(replayConversation.name);
        await dialHomePage.mockChatTextResponse(
          MockedChatApiResponseBodies.simpleTextBody,
        );
        await chat.replay.click();
        await variableModalAssertion.assertVariableModalState('visible');
        await variableModalAssertion.assertPromptVariableValue(
          countryVar,
          countryDefaultValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          attractionsVar,
          attractionsValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          daysVar,
          daysValue,
        );
      },
    );

    await dialTest.step(
      'Press Submit and verify modal with second prompt parameters is shown',
      async () => {
        const firstRequest = await variableModalDialog.submitReplayVariables();
        await apiAssertion.assertRequestModelId(firstRequest, defaultModel);
        await variableModalAssertion.assertVariableModalState('visible');
        await variableModalAssertion.assertPromptVariableValue(
          secondPromptCountryVar,
          secondPromptCountryDefaultValue,
        );
      },
    );

    await dialTest.step(
      'Press Submit and verify modal with third prompt parameters is shown',
      async () => {
        const secondRequest = await variableModalDialog.submitReplayVariables();
        await apiAssertion.assertRequestModelId(secondRequest, defaultModel);
        await variableModalAssertion.assertVariableModalState('visible');
        await variableModalAssertion.assertPromptVariableValue(
          thirdPromptPersonVar,
          thirdPromptPersonVarValue,
        );
        await variableModalAssertion.assertPromptVariableValue(
          thirdPromptAttractionVar,
          thirdPromptAttractionVarValue,
        );
      },
    );

    await dialTest.step(
      'Press Submit and verify request with valid model is sent',
      async () => {
        const thirdRequest = await variableModalDialog.submitReplayVariables();
        await apiAssertion.assertRequestModelId(thirdRequest, randomModel);
      },
    );
  },
);
